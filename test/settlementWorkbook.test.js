import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildSettlementWorkbook } from '../server/lib/settlementWorkbook.js';

describe('buildSettlementWorkbook', () => {
  it('includes current monthly measurement value for confirmed monthly links', async () => {
    const buffer = await buildSettlementWorkbook(
      { id: 'session-1', name: '2026年6月结算组卷' },
      [
        {
          id: 'item-1',
          rowNumber: 1,
          name: '6月主体结构进度款',
          location: '3#楼',
          startDate: '2026-06-01',
          endDate: '2026-06-30',
          amount: 390000,
          status: 'matched'
        }
      ],
      [
        {
          itemId: 'item-1',
          evidenceId: 'ev-monthly',
          status: 'auto'
        },
        {
          itemId: 'item-1',
          evidenceId: 'ev-monthly-candidate',
          status: 'candidate'
        }
      ],
      [
        {
          id: 'ev-monthly',
          type: 'monthly',
          title: '2026-06 月度计量',
          payload: {
            month: '2026-06',
            currentValue: 380000
          }
        },
        {
          id: 'ev-monthly-candidate',
          type: 'monthly',
          title: '2026-05 月度计量',
          payload: {
            month: '2026-05',
            currentValue: 250000
          }
        }
      ]
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet('结算项清单');

    expect(sheet.getRow(1).values).toContain('本期产值');
    expect(sheet.getRow(2).getCell(9).value).toBe(380000);
  });
});
