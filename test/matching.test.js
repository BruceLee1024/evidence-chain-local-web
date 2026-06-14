import { describe, expect, it } from 'vitest';
import { matchEvidenceForItems, normalizeLocation } from '../server/lib/matching.js';

describe('normalizeLocation', () => {
  it('normalizes common construction location punctuation and spacing', () => {
    expect(normalizeLocation('3#楼 地下室 - 底板 混凝土')).toBe('3号楼地下室底板混凝土');
    expect(normalizeLocation('3号楼地下室底板混凝土')).toBe('3号楼地下室底板混凝土');
  });
});

describe('matchEvidenceForItems', () => {
  it('auto links only when location and time both match conservatively', () => {
    const result = matchEvidenceForItems(
      [
        {
          id: 'item-1',
          name: '3#楼地下室底板混凝土',
          location: '3#楼地下室底板',
          startDate: '2026-05-01',
          endDate: '2026-05-31'
        }
      ],
      [
        {
          id: 'ev-auto',
          type: 'hidden',
          title: '底板钢筋隐蔽验收',
          location: '3号楼地下室底板',
          evidenceDate: '2026-05-15'
        },
        {
          id: 'ev-candidate',
          type: 'variation',
          title: '地下室混凝土签证',
          location: '3号楼地下室',
          evidenceDate: '2026-05-16'
        },
        {
          id: 'ev-outside-time',
          type: 'hidden',
          title: '底板浇筑照片',
          location: '3号楼地下室底板',
          evidenceDate: '2026-07-01'
        }
      ]
    );

    expect(result[0].autoLinks.map((link) => link.evidenceId)).toEqual(['ev-auto']);
    expect(result[0].candidates.map((link) => link.evidenceId)).toEqual(['ev-candidate']);
    expect(result[0].rejected.map((link) => link.evidenceId)).toEqual(['ev-outside-time']);
    expect(result[0].status).toBe('partial');
  });

  it('marks material records as candidates when the date and material keyword match', () => {
    const result = matchEvidenceForItems(
      [
        {
          id: 'item-material',
          name: 'HRB400 钢筋安装',
          location: '3#楼地下室',
          startDate: '2026-06-01',
          endDate: '2026-06-30',
          amount: 120000
        }
      ],
      [
        {
          id: 'ev-material',
          type: 'material',
          title: 'HRB400 钢筋 Φ25',
          location: '',
          evidenceDate: '2026-06-15',
          payload: {
            materialName: 'HRB400 钢筋',
            spec: 'Φ25',
            quantity: 120,
            unit: '吨'
          }
        }
      ]
    );

    expect(result[0].autoLinks).toEqual([]);
    expect(result[0].candidates).toMatchObject([
      {
        evidenceId: 'ev-material',
        confidence: 68,
        matchKind: '材料名称相似+时间吻合',
        status: 'candidate'
      }
    ]);
    expect(result[0].status).toBe('partial');
  });

  it('auto links monthly measurements when the measurement month overlaps and amount is close', () => {
    const result = matchEvidenceForItems(
      [
        {
          id: 'item-monthly-close',
          name: '6月主体结构进度款',
          location: '3#楼',
          startDate: '2026-06-01',
          endDate: '2026-06-30',
          amount: 390000
        }
      ],
      [
        {
          id: 'ev-monthly-close',
          type: 'monthly',
          title: '2026-06 月度计量',
          location: '',
          evidenceDate: '2026-07-05',
          amount: 380000,
          payload: {
            month: '2026-06',
            confirmDate: '2026-07-05',
            currentValue: 380000,
            cumulativeValue: 1650000
          }
        }
      ]
    );

    expect(result[0].autoLinks).toMatchObject([
      {
        evidenceId: 'ev-monthly-close',
        confidence: 85,
        matchKind: '计量月份+金额接近',
        status: 'auto'
      }
    ]);
    expect(result[0].candidates).toEqual([]);
    expect(result[0].status).toBe('matched');
  });

  it('keeps monthly measurements as candidates when only the measurement month overlaps', () => {
    const result = matchEvidenceForItems(
      [
        {
          id: 'item-monthly-time',
          name: '6月进度款',
          location: '3#楼',
          startDate: '2026-06-01',
          endDate: '2026-06-30',
          amount: 900000
        }
      ],
      [
        {
          id: 'ev-monthly-time',
          type: 'monthly',
          title: '2026-06 月度计量',
          location: '',
          evidenceDate: '2026-07-05',
          amount: 380000,
          payload: {
            month: '2026-06',
            confirmDate: '2026-07-05',
            currentValue: 380000,
            cumulativeValue: 1650000
          }
        }
      ]
    );

    expect(result[0].autoLinks).toEqual([]);
    expect(result[0].candidates).toMatchObject([
      {
        evidenceId: 'ev-monthly-time',
        confidence: 68,
        matchKind: '计量月份吻合',
        status: 'candidate'
      }
    ]);
    expect(result[0].status).toBe('partial');
  });

  it('rejects monthly measurements when neither confirmation date nor month overlaps', () => {
    const result = matchEvidenceForItems(
      [
        {
          id: 'item-monthly-outside',
          name: '5月进度款',
          location: '3#楼',
          startDate: '2026-05-01',
          endDate: '2026-05-31',
          amount: 390000
        }
      ],
      [
        {
          id: 'ev-monthly-outside',
          type: 'monthly',
          title: '2026-06 月度计量',
          location: '',
          evidenceDate: '2026-07-05',
          amount: 380000,
          payload: {
            month: '2026-06',
            confirmDate: '2026-07-05',
            currentValue: 380000,
            cumulativeValue: 1650000
          }
        }
      ]
    );

    expect(result[0].autoLinks).toEqual([]);
    expect(result[0].candidates).toEqual([]);
    expect(result[0].rejected).toMatchObject([
      {
        evidenceId: 'ev-monthly-outside',
        confidence: 0,
        matchKind: '计量月份不匹配',
        status: 'rejected'
      }
    ]);
    expect(result[0].status).toBe('unmatched');
  });
});
