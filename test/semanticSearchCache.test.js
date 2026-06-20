import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let dataDir;
let repository;
let semanticSearch;

async function loadFreshModules() {
  vi.resetModules();
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'evidence-semantic-'));
  process.env.EVIDENCE_DATA_DIR = dataDir;
  repository = await import('../server/repository.js');
  semanticSearch = await import('../server/lib/semanticSearch.js');
}

describe('rankEvidenceSemantically', () => {
  beforeEach(async () => {
    await loadFreshModules();
  });

  afterEach(async () => {
    await fsp.rm(dataDir, { recursive: true, force: true });
    delete process.env.EVIDENCE_DATA_DIR;
  });

  it('reuses cached evidence embeddings for the same model and search text', async () => {
    const project = repository.createProject({ name: '语义搜索项目' });
    repository.createEvidence(project.id, {
      type: 'hidden',
      title: '目标隐蔽验收',
      location: '3#楼地下室底板',
      evidenceDate: '2026-06-15'
    });
    repository.createEvidence(project.id, {
      type: 'material',
      title: '钢筋合格证',
      evidenceDate: '2026-06-16',
      payload: { materialName: 'HRB400 钢筋' }
    });
    const provider = {
      embed: vi.fn(async (text) => (String(text).includes('目标') || String(text).includes('查询') ? [1, 0] : [0, 1]))
    };

    await semanticSearch.rankEvidenceSemantically({
      provider,
      projectId: project.id,
      query: '查询目标资料',
      type: '',
      fallback: [],
      embeddingModel: 'text-embedding-test'
    });
    expect(provider.embed).toHaveBeenCalledTimes(3);

    await semanticSearch.rankEvidenceSemantically({
      provider,
      projectId: project.id,
      query: '查询目标资料',
      type: '',
      fallback: [],
      embeddingModel: 'text-embedding-test'
    });

    expect(provider.embed).toHaveBeenCalledTimes(4);
  });
});
