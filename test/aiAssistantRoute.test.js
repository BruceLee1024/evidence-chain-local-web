import fsp from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let dataDir;
let server;
let baseUrl;
let repository;
let fakeAiServer;
let fakeAiBaseUrl;

async function startTestServer(env = {}) {
  vi.resetModules();
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'evidence-assistant-route-'));
  process.env.EVIDENCE_DATA_DIR = dataDir;
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
  const appModule = await import('../server/app.js');
  repository = await import('../server/repository.js');
  server = http.createServer(appModule.createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
}

async function startFakeAiServer(content) {
  fakeAiServer = http.createServer((req, res) => {
    if (req.url !== '/chat/completions') {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }));
  });
  await new Promise((resolve) => fakeAiServer.listen(0, '127.0.0.1', resolve));
  const { port } = fakeAiServer.address();
  fakeAiBaseUrl = `http://127.0.0.1:${port}`;
}

async function request(pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}

describe('AI assistant chat route', () => {
  afterEach(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (fakeAiServer) await new Promise((resolve) => fakeAiServer.close(resolve));
    if (dataDir) await fsp.rm(dataDir, { recursive: true, force: true });
    delete process.env.EVIDENCE_DATA_DIR;
    delete process.env.AI_PROVIDER;
    delete process.env.AI_BASE_URL;
    delete process.env.AI_RETRY_DELAY_MS;
    server = null;
    fakeAiServer = null;
    dataDir = null;
  });

  it('returns a clear error when AI is not configured', async () => {
    await startTestServer();
    const project = repository.createProject({ name: '未配置 AI 项目' });

    const response = await request('/api/ai/assistant/chat', {
      projectId: project.id,
      currentPage: 'dashboard',
      messages: [{ role: 'user', content: '帮我看看当前证据情况' }]
    });

    expect(response.status).toBe(400);
    expect(response.payload.error).toContain('AI 未配置');
  });

  it('returns a sanitized reply and evidence draft for the selected project', async () => {
    await startFakeAiServer({
      reply: '可以先补一条材料进场记录。',
      basis: 'project',
      draft: {
        type: 'material',
        fields: {
          entryDate: '2026-06-21',
          materialName: 'HRB400 钢筋',
          quantity: '120',
          amount: 999999,
          unknownField: 'remove me'
        },
        confidence: 91,
        warnings: ['请核对合格证附件']
      }
    });
    await startTestServer({
      AI_PROVIDER: 'ollama',
      AI_BASE_URL: fakeAiBaseUrl,
      AI_RETRY_DELAY_MS: '0'
    });
    const project = repository.createProject({ name: '助手测试项目', code: 'AI-001' });
    repository.createEvidence(project.id, {
      type: 'hidden',
      title: '地下室底板隐蔽验收',
      location: '3#楼地下室底板',
      evidenceDate: '2026-06-15'
    });

    const response = await request('/api/ai/assistant/chat', {
      projectId: project.id,
      currentPage: 'evidence',
      messages: [{ role: 'user', content: '帮我生成钢筋材料进场草稿' }]
    });

    expect(response.status).toBe(200);
    expect(response.payload).toMatchObject({
      reply: '可以先补一条材料进场记录。',
      basis: 'project',
      provider: 'ollama',
      draft: {
        type: 'material',
        fields: {
          entryDate: '2026-06-21',
          materialName: 'HRB400 钢筋',
          quantity: 120
        }
      }
    });
    expect(response.payload.draft.fields).not.toHaveProperty('amount');
    expect(response.payload.draft.fields).not.toHaveProperty('unknownField');
  });
});
