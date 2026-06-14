import fs from 'node:fs';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { DATA_DIR, DB_PATH } from './config.js';

let db;

export function getDb() {
  if (!db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA foreign_keys = ON;');
    migrate(db);
  }
  return db;
}

function migrate(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT,
      manager TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(project_id, normalized_name)
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      path TEXT NOT NULL,
      mime_type TEXT,
      size INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      code TEXT,
      title TEXT NOT NULL,
      location TEXT,
      normalized_location TEXT,
      evidence_date TEXT,
      end_date TEXT,
      amount REAL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evidence_files (
      evidence_id TEXT NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
      file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (evidence_id, file_id, role)
    );

    CREATE TABLE IF NOT EXISTS settlement_sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settlement_items (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES settlement_sessions(id) ON DELETE CASCADE,
      row_number INTEGER NOT NULL,
      name TEXT NOT NULL,
      location TEXT,
      normalized_location TEXT,
      start_date TEXT,
      end_date TEXT,
      amount REAL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settlement_links (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES settlement_items(id) ON DELETE CASCADE,
      evidence_id TEXT NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
      confidence INTEGER NOT NULL,
      match_kind TEXT NOT NULL,
      status TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(item_id, evidence_id)
    );
  `);
}

export function nowIso() {
  return new Date().toISOString();
}

export function uid(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function jsonPayload(value) {
  return JSON.stringify(value || {});
}

export function parsePayload(value) {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
