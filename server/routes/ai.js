import fsp from 'node:fs/promises';
import { Router } from 'express';
import { buildProjectAssistantContext, runAssistantChat } from '../ai/assistant.js';
import { extractEvidenceDraft } from '../ai/ocr.js';
import { buildAiConfig, createAiProvider, publicAiConfig } from '../ai/provider.js';
import { getAiSettings, saveAiSettings } from '../ai/settings.js';
import { getOverview, getProject } from '../repository.js';
import { EVIDENCE_TYPES_FOR_AI } from '../../shared/evidenceDomain.js';

export function createAiRouter(upload) {
  const router = Router();

  router.get('/status', (_req, res) => {
    res.json(publicAiConfig(currentAiConfig()));
  });

  router.get('/settings', (_req, res) => {
    res.json(publicAiConfig(currentAiConfig()));
  });

  router.put('/settings', (req, res) => {
    try {
      saveAiSettings(req.body || {});
      res.json(publicAiConfig(currentAiConfig()));
    } catch (error) {
      res.status(400).json({ error: error.message || 'AI 设置保存失败' });
    }
  });

  router.post('/settings/test', async (req, res) => {
    try {
      const config = buildAiConfig(process.env, mergeAiSettingsForTest(req.body || {}));
      if (!config.enabled) return res.status(400).json({ error: 'AI 未配置：请填写 API Key 后再检查连通' });
      const result = await createAiProvider(config).testConnection();
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message || 'AI 连通检查失败' });
    }
  });

  router.post('/assistant/chat', async (req, res, next) => {
    try {
      const projectId = String(req.body.projectId || '').trim();
      const project = getProject(projectId);
      if (!project) return res.status(404).json({ error: '项目不存在' });

      const config = currentAiConfig();
      if (!config.enabled) return res.status(400).json({ error: 'AI 未配置：请在基础设置或环境变量中配置国内模型 API Key' });

      const result = await runAssistantChat({
        provider: createAiProvider(config),
        config,
        projectContext: buildProjectAssistantContext({
          project,
          overview: getOverview(projectId)
        }),
        currentPage: req.body.currentPage,
        currentEvidenceType: req.body.currentEvidenceType,
        messages: req.body.messages || []
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/ocr/extract', upload.array('files', 30), async (req, res, next) => {
    try {
      const evidenceType = String(req.body.evidenceType || '').trim();
      if (!EVIDENCE_TYPES_FOR_AI.has(evidenceType)) return res.status(400).json({ error: '证据类型不支持 AI 识别' });
      if (!req.files?.length) return res.status(400).json({ error: '请先上传需要识别的文件' });

      const config = currentAiConfig();
      if (!config.enabled) return res.status(400).json({ error: 'AI 未配置：请在基础设置或环境变量中配置国内模型 API Key' });
      const draft = await extractEvidenceDraft({
        evidenceType,
        uploads: req.files,
        provider: createAiProvider(config)
      });
      res.json(draft);
    } catch (error) {
      next(error);
    } finally {
      await Promise.all((req.files || []).map((file) => fsp.unlink(file.path).catch(() => {})));
    }
  });

  return router;
}

function currentAiConfig() {
  return buildAiConfig(process.env, getAiSettings());
}

function mergeAiSettingsForTest(input) {
  const saved = getAiSettings();
  return {
    ...saved,
    ...input,
    apiKey: input.apiKey || saved.apiKey || '',
    features: input.features || saved.features
  };
}
