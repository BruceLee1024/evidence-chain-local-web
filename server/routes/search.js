import { Router } from 'express';
import { buildAiConfig, createAiProvider } from '../ai/provider.js';
import { getAiSettings } from '../ai/settings.js';
import { rankEvidenceSemantically } from '../lib/semanticSearch.js';
import { listFilesForEvidence, searchEvidence } from '../repository.js';

export function createSearchRouter() {
  const router = Router();

  router.get('/', (req, res) => {
    const evidence = searchEvidence({
      projectId: req.query.projectId || '',
      query: req.query.q || '',
      type: req.query.type || ''
    });
    const files = listFilesForEvidence(evidence.map((item) => item.id));
    res.json(withFiles(evidence, files));
  });

  router.get('/semantic', async (req, res, next) => {
    try {
      const query = String(req.query.q || '').trim();
      const type = req.query.type || '';
      const projectId = req.query.projectId || '';
      const fallback = searchEvidence({ projectId, query, type });
      const config = buildAiConfig(process.env, getAiSettings());
      if (!query || !config.enabled || !config.features.has('semanticSearch')) {
        return res.json(keywordFallbackResults(fallback, query));
      }
      let ranked;
      try {
        ranked = await rankEvidenceSemantically({
          provider: createAiProvider(config),
          projectId,
          query,
          type,
          fallback,
          embeddingModel: config.embeddingModel
        });
      } catch {
        return res.json(keywordFallbackResults(fallback, query));
      }
      const files = listFilesForEvidence(ranked.map((item) => item.id));
      res.json(withFiles(ranked, files));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function keywordFallbackResults(evidence, query) {
  const files = listFilesForEvidence(evidence.map((item) => item.id));
  return withFiles(evidence, files).map((item, index) => ({
    ...item,
    semanticScore: query ? Math.max(45, 92 - index * 8) : 0,
    semanticFallback: true
  }));
}

function withFiles(evidence, files) {
  const grouped = new Map();
  for (const file of files) {
    if (!grouped.has(file.evidenceId)) grouped.set(file.evidenceId, []);
    grouped.get(file.evidenceId).push(file);
  }
  return evidence.map((item) => ({ ...item, files: grouped.get(item.id) || [] }));
}
