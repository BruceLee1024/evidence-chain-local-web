import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { normalizeOcrDraft, prepareUploadedFiles, summarizeFilesForPrompt } from '../server/ai/ocr.js';

describe('normalizeOcrDraft', () => {
  it('keeps only fields allowed by the selected evidence type', () => {
    const draft = normalizeOcrDraft('material', {
      fields: {
        materialName: 'HRB400 钢筋',
        spec: 'Φ25',
        quantity: '120',
        amount: 999999,
        signDate: '2026-06-15'
      },
      fieldConfidence: {
        materialName: 0.93,
        quantity: 0.81,
        signDate: 0.9
      },
      confidence: 0.88
    });

    expect(draft.type).toBe('material');
    expect(draft.fields).toEqual({
      materialName: 'HRB400 钢筋',
      spec: 'Φ25',
      quantity: 120
    });
    expect(draft.fieldConfidence).toEqual({
      materialName: 0.93,
      quantity: 0.81
    });
    expect(draft.warnings).toContain('缺少必填字段：entryDate、unit');
  });
});

describe('summarizeFilesForPrompt', () => {
  it('creates compact file evidence for spreadsheets and uploaded files', () => {
    const summary = summarizeFilesForPrompt([
      {
        originalname: '材料进场.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extractedText: '材料名称: HRB400 钢筋\n数量: 120'
      }
    ]);

    expect(summary).toContain('材料进场.xlsx');
    expect(summary).toContain('HRB400 钢筋');
  });
});

describe('prepareUploadedFiles', () => {
  it('extracts text from docx files without calling a model', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'evidence-ai-docx-'));
    const filePath = path.join(dir, '验收单.docx');
    const zip = new JSZip();
    zip.file(
      'word/document.xml',
      '<w:document><w:body><w:p><w:r><w:t>3#楼地下室底板钢筋验收合格</w:t></w:r></w:p></w:body></w:document>'
    );
    await fs.writeFile(filePath, await zip.generateAsync({ type: 'nodebuffer' }));

    const [file] = await prepareUploadedFiles([
      {
        path: filePath,
        originalname: '验收单.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    ]);

    expect(file.extractedText).toContain('3#楼地下室底板钢筋验收合格');
    await fs.rm(dir, { recursive: true, force: true });
  });
});
