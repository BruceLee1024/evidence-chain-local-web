import { describe, expect, it } from 'vitest';
import { buildAiMatchCandidates } from '../server/ai/matcher.js';

describe('buildAiMatchCandidates', () => {
  it('turns relevant AI judgments into candidate links only', async () => {
    const provider = {
      async judgeEvidenceMatch() {
        return { relevant: true, confidence: 82, reason: '部位同为地下室底板，日期在施工期间' };
      }
    };

    const links = await buildAiMatchCandidates({
      provider,
      items: [
        {
          id: 'item-1',
          name: '地下室底板钢筋',
          location: '3#楼地下室底板',
          startDate: '2026-05-01',
          endDate: '2026-05-31'
        }
      ],
      evidenceRecords: [
        {
          id: 'ev-1',
          type: 'hidden',
          title: '底板钢筋验收',
          location: '三号楼地下室底板',
          evidenceDate: '2026-05-16',
          payload: {}
        }
      ],
      existingLinks: [],
      limit: 50
    });

    expect(links).toEqual([
      {
        itemId: 'item-1',
        evidenceId: 'ev-1',
        confidence: 82,
        matchKind: 'AI语义匹配：部位同为地下室底板，日期在施工期间',
        status: 'candidate',
        source: 'ai'
      }
    ]);
  });
});
