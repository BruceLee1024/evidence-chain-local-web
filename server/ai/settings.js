import { getDb, nowIso } from '../db.js';
import { DOMESTIC_PROVIDERS } from './provider.js';

const DEFAULT_ID = 'default';

export function getAiSettings() {
  const row = getDb().prepare(`
    SELECT provider, api_key AS apiKey, base_url AS baseUrl, model,
      vision_model AS visionModel, embedding_model AS embeddingModel,
      supports_vision AS supportsVision, features_json AS featuresJson,
      timeout_ms AS timeoutMs
    FROM ai_settings WHERE id = ?
  `).get(DEFAULT_ID);
  if (!row) return {};
  const providerDefaults = DOMESTIC_PROVIDERS[row.provider] || {};
  return {
    ...row,
    baseUrl: row.provider === 'deepseek' && row.baseUrl === 'https://api.deepseek.com/v1' ? providerDefaults.baseUrl : row.baseUrl,
    model: row.provider === 'deepseek' && row.model === 'deepseek-chat' ? providerDefaults.model : row.model,
    visionModel: row.provider === 'deepseek' && row.visionModel === 'deepseek-chat' ? providerDefaults.model : row.visionModel,
    embeddingModel: row.provider === 'deepseek' && row.embeddingModel === 'deepseek-chat' ? providerDefaults.model : row.embeddingModel,
    supportsVision: row.supportsVision === 1,
    features: parseJsonArray(row.featuresJson)
  };
}

export function saveAiSettings(input = {}) {
  const provider = String(input.provider || '').trim().toLowerCase();
  if (!DOMESTIC_PROVIDERS[provider]) {
    throw new Error(`不支持的 AI 服务商：${provider || '未选择'}`);
  }

  const current = getAiSettings();
  const defaults = DOMESTIC_PROVIDERS[provider];
  const apiKey = input.clearApiKey ? '' : String(input.apiKey || current.apiKey || '').trim();
  const features = normalizeFeatures(input.features);
  const supportsVision = input.supportsVision === true || input.supportsVision === 'true';
  const now = nowIso();

  getDb().prepare(`
    INSERT INTO ai_settings (
      id, provider, api_key, base_url, model, vision_model, embedding_model,
      supports_vision, features_json, timeout_ms, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      provider = excluded.provider,
      api_key = excluded.api_key,
      base_url = excluded.base_url,
      model = excluded.model,
      vision_model = excluded.vision_model,
      embedding_model = excluded.embedding_model,
      supports_vision = excluded.supports_vision,
      features_json = excluded.features_json,
      timeout_ms = excluded.timeout_ms,
      updated_at = excluded.updated_at
  `).run(
    DEFAULT_ID,
    provider,
    apiKey,
    String(input.baseUrl || defaults.baseUrl).trim(),
    String(input.model || defaults.model).trim(),
    String(input.visionModel || defaults.visionModel || input.model || defaults.model).trim(),
    String(input.embeddingModel || defaults.embeddingModel || input.model || defaults.model).trim(),
    supportsVision ? 1 : 0,
    JSON.stringify(features),
    Number(input.timeoutMs || 15000),
    now
  );

  return getAiSettings();
}

function normalizeFeatures(value) {
  const allowed = ['ocr', 'semanticSearch', 'matching', 'completeness'];
  if (!Array.isArray(value)) return allowed;
  const selected = value.filter((item) => allowed.includes(item));
  return selected.length ? selected : allowed;
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
