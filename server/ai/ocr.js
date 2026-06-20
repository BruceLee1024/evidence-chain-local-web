import fsp from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { parseDelimitedTable } from '../lib/settlementImport.js';

const FIELD_SCHEMAS = {
  variation: {
    fields: ['code', 'changeType', 'reason', 'amount', 'signDate', 'contractorSigner', 'supervisorSigner', 'ownerSigner', 'scheduleImpact', 'note', 'location'],
    required: ['reason', 'signDate'],
    numbers: ['amount'],
    booleans: ['scheduleImpact']
  },
  hidden: {
    fields: ['location', 'process', 'acceptanceDate', 'conclusion', 'photographer', 'note'],
    required: ['location', 'acceptanceDate'],
    numbers: [],
    booleans: []
  },
  material: {
    fields: ['entryDate', 'materialName', 'spec', 'unit', 'quantity', 'brand', 'supplier', 'receiver', 'note'],
    required: ['entryDate', 'materialName', 'unit', 'quantity'],
    numbers: ['quantity'],
    booleans: []
  },
  monthly: {
    fields: ['month', 'confirmDate', 'currentValue', 'cumulativeValue', 'ownerSigner', 'note'],
    required: ['month', 'confirmDate', 'currentValue', 'cumulativeValue'],
    numbers: ['currentValue', 'cumulativeValue'],
    booleans: []
  }
};

export async function extractEvidenceDraft({ evidenceType, uploads, provider }) {
  const files = await prepareUploadedFiles(uploads);
  const prompt = buildOcrPrompt(evidenceType, summarizeFilesForPrompt(files));
  const raw = await provider.extractEvidenceFields({ evidenceType, prompt, files });
  return normalizeOcrDraft(evidenceType, raw);
}

export function normalizeOcrDraft(evidenceType, raw = {}) {
  const schema = FIELD_SCHEMAS[evidenceType];
  if (!schema) throw new Error(`不支持的证据类型：${evidenceType}`);

  const fields = {};
  const fieldConfidence = {};
  const inputFields = raw.fields || {};
  const inputConfidence = raw.fieldConfidence || raw.confidenceByField || {};

  for (const key of schema.fields) {
    const value = inputFields[key];
    if (value == null || value === '') continue;
    fields[key] = normalizeFieldValue(key, value, schema);
    if (inputConfidence[key] != null) fieldConfidence[key] = Number(inputConfidence[key]);
  }

  const warnings = Array.isArray(raw.warnings) ? [...raw.warnings] : [];
  const missing = schema.required.filter((key) => fields[key] == null || fields[key] === '');
  if (missing.length) warnings.push(`缺少必填字段：${missing.join('、')}`);

  return {
    type: evidenceType,
    fields,
    confidence: normalizeConfidence(raw.confidence),
    fieldConfidence,
    warnings
  };
}

export function summarizeFilesForPrompt(files = []) {
  return files
    .map((file, index) => {
      const text = String(file.extractedText || '').slice(0, 3000);
      return `文件${index + 1}：${file.originalname || file.originalName || '未命名'}\n类型：${file.mimetype || file.mimeType || ''}\n内容：\n${text || '[无可直接抽取文本]'}`;
    })
    .join('\n\n');
}

export async function prepareUploadedFiles(uploads = []) {
  const result = [];
  for (const upload of uploads) {
    const originalname = upload.originalname || upload.originalName || '';
    const mimetype = upload.mimetype || upload.mimeType || '';
    const ext = path.extname(originalname).toLowerCase();
    const item = { ...upload, kind: classifyFileKind({ originalname, mimetype }) };

    if (item.kind === 'spreadsheet') {
      item.extractedText = await extractSpreadsheetText(upload.path, ext);
    } else if (item.kind === 'text') {
      item.extractedText = await fsp.readFile(upload.path, 'utf8').catch(() => '');
    } else if (item.kind === 'document' && ext === '.docx') {
      item.extractedText = await extractDocxText(upload.path);
    } else if (item.kind === 'image') {
      const data = await fsp.readFile(upload.path);
      item.dataUrl = `data:${mimetype || 'image/png'};base64,${data.toString('base64')}`;
    } else {
      item.extractedText = '';
    }

    result.push(item);
  }
  return result;
}

async function extractDocxText(filePath) {
  const zip = await JSZip.loadAsync(await fsp.readFile(filePath));
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) return '';
  return documentXml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildOcrPrompt(evidenceType, fileSummary) {
  const schema = FIELD_SCHEMAS[evidenceType];
  if (!schema) throw new Error(`不支持的证据类型：${evidenceType}`);
  return [
    '请从以下工程资料中识别证据表单字段。',
    `证据类型：${evidenceType}`,
    `允许字段：${schema.fields.join(', ')}`,
    `必填字段：${schema.required.join(', ')}`,
    '数值字段必须返回数字，日期尽量返回 YYYY-MM-DD，月份返回 YYYY-MM。',
    '只返回 JSON：{"fields":{},"confidence":0-1,"fieldConfidence":{},"warnings":[]}',
    '',
    fileSummary
  ].join('\n');
}

export function fieldSchemaForEvidenceType(evidenceType) {
  return FIELD_SCHEMAS[evidenceType];
}

function normalizeFieldValue(key, value, schema) {
  if (schema.numbers.includes(key)) {
    const number = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(number) ? number : value;
  }
  if (schema.booleans.includes(key)) {
    return value === true || value === 'true' || value === '是' || value === '涉及';
  }
  return String(value).trim();
}

function normalizeConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  if (number > 1) return Math.min(1, number / 100);
  return Math.max(0, Math.min(1, number));
}

function classifyFileKind({ originalname, mimetype }) {
  const name = String(originalname || '').toLowerCase();
  const mime = String(mimetype || '').toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(name)) return 'image';
  if (/\.(xlsx|xls|csv)$/i.test(name)) return 'spreadsheet';
  if (mime.startsWith('text/') || /\.(txt|csv)$/i.test(name)) return 'text';
  if (/\.pdf$/i.test(name)) return 'pdf';
  if (/\.(doc|docx)$/i.test(name)) return 'document';
  return 'unknown';
}

async function extractSpreadsheetText(filePath, ext) {
  if (ext === '.csv') {
    const text = await fsp.readFile(filePath, 'utf8');
    const table = parseDelimitedTable(text);
    return tableToText(table.headers, table.rows);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return '';
  const rows = [];
  worksheet.eachRow((row) => {
    rows.push(row.values.slice(1).map((value) => cellToText(value)).join('\t'));
  });
  return rows.slice(0, 80).join('\n');
}

function tableToText(headers, rows) {
  return [
    headers.join('\t'),
    ...rows.slice(0, 80).map((row) => headers.map((header) => row[header] || '').join('\t'))
  ].join('\n');
}

function cellToText(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('text' in value) return String(value.text || '');
    if ('result' in value) return cellToText(value.result);
    if ('richText' in value) return value.richText.map((part) => part.text).join('');
  }
  return String(value);
}
