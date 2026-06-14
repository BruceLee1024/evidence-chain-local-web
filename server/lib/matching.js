export function normalizeLocation(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[＃#]/g, '号')
    .replace(/[栋幢]/g, '楼')
    .replace(/[()\[\]（）【】,，.。_\-\s/\\]/g, '')
    .replace(/号楼/g, '号楼');
}

function normalizeSearchText(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[＃#]/g, '号')
    .replace(/[()\[\]（）【】,，.。_\-\s/\\]/g, '');
}

export function normalizeDate(value) {
  if (!value) return '';
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(text)) {
    const [year, month, day] = text.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{1,2}$/.test(text)) return `${text}-01`;
  return text;
}

function toTime(value) {
  const date = normalizeDate(value);
  if (!date) return null;
  const time = Date.parse(`${date}T00:00:00`);
  return Number.isNaN(time) ? null : time;
}

export function isDateWithinRange(evidenceDate, startDate, endDate) {
  const evidenceTime = toTime(evidenceDate);
  if (!evidenceTime) return false;

  const startTime = toTime(startDate);
  const endTime = toTime(endDate || startDate);

  if (!startTime && !endTime) return false;
  if (startTime && evidenceTime < startTime) return false;
  if (endTime && evidenceTime > endTime) return false;
  return true;
}

function classifyLocation(itemLocation, evidenceLocation) {
  const item = normalizeLocation(itemLocation);
  const evidence = normalizeLocation(evidenceLocation);
  if (!item || !evidence) return 'none';
  if (item === evidence) return 'exact';
  if (item.includes(evidence) || evidence.includes(item)) return 'fuzzy';
  return 'none';
}

function rangeOverlaps(startA, endA, startB, endB) {
  const aStart = toTime(startA);
  const aEnd = toTime(endA || startA);
  const bStart = toTime(startB);
  const bEnd = toTime(endB || startB);
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart <= bEnd && bStart <= aEnd;
}

function monthRange(month) {
  const text = String(month || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]);
  if (monthIndex < 1 || monthIndex > 12) return null;
  const start = `${year}-${String(monthIndex).padStart(2, '0')}-01`;
  const endDate = new Date(year, monthIndex, 0);
  const end = `${year}-${String(monthIndex).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
  return { start, end };
}

function materialMatchesItem(item, evidence) {
  const itemText = normalizeSearchText(`${item.name || ''}${item.location || ''}`);
  const payload = evidence.payload || {};
  const materialKey = normalizeSearchText(payload.materialName || evidence.title || '');
  const specKey = normalizeSearchText(payload.spec || '');
  if (materialKey && (itemText.includes(materialKey) || materialKey.includes(itemText))) return true;
  if (specKey && itemText.includes(specKey)) return true;
  const titleText = normalizeSearchText(evidence.title || '');
  return Boolean(titleText && itemText && (itemText.includes(titleText) || titleText.includes(itemText)));
}

function monthlyMatchesTime(item, evidence) {
  const payload = evidence.payload || {};
  const confirmDate = payload.confirmDate || evidence.evidenceDate;
  if (isDateWithinRange(confirmDate, item.startDate, item.endDate)) return true;
  const range = monthRange(payload.month);
  if (!range) return false;
  return rangeOverlaps(range.start, range.end, item.startDate, item.endDate || item.startDate);
}

function monthlyAmountIsClose(item, evidence) {
  const itemAmount = Number(item.amount || 0);
  if (!Number.isFinite(itemAmount) || itemAmount <= 0) return false;
  const payload = evidence.payload || {};
  const values = [payload.currentValue, payload.cumulativeValue, evidence.amount]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  return values.some((value) => Math.abs(value - itemAmount) / itemAmount < 0.1);
}

function classifyEvidenceForItem(item, evidence) {
  if (evidence.type === 'material') {
    const timeMatch = isDateWithinRange(evidence.evidenceDate, item.startDate, item.endDate);
    if (timeMatch && materialMatchesItem(item, evidence)) {
      return {
        itemId: item.id,
        evidenceId: evidence.id,
        matchKind: '材料名称相似+时间吻合',
        confidence: 68,
        status: 'candidate'
      };
    }
    return {
      itemId: item.id,
      evidenceId: evidence.id,
      matchKind: timeMatch ? '材料名称不匹配' : '时间不匹配',
      confidence: 0,
      status: 'rejected'
    };
  }

  if (evidence.type === 'monthly') {
    const timeMatch = monthlyMatchesTime(item, evidence);
    if (timeMatch && monthlyAmountIsClose(item, evidence)) {
      return {
        itemId: item.id,
        evidenceId: evidence.id,
        matchKind: '计量月份+金额接近',
        confidence: 85,
        status: 'auto'
      };
    }
    if (timeMatch) {
      return {
        itemId: item.id,
        evidenceId: evidence.id,
        matchKind: '计量月份吻合',
        confidence: 68,
        status: 'candidate'
      };
    }
    return {
      itemId: item.id,
      evidenceId: evidence.id,
      matchKind: '计量月份不匹配',
      confidence: 0,
      status: 'rejected'
    };
  }

  const locationMatch = classifyLocation(item.location, evidence.location);
  const timeMatch = isDateWithinRange(evidence.evidenceDate, item.startDate, item.endDate);
  const baseLink = {
    itemId: item.id,
    evidenceId: evidence.id,
    matchKind: locationMatch === 'exact' ? '部位精确+时间吻合' : '部位相似+时间吻合',
    confidence: locationMatch === 'exact' && timeMatch ? 92 : 68
  };

  if (locationMatch === 'exact' && timeMatch) {
    return { ...baseLink, status: 'auto' };
  }
  if (locationMatch === 'fuzzy' && timeMatch) {
    return { ...baseLink, status: 'candidate' };
  }
  return {
    ...baseLink,
    status: 'rejected',
    confidence: 0,
    matchKind: locationMatch === 'none' ? '部位不匹配' : '时间不匹配'
  };
}

export function matchEvidenceForItems(items, evidenceRecords) {
  return items.map((item) => {
    const autoLinks = [];
    const candidates = [];
    const rejected = [];

    for (const evidence of evidenceRecords) {
      const link = classifyEvidenceForItem(item, evidence);
      if (link.status === 'auto') {
        autoLinks.push(link);
      } else if (link.status === 'candidate') {
        candidates.push(link);
      } else {
        rejected.push(link);
      }
    }

    let status = 'unmatched';
    if (autoLinks.length > 0 && candidates.length === 0) status = 'matched';
    if (autoLinks.length > 0 && candidates.length > 0) status = 'partial';
    if (autoLinks.length === 0 && candidates.length > 0) status = 'partial';

    return {
      itemId: item.id,
      autoLinks,
      candidates,
      rejected,
      status
    };
  });
}
