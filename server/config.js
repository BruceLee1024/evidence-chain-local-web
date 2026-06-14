import path from 'node:path';

export const PORT = Number(process.env.PORT || 8787);
export const DATA_DIR = process.env.EVIDENCE_DATA_DIR || path.join(process.cwd(), 'data');
export const DB_PATH = path.join(DATA_DIR, 'evidence-chain.sqlite');
export const FILES_DIR = path.join(DATA_DIR, 'files');
export const TMP_DIR = path.join(DATA_DIR, 'tmp');
