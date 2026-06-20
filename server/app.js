import express from 'express';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { DATA_DIR, TMP_DIR } from './config.js';
import { getDb } from './db.js';
import { attachFileToEvidence, mapUploadFields, persistUpload } from './fileStore.js';
import { extractEvidenceDraft } from './ai/ocr.js';
import { buildAiConfig, createAiProvider, publicAiConfig } from './ai/provider.js';
import { getAiSettings, saveAiSettings } from './ai/settings.js';
import { rankEvidenceSemantically } from './lib/semanticSearch.js';
import { createSettlementRouter } from './routes/settlements.js';
import {
  addLocation,
  createEvidence,
  createProject,
  getOverview,
  getProject,
  listEvidence,
  listFilesForEvidence,
  listLocations,
  listProjects,
  searchEvidence
} from './repository.js';

fs.mkdirSync(TMP_DIR, { recursive: true });
getDb();

const upload = multer({ dest: TMP_DIR });
const app = express();

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, dataDir: DATA_DIR });
});

app.get('/api/projects', (_req, res) => {
  res.json(listProjects());
});

app.post('/api/projects', (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: '项目名称不能为空' });
  const locations = splitLocations(req.body.locations);
  res.status(201).json(createProject({ ...req.body, name, locations }));
});

app.get('/api/projects/:projectId/overview', requireProject, (req, res) => {
  res.json(getOverview(req.params.projectId));
});

app.get('/api/projects/:projectId/locations', requireProject, (req, res) => {
  res.json(listLocations(req.params.projectId));
});

app.post('/api/projects/:projectId/locations', requireProject, (req, res) => {
  const location = addLocation(req.params.projectId, req.body.name);
  res.status(201).json(location);
});

app.get('/api/projects/:projectId/evidence', requireProject, (req, res) => {
  const evidence = listEvidence(req.params.projectId, req.query.type || '');
  const fileRows = listFilesForEvidence(evidence.map((item) => item.id));
  res.json(withFiles(evidence, fileRows));
});

app.post('/api/projects/:projectId/variation-orders', requireProject, upload.array('attachments'), async (req, res, next) => {
  try {
    const evidence = createEvidence(req.params.projectId, {
      type: 'variation',
      code: req.body.code,
      title: req.body.reason || req.body.code || '签证变更单',
      location: req.body.location,
      evidenceDate: req.body.signDate,
      amount: req.body.amount,
      payload: {
        changeType: req.body.changeType,
        scheduleImpact: req.body.scheduleImpact === 'true',
        contractorSigner: req.body.contractorSigner,
        supervisorSigner: req.body.supervisorSigner,
        ownerSigner: req.body.ownerSigner,
        note: req.body.note
      }
    });

    await persistEvidenceFiles(req.params.projectId, evidence.id, { attachments: req.files || [] }, { attachments: 'attachment' });
    res.status(201).json(await getEvidenceWithFiles(evidence.id));
  } catch (error) {
    next(error);
  }
});

app.post(
  '/api/projects/:projectId/hidden-records',
  requireProject,
  upload.fields([
    { name: 'photos', maxCount: 30 },
    { name: 'watermarkedPhotos', maxCount: 30 },
    { name: 'acceptanceFile', maxCount: 1 }
  ]),
  async (req, res, next) => {
    try {
      const evidence = createEvidence(req.params.projectId, {
        type: 'hidden',
        title: req.body.process ? `${req.body.location || ''}${req.body.process}` : '隐蔽工程记录',
        location: req.body.location,
        evidenceDate: req.body.acceptanceDate,
        payload: {
          process: req.body.process,
          conclusion: req.body.conclusion,
          photographer: req.body.photographer,
          note: req.body.note
        }
      });

      const fields = mapUploadFields(req.files);
      await persistEvidenceFiles(req.params.projectId, evidence.id, fields, {
        photos: 'photo_original',
        watermarkedPhotos: 'watermarked',
        acceptanceFile: 'acceptance'
      });
      res.status(201).json(await getEvidenceWithFiles(evidence.id));
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/api/projects/:projectId/material-records',
  requireProject,
  upload.fields([
    { name: 'certificates', maxCount: 30 },
    { name: 'photos', maxCount: 30 }
  ]),
  async (req, res, next) => {
    try {
      const fields = mapUploadFields(req.files);
      const entryDate = String(req.body.entryDate || '').trim();
      const materialName = String(req.body.materialName || '').trim();
      const spec = String(req.body.spec || '').trim();
      const unit = String(req.body.unit || '').trim();
      const quantity = Number(req.body.quantity || 0);

      if (!entryDate) return await validationError(res, fields, '进场日期不能为空');
      if (!materialName) return await validationError(res, fields, '材料名称不能为空');
      if (!unit) return await validationError(res, fields, '单位不能为空');
      if (!Number.isFinite(quantity) || quantity <= 0) return await validationError(res, fields, '进场数量必须大于 0');
      if (!hasUpload(fields, ['certificates', 'photos'])) return await validationError(res, fields, '请至少上传合格证或验收照片');

      const evidence = createEvidence(req.params.projectId, {
        type: 'material',
        title: [materialName, spec].filter(Boolean).join(' '),
        location: '',
        evidenceDate: entryDate,
        amount: null,
        payload: {
          materialName,
          spec,
          unit,
          quantity,
          brand: req.body.brand,
          supplier: req.body.supplier,
          receiver: req.body.receiver,
          note: req.body.note
        }
      });

      await persistEvidenceFiles(req.params.projectId, evidence.id, fields, {
        certificates: 'certificate',
        photos: 'photo'
      });
      res.status(201).json(await getEvidenceWithFiles(evidence.id));
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/api/projects/:projectId/monthly-measurements',
  requireProject,
  upload.fields([
    { name: 'confirmFiles', maxCount: 30 },
    { name: 'detailFiles', maxCount: 30 }
  ]),
  async (req, res, next) => {
    try {
      const fields = mapUploadFields(req.files);
      const month = String(req.body.month || '').trim();
      const confirmDate = String(req.body.confirmDate || '').trim();
      const currentValue = Number(req.body.currentValue || 0);
      const cumulativeValue = Number(req.body.cumulativeValue || 0);

      if (!/^\d{4}-\d{2}$/.test(month)) return await validationError(res, fields, '计量月份格式必须为 YYYY-MM');
      if (!confirmDate) return await validationError(res, fields, '确认日期不能为空');
      if (!Number.isFinite(currentValue) || currentValue <= 0) return await validationError(res, fields, '本期完成产值必须大于 0');
      if (!Number.isFinite(cumulativeValue) || cumulativeValue <= 0) return await validationError(res, fields, '累计完成产值必须大于 0');

      const evidence = createEvidence(req.params.projectId, {
        type: 'monthly',
        title: `${month} 月度计量`,
        location: '',
        evidenceDate: confirmDate,
        amount: currentValue,
        payload: {
          month,
          confirmDate,
          currentValue,
          cumulativeValue,
          ownerSigner: req.body.ownerSigner,
          note: req.body.note
        }
      });

      await persistEvidenceFiles(req.params.projectId, evidence.id, fields, {
        confirmFiles: 'confirmation',
        detailFiles: 'detail'
      });
      res.status(201).json(await getEvidenceWithFiles(evidence.id));
    } catch (error) {
      next(error);
    }
  }
);

app.get('/api/search', (req, res) => {
  const evidence = searchEvidence({
    projectId: req.query.projectId || '',
    query: req.query.q || '',
    type: req.query.type || ''
  });
  const files = listFilesForEvidence(evidence.map((item) => item.id));
  res.json(withFiles(evidence, files));
});

app.get('/api/ai/status', (_req, res) => {
  res.json(publicAiConfig(currentAiConfig()));
});

app.get('/api/ai/settings', (_req, res) => {
  res.json(publicAiConfig(currentAiConfig()));
});

app.put('/api/ai/settings', (req, res) => {
  try {
    saveAiSettings(req.body || {});
    res.json(publicAiConfig(currentAiConfig()));
  } catch (error) {
    res.status(400).json({ error: error.message || 'AI 设置保存失败' });
  }
});

app.post('/api/ai/settings/test', async (req, res) => {
  try {
    const config = buildAiConfig(process.env, mergeAiSettingsForTest(req.body || {}));
    if (!config.enabled) return res.status(400).json({ error: 'AI 未配置：请填写 API Key 后再检查连通' });
    const result = await createAiProvider(config).testConnection();
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'AI 连通检查失败' });
  }
});

app.post('/api/ai/ocr/extract', upload.array('files', 30), async (req, res, next) => {
  try {
    const evidenceType = String(req.body.evidenceType || '').trim();
    if (!evidenceTypesForAi.has(evidenceType)) return res.status(400).json({ error: '证据类型不支持 AI 识别' });
    if (!req.files?.length) return res.status(400).json({ error: '请先上传需要识别的文件' });

    const config = currentAiConfig();
    if (!config.enabled) return res.status(400).json({ error: 'AI 未配置：请在基础设置或环境变量中配置国内模型 API Key' });
    const draft = await extractEvidenceDraft({
      evidenceType,
      uploads: req.files,
      provider: createAiProvider(config)
    });
    res.json(draft);
  } catch (error) {
    next(error);
  } finally {
    await Promise.all((req.files || []).map((file) => fsp.unlink(file.path).catch(() => {})));
  }
});

app.get('/api/search/semantic', async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim();
    const type = req.query.type || '';
    const projectId = req.query.projectId || '';
    const fallback = searchEvidence({ projectId, query, type });
    const config = currentAiConfig();
    if (!query || !config.enabled || !config.features.has('semanticSearch')) {
      const files = listFilesForEvidence(fallback.map((item) => item.id));
      return res.json(withFiles(fallback, files).map((item, index) => ({ ...item, semanticScore: query ? Math.max(45, 92 - index * 8) : 0, semanticFallback: true })));
    }
    const ranked = await rankEvidenceSemantically({
      provider: createAiProvider(config),
      projectId,
      query,
      type,
      fallback,
      embeddingModel: config.embeddingModel
    });
    const files = listFilesForEvidence(ranked.map((item) => item.id));
    res.json(withFiles(ranked, files));
  } catch (error) {
    next(error);
  }
});

app.post('/api/projects/:projectId/settlements/parse-paste', requireProject, (req, res) => {
  const table = parseDelimitedTable(req.body.text || '');
  res.json({ ...table, columns: inferColumns(table.headers) });
});

app.post('/api/projects/:projectId/settlements/parse-file', requireProject, upload.single('spreadsheet'), async (req, res, next) => {
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

app.post('/api/projects/:projectId/settlements', requireProject, (req, res) => {
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

app.get('/api/projects/:projectId/settlements', requireProject, (req, res) => {
  res.json(listSettlementSessions(req.params.projectId));
});

app.get('/api/projects/:projectId/settlements/:sessionId', requireProject, requireSettlementSession, (req, res) => {
  res.json(getSettlementPayload(req.params.sessionId));
});

app.post('/api/projects/:projectId/settlements/:sessionId/rematch-ai', requireProject, requireSettlementSession, async (req, res, next) => {
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

app.get('/api/projects/:projectId/settlements/:sessionId/check-completeness', requireProject, requireSettlementSession, (req, res) => {
  const payload = getSettlementPayload(req.params.sessionId);
  const allEvidence = listEvidence(req.params.projectId);
  res.json(checkSettlementCompleteness({
    items: payload.items,
    links: payload.links,
    evidence: allEvidence
  }));
});

app.post('/api/projects/:projectId/settlements/:sessionId/items/:itemId/links', requireProject, requireSettlementSession, requireSettlementItem, (req, res) => {
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

app.delete('/api/projects/:projectId/settlements/:sessionId/items/:itemId/links/:evidenceId', requireProject, requireSettlementSession, requireSettlementItem, (req, res) => {
  const evidence = getEvidenceForProject(req.params.projectId, req.params.evidenceId);
  if (!evidence) return res.status(404).json({ error: '证据不存在' });
  deleteSettlementLink(req.params.itemId, req.params.evidenceId);
  res.json(getSettlementPayload(req.params.sessionId));
});

app.post(
  '/api/projects/:projectId/settlements/:sessionId/items/:itemId/supplemental',
  requireProject,
  requireSettlementSession,
  requireSettlementItem,
  upload.array('attachments'),
  async (req, res, next) => {
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
  }
);

app.get('/api/projects/:projectId/settlements/:sessionId/preview', requireProject, requireSettlementSession, (req, res) => {
  res.json(buildPreview(req.params.sessionId));
});

app.get('/api/projects/:projectId/settlements/:sessionId/export.zip', requireProject, requireSettlementSession, async (req, res, next) => {
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

const distDir = path.join(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message || '服务器错误' });
});

export function createApp() {
  return app;
}

function requireProject(req, res, next) {
  if (!getProject(req.params.projectId)) return res.status(404).json({ error: '项目不存在' });
  next();
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

async function getEvidenceWithFiles(evidenceId) {
  const evidence = listEvidence('').find((item) => item.id === evidenceId);
  if (!evidence) {
    const row = getDb().prepare(`
      SELECT project_id AS projectId FROM evidence WHERE id = ?
    `).get(evidenceId);
    const fallback = listEvidence(row.projectId).find((item) => item.id === evidenceId);
    return withFiles([fallback], listFilesForEvidence([evidenceId]))[0];
  }
  return withFiles([evidence], listFilesForEvidence([evidenceId]))[0];
}

function withFiles(evidence, files) {
  const grouped = new Map();
  for (const file of files) {
    if (!grouped.has(file.evidenceId)) grouped.set(file.evidenceId, []);
    grouped.get(file.evidenceId).push(file);
  }
  return evidence.map((item) => ({ ...item, files: grouped.get(item.id) || [] }));
}

const evidenceTypesForAi = new Set(['variation', 'hidden', 'material', 'monthly']);

function currentAiConfig() {
  return buildAiConfig(process.env, getAiSettings());
}

function mergeAiSettingsForTest(input) {
  const saved = getAiSettings();
  return {
    ...saved,
    ...input,
    apiKey: input.apiKey || saved.apiKey || '',
    features: input.features || saved.features
  };
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
  const evidence = listEvidence(projectId).filter((record) => ['variation', 'hidden', 'material', 'monthly'].includes(record.type));
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

function splitLocations(value) {
  if (Array.isArray(value)) return value;
  return String(value || '')
    .split(/\r?\n|,|，/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function validationError(res, fields, message) {
  await discardUploads(fields);
  return res.status(400).json({ error: message });
}

function hasUpload(fields, names) {
  return names.some((name) => (fields[name] || []).length > 0);
}

async function discardUploads(fields = {}) {
  const uploads = Object.values(fields).flat();
  await Promise.all(uploads.map((file) => fsp.unlink(file.path).catch(() => {})));
}
