import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { TMP_DIR } from './config.js';
import { getDb } from './db.js';
import { createAiRouter } from './routes/ai.js';
import { createEvidenceRouter } from './routes/evidence.js';
import { createProjectRouter, requireProject } from './routes/projects.js';
import { createSearchRouter } from './routes/search.js';
import { createSettlementRouter } from './routes/settlements.js';

fs.mkdirSync(TMP_DIR, { recursive: true });
getDb();

const upload = multer({
  dest: TMP_DIR,
  limits: { fileSize: 50 * 1024 * 1024 }
});
const app = express();

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', createProjectRouter());
app.use('/api', createEvidenceRouter(upload));
app.use('/api/search', createSearchRouter());
app.use('/api/ai', createAiRouter(upload));
app.use('/api/projects/:projectId', requireProject, createSettlementRouter(upload));

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
