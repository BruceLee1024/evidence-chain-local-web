const TYPE_LABELS = {
  hidden: '隐蔽工程验收记录',
  material: '材料进场记录',
  monthly: '月度计量确认单',
  variation: '签证变更单'
};

export function checkSettlementCompleteness({ items, links, evidence }) {
  const evidenceById = new Map(evidence.map((record) => [record.id, record]));
  const linksByItem = groupBy(links.filter((link) => link.status === 'auto' || link.status === 'manual' || link.status === 'candidate'), 'itemId');

  return items.map((item) => {
    const expectedTypes = expectedEvidenceTypes(item);
    const linkedTypes = new Set(
      (linksByItem.get(item.id) || [])
        .map((link) => evidenceById.get(link.evidenceId)?.type)
        .filter(Boolean)
    );
    const missingTypes = expectedTypes.filter((type) => !linkedTypes.has(type));
    const status = missingTypes.length === 0 ? 'complete' : missingTypes.length >= 2 ? 'critical' : 'incomplete';
    return {
      itemId: item.id,
      status,
      expectedTypes,
      missingTypes,
      suggestions: missingTypes.map((type) => `建议补充${TYPE_LABELS[type] || type}`)
    };
  });
}

export function expectedEvidenceTypes(item) {
  const text = `${item.name || ''}${item.location || ''}`;
  if (/签证|变更|联系单/.test(text)) return ['variation', 'monthly'];
  if (/钢筋/.test(text)) return ['hidden', 'material'];
  if (/混凝土|砼/.test(text)) return ['hidden', 'material', 'monthly'];
  if (/防水/.test(text)) return ['hidden', 'material', 'monthly'];
  return ['monthly'];
}

function groupBy(records, key) {
  const map = new Map();
  for (const record of records) {
    const value = record[key];
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(record);
  }
  return map;
}
