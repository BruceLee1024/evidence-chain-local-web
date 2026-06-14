import fs from 'node:fs/promises';
import path from 'node:path';
import { FILES_DIR } from './config.js';
import { getDb, nowIso, uid } from './db.js';
import { sanitizeSegment } from './lib/exportTree.js';

export async function persistUpload(projectId, upload) {
  const id = uid('file');
  const safeName = sanitizeSegment(upload.originalname || 'attachment');
  const storedName = `${id}_${safeName}`;
  const projectDir = path.join(FILES_DIR, projectId);
  const targetPath = path.join(projectDir, storedName);

  await fs.mkdir(projectDir, { recursive: true });
  await fs.rename(upload.path, targetPath);

  const db = getDb();
  db.prepare(`
    INSERT INTO files (id, project_id, original_name, stored_name, path, mime_type, size, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, projectId, upload.originalname || safeName, storedName, targetPath, upload.mimetype || '', upload.size || 0, nowIso());

  return getFileById(id);
}

export function getFileById(id) {
  return getDb().prepare(`
    SELECT id, project_id AS projectId, original_name AS originalName, stored_name AS storedName,
      path, mime_type AS mimeType, size, created_at AS createdAt
    FROM files WHERE id = ?
  `).get(id);
}

export function attachFileToEvidence(evidenceId, fileId, role, sortOrder = 0) {
  getDb().prepare(`
    INSERT OR REPLACE INTO evidence_files (evidence_id, file_id, role, sort_order)
    VALUES (?, ?, ?, ?)
  `).run(evidenceId, fileId, role, sortOrder);
}

export function mapUploadFields(files = {}) {
  const mapped = {};
  for (const [key, value] of Object.entries(files)) {
    mapped[key] = Array.isArray(value) ? value : [value];
  }
  return mapped;
}
