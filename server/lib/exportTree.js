import path from 'node:path';
import { normalizeLocation } from './matching.js';
import { evidenceLabel } from '../../shared/evidenceDomain.js';

export function buildExportTree({ sessionName, items, links, evidence, files }) {
  const evidenceById = new Map(evidence.map((record) => [record.id, record]));
  const filesByEvidenceId = groupBy(files, 'evidenceId');
  const confirmedStatuses = new Set(['auto', 'manual']);

  return {
    rootName: sanitizeSegment(sessionName || '结算证据包'),
    items: items.map((item, index) => {
      const itemLinks = links.filter((link) => link.itemId === item.id && confirmedStatuses.has(link.status));
      const itemFiles = itemLinks.flatMap((link) => {
        const record = evidenceById.get(link.evidenceId);
        if (!record) return [];
        return (filesByEvidenceId.get(link.evidenceId) || []).map((file) => ({
          sourcePath: file.path,
          exportName: buildExportName(record, file),
          role: file.role,
          evidenceTitle: record.title,
          evidenceType: record.type
        }));
      });

      return {
        itemId: item.id,
        folderName: buildItemFolderName(item, index),
        files: itemFiles
      };
    })
  };
}

export function buildItemFolderName(item, index) {
  const number = String(item.rowNumber || index + 1).padStart(2, '0');
  const name = sanitizeSegment(item.name || '未命名结算项');
  const location = sanitizeSegment(normalizeLocation(item.location || '未填部位'));
  return `${number}_${name}_${location}`;
}

function buildExportName(evidence, file) {
  const label = evidenceLabel(evidence.type, '证据');
  const title = sanitizeSegment(evidence.title || evidence.code || evidence.id);
  const originalName = sanitizeSegment(file.originalName || path.basename(file.path || '附件'));
  return `${label}_${title}_${originalName}`;
}

export function sanitizeSegment(value) {
  return String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, '')
    .slice(0, 90);
}

function groupBy(records, key) {
  const grouped = new Map();
  for (const record of records) {
    const value = record[key];
    if (!grouped.has(value)) grouped.set(value, []);
    grouped.get(value).push(record);
  }
  return grouped;
}
