import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let dataDir;
let server;
let baseUrl;
let api;
let repository;

async function startTestServer() {
  vi.resetModules();
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'evidence-boundary-'));
  process.env.EVIDENCE_DATA_DIR = dataDir;
  const appModule = await import('../server/app.js');
  repository = await import('../server/repository.js');
  server = http.createServer(appModule.createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
  api = {
    post: (url, body) => request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    get: (url) => request(url),
    delete: (url) => request(url, { method: 'DELETE' })
  };
}

async function request(url, options = {}) {
  const response = await fetch(`${baseUrl}${url}`, options);
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}

async function createProject(name) {
  const response = await api.post('/api/projects', { name });
  expect(response.status).toBe(201);
  return response.payload;
}

async function createSettlement(projectId) {
  const response = await api.post(`/api/projects/${projectId}/settlements`, {
    name: '2026年6月结算',
    rows: [
      {
        清单名称: '底板混凝土',
        部位: '3#楼地下室底板',
        开始日期: '2026-06-01',
        结束日期: '2026-06-30',
        金额: '120000'
      }
    ],
    columns: {
      name: '清单名称',
      location: '部位',
      startDate: '开始日期',
      endDate: '结束日期',
      amount: '金额'
    }
  });
  expect(response.status).toBe(201);
  return response.payload;
}

describe('settlement route project boundaries', () => {
  beforeEach(async () => {
    await startTestServer();
  });

  afterEach(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await fsp.rm(dataDir, { recursive: true, force: true });
    delete process.env.EVIDENCE_DATA_DIR;
  });

  it('returns 404 when a settlement session belongs to another project', async () => {
    const projectA = await createProject('A 项目');
    const projectB = await createProject('B 项目');
    const settlement = await createSettlement(projectA.id);

    const response = await api.get(`/api/projects/${projectB.id}/settlements/${settlement.session.id}`);

    expect(response.status).toBe(404);
    expect(response.payload.error).toBe('结算批次不存在');
  });

  it('rejects linking evidence from another project into the current settlement', async () => {
    const projectA = await createProject('A 项目');
    const projectB = await createProject('B 项目');
    const settlement = await createSettlement(projectA.id);
    const foreignEvidence = repository.createEvidence(projectB.id, {
      type: 'hidden',
      title: 'B 项目隐蔽验收',
      location: '1#楼',
      evidenceDate: '2026-06-15'
    });

    const response = await api.post(
      `/api/projects/${projectA.id}/settlements/${settlement.session.id}/items/${settlement.items[0].id}/links`,
      { evidenceId: foreignEvidence.id }
    );

    expect(response.status).toBe(404);
    expect(response.payload.error).toBe('证据不存在');
  });

  it('does not delete a link through a project that does not own the session', async () => {
    const projectA = await createProject('A 项目');
    const projectB = await createProject('B 项目');
    const settlement = await createSettlement(projectA.id);
    const evidence = repository.createEvidence(projectA.id, {
      type: 'hidden',
      title: 'A 项目隐蔽验收',
      location: '3#楼地下室底板',
      evidenceDate: '2026-06-15'
    });
    repository.insertSettlementLink({
      itemId: settlement.items[0].id,
      evidenceId: evidence.id,
      confidence: 100,
      matchKind: '测试关联',
      status: 'manual',
      source: 'manual'
    });

    const response = await api.delete(
      `/api/projects/${projectB.id}/settlements/${settlement.session.id}/items/${settlement.items[0].id}/links/${evidence.id}`
    );
    const links = repository.listSettlementLinks(settlement.session.id);

    expect(response.status).toBe(404);
    expect(links).toHaveLength(1);
  });
});

describe('settlement spreadsheet uploads', () => {
  beforeEach(async () => {
    await startTestServer();
  });

  afterEach(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await fsp.rm(dataDir, { recursive: true, force: true });
    delete process.env.EVIDENCE_DATA_DIR;
  });

  it('cleans the temporary upload when spreadsheet parsing fails', async () => {
    const project = await createProject('上传测试项目');
    const formData = new FormData();
    formData.append('spreadsheet', new Blob(['not a workbook']), 'broken.xlsx');

    const response = await fetch(`${baseUrl}/api/projects/${project.id}/settlements/parse-file`, {
      method: 'POST',
      body: formData
    });
    const tmpDir = path.join(dataDir, 'tmp');
    const remainingTmpFiles = fs.existsSync(tmpDir) ? await fsp.readdir(tmpDir) : [];

    expect(response.status).toBe(500);
    expect(remainingTmpFiles).toEqual([]);
  });
});
