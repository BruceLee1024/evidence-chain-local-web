import { getDb, jsonPayload, nowIso, parsePayload, uid } from './db.js';
import { normalizeLocation } from './lib/matching.js';

export function createProject({ name, code = '', manager = '', locations = [] }) {
  const db = getDb();
  const id = uid('project');
  db.prepare('INSERT INTO projects (id, name, code, manager, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, code, manager, nowIso());
  for (const location of locations) addLocation(id, location);
  return getProject(id);
}

export function listProjects() {
  return getDb().prepare(`
    SELECT id, name, code, manager, created_at AS createdAt
    FROM projects ORDER BY created_at DESC
  `).all();
}

export function getProject(id) {
  return getDb().prepare(`
    SELECT id, name, code, manager, created_at AS createdAt
    FROM projects WHERE id = ?
  `).get(id);
}

export function addLocation(projectId, name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return null;
  const normalized = normalizeLocation(trimmed);
  const id = uid('loc');
  getDb().prepare(`
    INSERT OR IGNORE INTO locations (id, project_id, name, normalized_name, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, projectId, trimmed, normalized, nowIso());
  return { id, projectId, name: trimmed, normalizedName: normalized };
}

export function listLocations(projectId) {
  return getDb().prepare(`
    SELECT id, project_id AS projectId, name, normalized_name AS normalizedName, created_at AS createdAt
    FROM locations WHERE project_id = ? ORDER BY name
  `).all(projectId);
}

export function createEvidence(projectId, input) {
  const db = getDb();
  const id = uid('ev');
  const title = input.title || input.code || '未命名证据';
  const location = input.location || '';
  const normalizedLocation = normalizeLocation(location);

  db.prepare(`
    INSERT INTO evidence (
      id, project_id, type, code, title, location, normalized_location,
      evidence_date, end_date, amount, payload_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    projectId,
    input.type,
    input.code || '',
    title,
    location,
    normalizedLocation,
    input.evidenceDate || '',
    input.endDate || '',
    input.amount == null ? null : Number(input.amount),
    jsonPayload(input.payload || {}),
    nowIso()
  );

  if (location) addLocation(projectId, location);
  return getEvidence(id);
}

export function getEvidence(id) {
  const record = getDb().prepare(`
    SELECT id, project_id AS projectId, type, code, title, location,
      normalized_location AS normalizedLocation, evidence_date AS evidenceDate,
      end_date AS endDate, amount, payload_json AS payloadJson, created_at AS createdAt
    FROM evidence WHERE id = ?
  `).get(id);
  return hydrateEvidence(record);
}

export function listEvidence(projectId, type = '') {
  const rows = type
    ? getDb().prepare(`
        SELECT id, project_id AS projectId, type, code, title, location,
          normalized_location AS normalizedLocation, evidence_date AS evidenceDate,
          end_date AS endDate, amount, payload_json AS payloadJson, created_at AS createdAt
        FROM evidence WHERE project_id = ? AND type = ? ORDER BY evidence_date DESC, created_at DESC
      `).all(projectId, type)
    : getDb().prepare(`
        SELECT id, project_id AS projectId, type, code, title, location,
          normalized_location AS normalizedLocation, evidence_date AS evidenceDate,
          end_date AS endDate, amount, payload_json AS payloadJson, created_at AS createdAt
        FROM evidence WHERE project_id = ? ORDER BY evidence_date DESC, created_at DESC
      `).all(projectId);

  return rows.map(hydrateEvidence);
}

export function searchEvidence({ projectId = '', query = '', type = '' }) {
  const q = `%${query.trim()}%`;
  const clauses = [];
  const params = [];
  if (projectId) {
    clauses.push('project_id = ?');
    params.push(projectId);
  }
  if (type) {
    clauses.push('type = ?');
    params.push(type);
  }
  if (query.trim()) {
    clauses.push('(title LIKE ? OR code LIKE ? OR location LIKE ? OR payload_json LIKE ?)');
    params.push(q, q, q, q);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return getDb().prepare(`
    SELECT id, project_id AS projectId, type, code, title, location,
      normalized_location AS normalizedLocation, evidence_date AS evidenceDate,
      end_date AS endDate, amount, payload_json AS payloadJson, created_at AS createdAt
    FROM evidence ${where}
    ORDER BY evidence_date DESC, created_at DESC
    LIMIT 80
  `).all(...params).map(hydrateEvidence);
}

export function listFilesForEvidence(evidenceIds, { exportOnly = false } = {}) {
  if (!evidenceIds.length) return [];
  const placeholders = evidenceIds.map(() => '?').join(',');
  const roleFilter = exportOnly ? "AND ef.role != 'photo_original'" : '';
  return getDb().prepare(`
    SELECT ef.evidence_id AS evidenceId, ef.role, ef.sort_order AS sortOrder,
      f.id, f.project_id AS projectId, f.original_name AS originalName,
      f.stored_name AS storedName, f.path, f.mime_type AS mimeType, f.size, f.created_at AS createdAt
    FROM evidence_files ef
    JOIN files f ON f.id = ef.file_id
    WHERE ef.evidence_id IN (${placeholders}) ${roleFilter}
    ORDER BY ef.sort_order, f.created_at
  `).all(...evidenceIds);
}

export function createSettlementSession(projectId, name, items) {
  const db = getDb();
  const id = uid('session');
  db.prepare('INSERT INTO settlement_sessions (id, project_id, name, created_at) VALUES (?, ?, ?, ?)')
    .run(id, projectId, name, nowIso());

  for (const item of items) {
    const itemId = uid('item');
    db.prepare(`
      INSERT INTO settlement_items (
        id, session_id, row_number, name, location, normalized_location,
        start_date, end_date, amount, payload_json, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      itemId,
      id,
      item.rowNumber,
      item.name || `结算项${item.rowNumber}`,
      item.location || '',
      normalizeLocation(item.location || ''),
      item.startDate || '',
      item.endDate || '',
      item.amount || 0,
      jsonPayload(item.raw || {}),
      'unmatched',
      nowIso()
    );
  }

  return getSettlementSession(id);
}

export function getSettlementSession(id) {
  const session = getDb().prepare(`
    SELECT id, project_id AS projectId, name, created_at AS createdAt
    FROM settlement_sessions WHERE id = ?
  `).get(id);
  if (!session) return null;
  return {
    ...session,
    items: listSettlementItems(id)
  };
}

export function getSettlementSessionForProject(projectId, sessionId) {
  const session = getDb().prepare(`
    SELECT id, project_id AS projectId, name, created_at AS createdAt
    FROM settlement_sessions WHERE id = ? AND project_id = ?
  `).get(sessionId, projectId);
  if (!session) return null;
  return {
    ...session,
    items: listSettlementItems(session.id)
  };
}

export function listSettlementSessions(projectId) {
  return getDb().prepare(`
    SELECT id, project_id AS projectId, name, created_at AS createdAt
    FROM settlement_sessions WHERE project_id = ? ORDER BY created_at DESC
  `).all(projectId);
}

export function listSettlementItems(sessionId) {
  return getDb().prepare(`
    SELECT id, session_id AS sessionId, row_number AS rowNumber, name, location,
      normalized_location AS normalizedLocation, start_date AS startDate, end_date AS endDate,
      amount, payload_json AS payloadJson, status, created_at AS createdAt
    FROM settlement_items WHERE session_id = ? ORDER BY row_number
  `).all(sessionId).map((row) => ({ ...row, payload: parsePayload(row.payloadJson) }));
}

export function getSettlementItemForSession(sessionId, itemId) {
  const row = getDb().prepare(`
    SELECT id, session_id AS sessionId, row_number AS rowNumber, name, location,
      normalized_location AS normalizedLocation, start_date AS startDate, end_date AS endDate,
      amount, payload_json AS payloadJson, status, created_at AS createdAt
    FROM settlement_items WHERE session_id = ? AND id = ?
  `).get(sessionId, itemId);
  return row ? { ...row, payload: parsePayload(row.payloadJson) } : null;
}

export function getEvidenceForProject(projectId, evidenceId) {
  const record = getDb().prepare(`
    SELECT id, project_id AS projectId, type, code, title, location,
      normalized_location AS normalizedLocation, evidence_date AS evidenceDate,
      end_date AS endDate, amount, payload_json AS payloadJson, created_at AS createdAt
    FROM evidence WHERE project_id = ? AND id = ?
  `).get(projectId, evidenceId);
  return hydrateEvidence(record);
}

export function getEvidenceEmbedding(evidenceId, model, searchText) {
  const row = getDb().prepare(`
    SELECT embedding_json AS embeddingJson FROM evidence_embeddings
    WHERE evidence_id = ? AND model = ? AND search_text = ?
  `).get(evidenceId, model, searchText);
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.embeddingJson);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveEvidenceEmbedding({ evidenceId, model, searchText, embedding }) {
  const now = nowIso();
  getDb().prepare(`
    INSERT INTO evidence_embeddings (evidence_id, embedding_json, search_text, model, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(evidence_id) DO UPDATE SET
      embedding_json = excluded.embedding_json,
      search_text = excluded.search_text,
      model = excluded.model,
      updated_at = excluded.updated_at
  `).run(evidenceId, JSON.stringify(embedding || []), searchText, model, now, now);
}

export function insertSettlementLink({ itemId, evidenceId, confidence, matchKind, status, source }) {
  const id = uid('link');
  getDb().prepare(`
    INSERT INTO settlement_links (id, item_id, evidence_id, confidence, match_kind, status, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(item_id, evidence_id) DO UPDATE SET
      confidence = excluded.confidence,
      match_kind = excluded.match_kind,
      status = excluded.status,
      source = excluded.source
  `).run(id, itemId, evidenceId, confidence, matchKind, status, source, nowIso());
  updateItemStatus(itemId);
}

export function deleteSettlementLink(itemId, evidenceId) {
  getDb().prepare('DELETE FROM settlement_links WHERE item_id = ? AND evidence_id = ?').run(itemId, evidenceId);
  updateItemStatus(itemId);
}

export function listSettlementLinks(sessionId) {
  return getDb().prepare(`
    SELECT sl.id, sl.item_id AS itemId, sl.evidence_id AS evidenceId, sl.confidence,
      sl.match_kind AS matchKind, sl.status, sl.source, sl.created_at AS createdAt
    FROM settlement_links sl
    JOIN settlement_items si ON si.id = sl.item_id
    WHERE si.session_id = ?
    ORDER BY si.row_number, sl.status, sl.confidence DESC
  `).all(sessionId);
}

export function updateItemStatus(itemId) {
  const links = getDb().prepare('SELECT status FROM settlement_links WHERE item_id = ?').all(itemId);
  const confirmed = links.some((link) => link.status === 'auto' || link.status === 'manual');
  const candidate = links.some((link) => link.status === 'candidate');
  const status = confirmed && candidate ? 'partial' : confirmed ? 'matched' : candidate ? 'partial' : 'unmatched';
  getDb().prepare('UPDATE settlement_items SET status = ? WHERE id = ?').run(status, itemId);
}

export function getOverview(projectId) {
  const db = getDb();
  const counts = db.prepare(`
    SELECT type, COUNT(*) AS count FROM evidence
    WHERE project_id = ? GROUP BY type
  `).all(projectId).reduce((acc, row) => {
    acc[row.type] = row.count;
    return acc;
  }, {});
  return {
    counts,
    recentEvidence: listEvidence(projectId).slice(0, 8),
    sessions: listSettlementSessions(projectId).slice(0, 5),
    locations: listLocations(projectId).slice(0, 12)
  };
}

function hydrateEvidence(record) {
  if (!record) return null;
  return {
    ...record,
    payload: parsePayload(record.payloadJson)
  };
}
