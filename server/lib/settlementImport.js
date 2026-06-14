import { normalizeDate, normalizeLocation } from './matching.js';

export function parseDelimitedTable(input) {
  const lines = String(input || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return { headers: [], rows: [] };

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = splitLine(lines[0], delimiter).map((header) => header.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = splitLine(line, delimiter);
    return headers.reduce((row, header, index) => {
      row[header] = (cells[index] || '').trim();
      return row;
    }, {});
  });

  return { headers, rows };
}

export function splitLine(line, delimiter) {
  if (delimiter === '\t') return line.split('\t');

  const result = [];
  let current = '';
  let quoted = false;
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function inferColumns(headers) {
  const pick = (keywords) => headers.find((header) => keywords.some((keyword) => header.includes(keyword))) || '';
  return {
    name: pick(['清单', '名称', '项目']),
    location: pick(['部位', '位置', '楼栋', '楼层']),
    startDate: pick(['开始', '施工日期', '日期']),
    endDate: pick(['结束', '截止']),
    amount: pick(['金额', '合价', '造价'])
  };
}

export function mapRowsToSettlementItems(rows, columns) {
  return rows
    .map((row, index) => {
      const name = getCell(row, columns.name);
      const location = getCell(row, columns.location);
      const startDate = normalizeDate(getCell(row, columns.startDate));
      const endDate = normalizeDate(getCell(row, columns.endDate));
      const amount = Number(getCell(row, columns.amount) || 0);

      return {
        rowNumber: index + 1,
        name,
        location,
        normalizedLocation: normalizeLocation(location),
        startDate,
        endDate,
        amount: Number.isFinite(amount) ? amount : 0,
        raw: row
      };
    })
    .filter((item) => item.name || item.location);
}

function getCell(row, key) {
  if (!key) return '';
  return row[key] == null ? '' : String(row[key]).trim();
}
