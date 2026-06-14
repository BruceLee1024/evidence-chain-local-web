import { describe, expect, it } from 'vitest';
import { buildExportTree } from '../server/lib/exportTree.js';

describe('buildExportTree', () => {
  it('builds settlement-item folders with confirmed evidence and supplemental files', () => {
    const tree = buildExportTree({
      sessionName: '2026年6月结算组卷',
      items: [
        { id: 'item-1', rowNumber: 1, name: '底板混凝土', location: '3#楼地下室底板' }
      ],
      links: [
        { itemId: 'item-1', evidenceId: 'ev-1', status: 'auto' },
        { itemId: 'item-1', evidenceId: 'ev-2', status: 'candidate' }
      ],
      evidence: [
        { id: 'ev-1', type: 'hidden', title: '底板钢筋隐蔽验收' },
        { id: 'ev-2', type: 'variation', title: '未确认签证' }
      ],
      files: [
        { evidenceId: 'ev-1', role: 'watermarked', originalName: '现场照片.jpg', path: '/tmp/photo.jpg' },
        { evidenceId: 'ev-1', role: 'acceptance', originalName: '验收单.pdf', path: '/tmp/form.pdf' }
      ]
    });

    expect(tree.rootName).toBe('2026年6月结算组卷');
    expect(tree.items[0].folderName).toBe('01_底板混凝土_3号楼地下室底板');
    expect(tree.items[0].files.map((file) => file.exportName)).toEqual([
      '隐蔽工程记录_底板钢筋隐蔽验收_现场照片.jpg',
      '隐蔽工程记录_底板钢筋隐蔽验收_验收单.pdf'
    ]);
  });

  it('uses material and monthly labels while excluding candidate links from export folders', () => {
    const tree = buildExportTree({
      sessionName: '2026年6月结算组卷',
      items: [
        { id: 'item-1', rowNumber: 1, name: '主体结构', location: '3#楼' }
      ],
      links: [
        { itemId: 'item-1', evidenceId: 'ev-material', status: 'manual' },
        { itemId: 'item-1', evidenceId: 'ev-monthly', status: 'auto' },
        { itemId: 'item-1', evidenceId: 'ev-candidate', status: 'candidate' }
      ],
      evidence: [
        { id: 'ev-material', type: 'material', title: 'HRB400 钢筋 Φ25' },
        { id: 'ev-monthly', type: 'monthly', title: '2026-06 月度计量' },
        { id: 'ev-candidate', type: 'material', title: '未确认材料' }
      ],
      files: [
        { evidenceId: 'ev-material', role: 'certificate', originalName: '合格证.pdf', path: '/tmp/cert.pdf' },
        { evidenceId: 'ev-monthly', role: 'confirmation', originalName: '确认单.pdf', path: '/tmp/monthly.pdf' },
        { evidenceId: 'ev-candidate', role: 'photo', originalName: '候选照片.jpg', path: '/tmp/candidate.jpg' }
      ]
    });

    expect(tree.items[0].files.map((file) => file.exportName)).toEqual([
      '材料进场记录_HRB400钢筋Φ25_合格证.pdf',
      '月度计量记录_2026-06月度计量_确认单.pdf'
    ]);
  });
});
