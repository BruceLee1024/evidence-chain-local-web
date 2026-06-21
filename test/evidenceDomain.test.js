import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_LABELS,
  EVIDENCE_TYPES,
  EVIDENCE_TYPES_FOR_AI,
  SUPPLEMENTAL_EVIDENCE_TYPE
} from '../shared/evidenceDomain.js';
import { buildExportTree } from '../server/lib/exportTree.js';

describe('shared evidence domain constants', () => {
  it('keeps core, supplemental, and AI-supported evidence types in one shared module', () => {
    expect(EVIDENCE_TYPES).toEqual(['variation', 'hidden', 'material', 'monthly']);
    expect(SUPPLEMENTAL_EVIDENCE_TYPE).toBe('supplemental');
    expect([...EVIDENCE_TYPES_FOR_AI]).toEqual(EVIDENCE_TYPES);
    expect(EVIDENCE_LABELS).toMatchObject({
      variation: '签证变更单',
      hidden: '隐蔽工程记录',
      material: '材料进场记录',
      monthly: '月度计量记录',
      supplemental: '后补资料'
    });
  });

  it('routes use the shared AI evidence type set instead of local hard-coded sets', () => {
    const aiRoute = readFileSync(new URL('../server/routes/ai.js', import.meta.url), 'utf8');
    const settlementRoute = readFileSync(new URL('../server/routes/settlements.js', import.meta.url), 'utf8');

    expect(aiRoute).toContain('EVIDENCE_TYPES_FOR_AI');
    expect(settlementRoute).toContain('EVIDENCE_TYPES_FOR_AI');
    expect(aiRoute).not.toContain("new Set(['variation'");
    expect(settlementRoute).not.toContain("new Set(['variation'");
  });

  it('export tree labels every current evidence type through the shared labels', () => {
    const tree = buildExportTree({
      sessionName: '标签测试',
      items: [
        { id: 'item-1', rowNumber: 1, name: '测试清单', location: '1#楼' }
      ],
      links: [
        { itemId: 'item-1', evidenceId: 'ev-variation', status: 'manual' },
        { itemId: 'item-1', evidenceId: 'ev-hidden', status: 'manual' },
        { itemId: 'item-1', evidenceId: 'ev-material', status: 'manual' },
        { itemId: 'item-1', evidenceId: 'ev-monthly', status: 'manual' },
        { itemId: 'item-1', evidenceId: 'ev-supplemental', status: 'manual' }
      ],
      evidence: [
        { id: 'ev-variation', type: 'variation', title: '签证' },
        { id: 'ev-hidden', type: 'hidden', title: '隐蔽' },
        { id: 'ev-material', type: 'material', title: '材料' },
        { id: 'ev-monthly', type: 'monthly', title: '计量' },
        { id: 'ev-supplemental', type: 'supplemental', title: '后补' }
      ],
      files: [
        { evidenceId: 'ev-variation', role: 'attachment', originalName: 'a.pdf', path: '/tmp/a.pdf' },
        { evidenceId: 'ev-hidden', role: 'attachment', originalName: 'b.pdf', path: '/tmp/b.pdf' },
        { evidenceId: 'ev-material', role: 'attachment', originalName: 'c.pdf', path: '/tmp/c.pdf' },
        { evidenceId: 'ev-monthly', role: 'attachment', originalName: 'd.pdf', path: '/tmp/d.pdf' },
        { evidenceId: 'ev-supplemental', role: 'attachment', originalName: 'e.pdf', path: '/tmp/e.pdf' }
      ]
    });

    expect(tree.items[0].files.map((file) => file.exportName)).toEqual([
      '签证变更单_签证_a.pdf',
      '隐蔽工程记录_隐蔽_b.pdf',
      '材料进场记录_材料_c.pdf',
      '月度计量记录_计量_d.pdf',
      '后补资料_后补_e.pdf'
    ]);
  });
});
