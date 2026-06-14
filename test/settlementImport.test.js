import { describe, expect, it } from 'vitest';
import { mapRowsToSettlementItems, parseDelimitedTable } from '../server/lib/settlementImport.js';

describe('parseDelimitedTable', () => {
  it('parses copied Excel tab-separated settlement rows', () => {
    const table = parseDelimitedTable('清单名称\t部位\t开始日期\t结束日期\t金额\n底板混凝土\t3#楼地下室底板\t2026-05-01\t2026-05-31\t120000');

    expect(table.headers).toEqual(['清单名称', '部位', '开始日期', '结束日期', '金额']);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0].部位).toBe('3#楼地下室底板');
  });
});

describe('mapRowsToSettlementItems', () => {
  it('maps user-selected columns into normalized settlement items', () => {
    const items = mapRowsToSettlementItems(
      [{ 清单名称: '底板混凝土', 部位: '3#楼地下室底板', 开始日期: '2026-05-01', 结束日期: '2026-05-31', 金额: '120000' }],
      {
        name: '清单名称',
        location: '部位',
        startDate: '开始日期',
        endDate: '结束日期',
        amount: '金额'
      }
    );

    expect(items[0]).toMatchObject({
      name: '底板混凝土',
      location: '3#楼地下室底板',
      startDate: '2026-05-01',
      endDate: '2026-05-31',
      amount: 120000
    });
  });
});
