import { describe, expect, it } from 'vitest';
import { checkSettlementCompleteness } from '../server/ai/checker.js';

describe('checkSettlementCompleteness', () => {
  it('marks concrete settlement items as incomplete when monthly evidence is missing', () => {
    const result = checkSettlementCompleteness({
      items: [
        {
          id: 'item-1',
          name: '3#楼地下室底板混凝土',
          location: '3#楼地下室底板'
        }
      ],
      links: [
        { itemId: 'item-1', evidenceId: 'hidden-1', status: 'manual' },
        { itemId: 'item-1', evidenceId: 'material-1', status: 'manual' }
      ],
      evidence: [
        { id: 'hidden-1', type: 'hidden', title: '底板钢筋验收' },
        { id: 'material-1', type: 'material', title: 'C35混凝土' }
      ]
    });

    expect(result[0]).toMatchObject({
      itemId: 'item-1',
      status: 'incomplete',
      missingTypes: ['monthly']
    });
    expect(result[0].suggestions[0]).toContain('月度计量');
  });
});
