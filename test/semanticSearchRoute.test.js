import fsp from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let dataDir;
let server;
let baseUrl;
let repository;

async function startTestServer() {
  vi.resetModules();
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'evidence-semantic-route-'));
  process.env.EVIDENCE_DATA_DIR = dataDir;
  process.env.AI_PROVIDER = 'ollama';
  process.env.AI_BASE_URL = 'http://127.0.0.1:9';
  process.env.AI_FEATURES = 'semanticSearch';
  process.env.AI_RETRY_DELAY_MS = '0';
  const appModule = await import('../server/app.js');
  repository = await import('../server/repository.js');
  server = http.createServer(appModule.createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
}

describe('semantic search route fallback', () => {
  beforeEach(async () => {
    await startTestServer();
  });

  afterEach(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await fsp.rm(dataDir, { recursive: true, force: true });
    delete process.env.EVIDENCE_DATA_DIR;
    delete process.env.AI_PROVIDER;
    delete process.env.AI_BASE_URL;
    delete process.env.AI_FEATURES;
    delete process.env.AI_RETRY_DELAY_MS;
  });

  it('returns keyword fallback results when semantic embedding fails', async () => {
    const project = repository.createProject({ name: '语义降级项目' });
    repository.createEvidence(project.id, {
      type: 'hidden',
      title: '地下室底板隐蔽验收',
      location: '3#楼',
      evidenceDate: '2026-06-20'
    });

    const response = await fetch(`${baseUrl}/api/search/semantic?projectId=${project.id}&q=${encodeURIComponent('地下室')}`);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toHaveLength(1);
    expect(payload[0]).toMatchObject({
      title: '地下室底板隐蔽验收',
      semanticFallback: true
    });
  });
});
