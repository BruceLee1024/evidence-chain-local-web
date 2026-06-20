import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { Router } from 'express';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { buildAiMatchCandidates } from '../ai/matcher.js';
import { buildAiConfig, createAiProvider } from '../ai/provider.js';
import { getAiSettings } from '../ai/settings.js';
import { checkSettlementCompleteness } from '../ai/checker.js';
import { buildExportTree } from '../lib/exportTree.js';
import { matchEvidenceForItems } from '../lib/matching.js';
import { buildSettlementWorkbook } from '../lib/settlementWorkbook.js';
import { inferColumns, mapRowsToSettlementItems, parseDelimitedTable } from '../lib/settlementImport.js';
import {
  createEvidence,
  createSettlementSession,
  deleteSettlementLink,
  getEvidenceForProject,
  getSettlementItemForSession,
  getSettlementSession,
  getSettlementSessionForProject,
  insertSettlementLink,
  listEvidence,
  listFilesForEvidence,
  listSettlementItems,
  listSettlementLinks,
  listSettlementSessions
} from '../repository.js';
import { attachFileToEvidence, persistUpload } from '../fileStore.js';
import { getDb } from '../db.js';

const evidenceTypesForAi = new Set(['variation', 'hidden', 'material', 'monthly']);

export function createSettlementRouter(upload) {
  const router = Router({ mergeParams: true });

  router.post('/settlements/parse-paste', (req, res) => {
    const table = parseDelimitedTable(req.body.text || '');
    res.json({ ...table, columns: inferColumns(table.headers) });
  });

  router.post('/settlements/parse-file', upload.single('spreadsheet'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: '请上传 Excel 文件' });
      const parsed = await parseSpreadsheetFile(req.file.path, req.file.originalname);
      res.json({ ...parsed, columns: inferColumns(parsed.headers) });
    } catch (error) {
      res.status(400).json({ error: 'Excel 文件解析失败，请检查文件格式' });
    } finally {
      if (req.file) await fsp.unlink(req.file.path).catch(() => {});
    }
  });

  router.post('/settlements', (req, res) => {
    const items = mapRowsToSettlementItems(req.body.rows || [], req.body.columns || {});
    if (items.length === 0) return res.status(400).json({ error: '未识别到结算项' });

    const session = createSettlementSession(
      req.params.projectId,
      req.body.name || `${new Date().toISOString().slice(0, 10)} 结算组卷`,
      items
    );
    applyInitialMatching(req.params.projectId, session.id);
    res.status(201).json(getSettlementPayload(session.id));
  });

  router.get('/settlements', (req, res) => {
    res.json(listSettlementSessions(req.params.projectId));
  });

  router.get('/settlements/:sessionId', requireSettlementSession, (req, res) => {
    res.json(getSettlementPayload(req.params.sessionId));
  });

  router.post('/settlements/:sessionId/rematch-ai', requireSettlementSession, async (req, res, next) => {
    try {
      const config = currentAiConfig();
      if (!config.enabled) return res.status(400).json({ error: 'AI 未配置：请先配置国内模型 API Key' });
      const items = listSettlementItems(req.params.sessionId);
      const evidence = listEvidence(req.params.projectId).filter((record) => evidenceTypesForAi.has(record.type));
      const existingLinks = listSettlementLinks(req.params.sessionId);
      const candidates = await buildAiMatchCandidates({
        provider: createAiProvider(config),
        items,
        evidenceRecords: evidence,
        existingLinks,
        limit: Number(req.body.limit || 50)
      });
      for (const link of candidates) {
        insertSettlementLink(link);
      }
      res.json({ ...getSettlementPayload(req.params.sessionId), aiCandidates: candidates.length });
    } catch (error) {
      next(error);
    }
  });

  router.get('/settlements/:sessionId/check-completeness', requireSettlementSession, (req, res) => {
    const payload = getSettlementPayload(req.params.sessionId);
    const allEvidence = listEvidence(req.params.projectId);
    res.json(checkSettlementCompleteness({
      items: payload.items,
      links: payload.links,
      evidence: allEvidence
    }));
  });

  router.post('/settlements/:sessionId/items/:itemId/links', requireSettlementSession, requireSettlementItem, (req, res) => {
    const evidence = getEvidenceForProject(req.params.projectId, req.body.evidenceId);
    if (!evidence) return res.status(404).json({ error: '证据不存在' });
    insertSettlementLink({
      itemId: req.params.itemId,
      evidenceId: req.body.evidenceId,
      confidence: Number(req.body.confidence || 100),
      matchKind: req.body.matchKind || '人工确认',
      status: req.body.status || 'manual',
      source: 'manual'
    });
    res.json(getSettlementPayload(req.params.sessionId));
  });

  router.delete('/settlements/:sessionId/items/:itemId/links/:evidenceId', requireSettlementSession, requireSettlementItem, (req, res) => {
    const evidence = getEvidenceForProject(req.params.projectId, req.params.evidenceId);
    if (!evidence) return res.status(404).json({ error: '证据不存在' });
    deleteSettlementLink(req.params.itemId, req.params.evidenceId);
    res.json(getSettlementPayload(req.params.sessionId));
  });

  router.post('/settlements/:sessionId/items/:itemId/supplemental', requireSettlementSession, requireSettlementItem, upload.array('attachments'), async (req, res, next) => {
    try {
      const item = req.settlementItem;
      const evidence = createEvidence(req.params.projectId, {
        type: 'supplemental',
        title: `后补资料-${item.name}`,
        location: item.location,
        evidenceDate: new Date().toISOString().slice(0, 10),
        payload: { note: req.body.note || '后补资料' }
      });
      await persistEvidenceFiles(req.params.projectId, evidence.id, { attachments: req.files || [] }, { attachments: 'attachment' });
      insertSettlementLink({
        itemId: req.params.itemId,
        evidenceId: evidence.id,
        confidence: 100,
        matchKind: '后补资料',
        status: 'manual',
        source: 'supplemental'
      });
      res.status(201).json(getSettlementPayload(req.params.sessionId));
    } catch (error) {
      next(error);
    }
  });

  router.get('/settlements/:sessionId/preview', requireSettlementSession, (req, res) => {
    res.json(buildPreview(req.params.sessionId));
  });

  router.get('/settlements/:sessionId/export.zip', requireSettlementSession, async (req, res, next) => {
    try {
      const preview = buildPreview(req.params.sessionId);
      const payload = getSettlementPayload(req.params.sessionId);
      const zip = new JSZip();
      const root = zip.folder(preview.rootName);

      for (const item of preview.items) {
        const folder = root.folder(item.folderName);
        if (item.files.length === 0) {
          folder.file('未匹配证据说明.txt', '该结算项暂无已确认支撑证据，请人工补充。');
        }
        for (const file of item.files) {
          if (file.sourcePath && fs.existsSync(file.sourcePath)) {
            folder.file(file.exportName, await fsp.readFile(file.sourcePath));
          }
        }
      }

      root.file('结算项清单.xlsx', await buildSettlementWorkbook(payload.session, payload.items, payload.links, payload.evidence));
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });
      const filename = `${preview.rootName}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function requireSettlementSession(req, res, next) {
  const session = getSettlementSessionForProject(req.params.projectId, req.params.sessionId);
  if (!session) return res.status(404).json({ error: '结算批次不存在' });
  req.settlementSession = session;
  next();
}

function requireSettlementItem(req, res, next) {
  const item = getSettlementItemForSession(req.params.sessionId, req.params.itemId);
  if (!item) return res.status(404).json({ error: '结算项不存在' });
  req.settlementItem = item;
  next();
}

async function persistEvidenceFiles(projectId, evidenceId, fields, roles) {
  for (const [fieldName, uploads] of Object.entries(fields)) {
    const role = roles[fieldName];
    if (!role) continue;
    for (const [index, uploadFile] of uploads.entries()) {
      const saved = await persistUpload(projectId, uploadFile);
      attachFileToEvidence(evidenceId, saved.id, role, index);
    }
  }
}

function currentAiConfig() {
  return buildAiConfig(process.env, getAiSettings());
}

function applyInitialMatching(projectId, sessionId) {
  const sessionItems = listSettlementItems(sessionId).map((item) => ({
    id: item.id,
    name: item.name,
    location: item.location,
    startDate: item.startDate,
    endDate: item.endDate,
    amount: item.amount
  }));
  const evidence = listEvidence(projectId).filter((record) => evidenceTypesForAi.has(record.type));
  const matches = matchEvidenceForItems(sessionItems, evidence);

  for (const match of matches) {
    for (const link of match.autoLinks) {
      insertSettlementLink({ ...link, itemId: match.itemId, source: 'auto' });
    }
    for (const link of match.candidates) {
      insertSettlementLink({ ...link, itemId: match.itemId, source: 'auto' });
    }
  }
}

function getSettlementPayload(sessionId) {
  const session = getSettlementSession(sessionId);
  if (!session) return null;
  const items = listSettlementItems(sessionId);
  const links = listSettlementLinks(sessionId);
  const evidenceIds = [...new Set(links.map((link) => link.evidenceId))];
  const evidence = evidenceIds.length
    ? getDb().prepare(`
        SELECT id, project_id AS projectId, type, code, title, location,
          normalized_location AS normalizedLocation, evidence_date AS evidenceDate,
          end_date AS endDate, amount, payload_json AS payloadJson, created_at AS createdAt
        FROM evidence WHERE id IN (${evidenceIds.map(() => '?').join(',')})
      `).all(...evidenceIds).map((row) => ({ ...row, payload: JSON.parse(row.payloadJson || '{}') }))
    : [];
  const fileRows = listFilesForEvidence(evidenceIds);
  return {
    session: { id: session.id, projectId: session.projectId, name: session.name, createdAt: session.createdAt },
    items,
    links,
    evidence: withFiles(evidence, fileRows)
  };
}

function buildPreview(sessionId) {
  const payload = getSettlementPayload(sessionId);
  const evidence = payload.evidence;
  const files = listFilesForEvidence(evidence.map((record) => record.id), { exportOnly: true });
  return buildExportTree({
    sessionName: payload.session.name,
    items: payload.items,
    links: payload.links,
    evidence,
    files
  });
}

function withFiles(evidence, files) {
  const grouped = new Map();
  for (const file of files) {
    if (!grouped.has(file.evidenceId)) grouped.set(file.evidenceId, []);
    grouped.get(file.evidenceId).push(file);
  }
  return evidence.map((item) => ({ ...item, files: grouped.get(item.id) || [] }));
}

async function parseSpreadsheetFile(filePath, originalName = '') {
  if (originalName.toLowerCase().endsWith('.csv')) {
    const text = await fsp.readFile(filePath, 'utf8');
    return parseDelimitedTable(text);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { headers: [], rows: [] };

  const headers = [];
  worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell) => {
    headers.push(String(cell.value || '').trim());
  });

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const item = {};
    headers.forEach((header, index) => {
      const cell = row.getCell(index + 1);
      item[header] = cellToText(cell.value);
    });
    if (Object.values(item).some((value) => String(value).trim())) rows.push(item);
  });
  return { headers, rows };
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
