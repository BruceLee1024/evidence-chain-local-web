import ExcelJS from 'exceljs';

const confirmedStatuses = new Set(['auto', 'manual']);

export function buildSettlementWorkbook(session, items, links, evidence) {
  const evidenceById = new Map(evidence.map((record) => [record.id, record]));
  const rows = items.map((item) => {
    const itemLinks = links.filter((link) => link.itemId === item.id && confirmedStatuses.has(link.status));
    const linkedEvidence = itemLinks.map((link) => evidenceById.get(link.evidenceId)).filter(Boolean);
    return {
      序号: item.rowNumber,
      结算项: item.name,
      部位: item.location,
      开始日期: item.startDate,
      结束日期: item.endDate,
      金额: item.amount,
      匹配状态: item.status,
      支撑证据: linkedEvidence.map((record) => record.title).join('；'),
      本期产值: monthlyCurrentValue(linkedEvidence)
    };
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = '证据链管理系统';
  workbook.created = new Date();
  workbook.subject = session?.name || '结算证据包';
  const sheet = workbook.addWorksheet('结算项清单');
  const headers = ['序号', '结算项', '部位', '开始日期', '结束日期', '金额', '匹配状态', '支撑证据', '本期产值'];
  sheet.columns = headers.map((header) => ({ header, key: header, width: header === '支撑证据' ? 42 : 16 }));
  rows.forEach((row) => sheet.addRow(row));
  sheet.getRow(1).font = { bold: true };
  return workbook.xlsx.writeBuffer();
}

function monthlyCurrentValue(records) {
  const values = records
    .filter((record) => record.type === 'monthly')
    .map((record) => Number(record.payload?.currentValue ?? record.amount))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (values.length === 0) return '';
  if (values.length === 1) return values[0];
  return values.join('；');
}
