export const DOMESTIC_PROVIDERS = {
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
    modelOptions: [
      { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
      { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' }
    ],
    supportsVision: false
  },
  qwen: {
    label: '通义千问 / 百炼',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    visionModel: 'qwen-vl-plus',
    embeddingModel: 'text-embedding-v3',
    modelOptions: [
      { value: 'qwen-plus', label: '通义千问 Plus' },
      { value: 'qwen-max', label: '通义千问 Max' },
      { value: 'qwen-turbo', label: '通义千问 Turbo' }
    ],
    visionModelOptions: [
      { value: 'qwen-vl-plus', label: '通义千问 VL Plus' },
      { value: 'qwen-vl-max', label: '通义千问 VL Max' }
    ],
    embeddingModelOptions: [
      { value: 'text-embedding-v3', label: 'Text Embedding v3' },
      { value: 'text-embedding-v4', label: 'Text Embedding v4' }
    ],
    supportsVision: true
  },
  kimi: {
    label: 'Kimi / Moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    modelOptions: [
      { value: 'moonshot-v1-8k', label: 'Moonshot v1 8K' },
      { value: 'moonshot-v1-32k', label: 'Moonshot v1 32K' },
      { value: 'moonshot-v1-128k', label: 'Moonshot v1 128K' }
    ],
    supportsVision: false
  },
  zhipu: {
    label: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    visionModel: 'glm-4v-flash',
    embeddingModel: 'embedding-3',
    modelOptions: [
      { value: 'glm-4-flash', label: 'GLM-4 Flash' },
      { value: 'glm-4-plus', label: 'GLM-4 Plus' }
    ],
    visionModelOptions: [
      { value: 'glm-4v-flash', label: 'GLM-4V Flash' },
      { value: 'glm-4v-plus', label: 'GLM-4V Plus' }
    ],
    embeddingModelOptions: [
      { value: 'embedding-3', label: 'Embedding-3' }
    ],
    supportsVision: true
  },
  qianfan: {
    label: '百度千帆',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    model: 'ernie-4.0-turbo-8k',
    embeddingModel: 'bge-large-zh',
    modelOptions: [
      { value: 'ernie-4.0-turbo-8k', label: 'ERNIE 4.0 Turbo 8K' },
      { value: 'ernie-4.0-8k', label: 'ERNIE 4.0 8K' }
    ],
    embeddingModelOptions: [
      { value: 'bge-large-zh', label: 'BGE Large ZH' }
    ],
    supportsVision: false
  },
  volcengine: {
    label: '火山方舟 / 豆包',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-seed-1-6',
    embeddingModel: 'doubao-embedding-text-240715',
    modelOptions: [
      { value: 'doubao-seed-1-6', label: 'Doubao Seed 1.6' },
      { value: 'doubao-seed-1-6-flash', label: 'Doubao Seed 1.6 Flash' }
    ],
    embeddingModelOptions: [
      { value: 'doubao-embedding-text-240715', label: 'Doubao Embedding Text' }
    ],
    supportsVision: false
  },
  ollama: {
    label: 'Ollama 本地模型',
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'qwen2.5',
    embeddingModel: 'nomic-embed-text',
    modelOptions: [
      { value: 'qwen2.5', label: 'qwen2.5' },
      { value: 'deepseek-r1', label: 'deepseek-r1' },
      { value: 'llama3.1', label: 'llama3.1' }
    ],
    embeddingModelOptions: [
      { value: 'nomic-embed-text', label: 'nomic-embed-text' }
    ],
    supportsVision: false
  }
};

export function buildAiConfig(env = process.env, savedSettings = {}) {
  const provider = String(savedSettings.provider || env.AI_PROVIDER || 'deepseek').trim().toLowerCase();
  const defaults = DOMESTIC_PROVIDERS[provider];
  if (!defaults) {
    return {
      provider,
      enabled: false,
      error: `不支持的 AI 服务商：${provider}`
    };
  }

  return {
    provider,
    label: defaults.label,
    enabled: Boolean(savedSettings.apiKey || env.AI_API_KEY || provider === 'ollama'),
    apiKey: savedSettings.apiKey || env.AI_API_KEY || '',
    baseUrl: trimTrailingSlash(savedSettings.baseUrl || env.AI_BASE_URL || defaults.baseUrl),
    model: savedSettings.model || env.AI_MODEL || defaults.model,
    visionModel: savedSettings.visionModel || env.AI_VISION_MODEL || defaults.visionModel || savedSettings.model || env.AI_MODEL || defaults.model,
    embeddingModel: savedSettings.embeddingModel || env.AI_EMBEDDING_MODEL || defaults.embeddingModel || savedSettings.model || env.AI_MODEL || defaults.model,
    supportsVision: normalizeSupportsVision(savedSettings.supportsVision, env.AI_SUPPORTS_VISION, defaults.supportsVision),
    timeoutMs: Number(savedSettings.timeoutMs || env.AI_TIMEOUT_MS || 15000),
    features: parseFeatures(savedSettings.features || env.AI_FEATURES)
  };
}

export function supportedAiProviders() {
  return Object.entries(DOMESTIC_PROVIDERS).map(([id, provider]) => ({
    id,
    label: provider.label,
    baseUrl: provider.baseUrl,
    model: provider.model,
    visionModel: provider.visionModel || provider.model,
    embeddingModel: provider.embeddingModel || provider.model,
    modelOptions: provider.modelOptions || modelOptionsFrom(provider.model),
    visionModelOptions: provider.visionModelOptions || provider.modelOptions || modelOptionsFrom(provider.visionModel || provider.model),
    embeddingModelOptions: provider.embeddingModelOptions || provider.modelOptions || modelOptionsFrom(provider.embeddingModel || provider.model),
    supportsVision: provider.supportsVision
  }));
}

export function publicAiConfig(config) {
  return {
    enabled: config.enabled,
    provider: config.provider,
    label: config.label,
    model: config.model,
    visionModel: config.visionModel,
    embeddingModel: config.embeddingModel,
    baseUrl: config.baseUrl,
    supportsVision: config.supportsVision,
    timeoutMs: config.timeoutMs,
    features: [...config.features],
    apiKeySet: Boolean(config.apiKey),
    apiKeyMasked: maskApiKey(config.apiKey),
    providers: supportedAiProviders(),
    error: config.error || ''
  };
}

export function createAiProvider(config = buildAiConfig()) {
  if (!DOMESTIC_PROVIDERS[config.provider]) {
    throw new Error(`不支持的 AI 服务商：${config.provider}`);
  }
  return new CompatibleAiProvider(config);
}

export class CompatibleAiProvider {
  constructor(config) {
    this.config = config;
  }

  async extractEvidenceFields({ evidenceType, prompt, files = [] }) {
    const messages = [
      {
        role: 'system',
        content: '你是建筑工程结算证据录入助手。只返回 JSON，不要输出解释。'
      },
      {
        role: 'user',
        content: buildUserContent(prompt, files, this.config.supportsVision)
      }
    ];
    const payload = await this.chatJson({
      messages,
      model: files.some((file) => file.kind === 'image') ? this.config.visionModel : this.config.model
    });
    return { evidenceType, ...payload };
  }

  async judgeEvidenceMatch({ item, evidence }) {
    return this.chatJson({
      messages: [
        {
          role: 'system',
          content: '你是建筑工程结算证据审核助手。判断证据是否可能支撑结算项，只返回 JSON。'
        },
        {
          role: 'user',
          content:
            `结算项：${item.name || ''}\n` +
            `部位：${item.location || ''}\n` +
            `时段：${item.startDate || ''} 至 ${item.endDate || ''}\n\n` +
            `证据类型：${evidence.type || ''}\n` +
            `证据标题：${evidence.title || ''}\n` +
            `证据部位：${evidence.location || ''}\n` +
            `证据日期：${evidence.evidenceDate || ''}\n` +
            `证据摘要：${JSON.stringify(evidence.payload || {})}\n\n` +
            '返回 JSON：{"relevant":true/false,"confidence":0-100,"reason":"简短说明"}'
        }
      ],
      model: this.config.model
    });
  }

  async embed(text) {
    const response = await this.request('/embeddings', {
      model: this.config.embeddingModel,
      input: String(text || '')
    });
    return response?.data?.[0]?.embedding || [];
  }

  async testConnection() {
    const startedAt = Date.now();
    await this.request('/chat/completions', {
      model: this.config.model,
      messages: [
        {
          role: 'user',
          content: 'ping'
        }
      ],
      max_tokens: 8,
      stream: false
    });
    return {
      ok: true,
      provider: this.config.provider,
      model: this.config.model,
      durationMs: Date.now() - startedAt
    };
  }

  async chatJson({ messages, model }) {
    const response = await this.request('/chat/completions', {
      model,
      messages,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });
    const content = response?.choices?.[0]?.message?.content || '{}';
    return extractJsonObject(content);
  }

  async request(path, body) {
    if (!this.config.enabled) {
      throw new Error('AI 未配置：请在环境变量中设置 AI_API_KEY，或选择 ollama 本地模型');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(`${this.config.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {})
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error?.message || payload?.message || 'AI 调用失败');
      }
      return payload;
    } finally {
      clearTimeout(timer);
    }
  }
}

export function extractJsonObject(value) {
  const text = String(value || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return {};
  return JSON.parse(candidate.slice(start, end + 1));
}

function buildUserContent(prompt, files, supportsVision) {
  const imageFiles = files.filter((file) => file.kind === 'image' && file.dataUrl);
  if (!imageFiles.length || !supportsVision) return prompt;
  return [
    { type: 'text', text: prompt },
    ...imageFiles.map((file) => ({
      type: 'image_url',
      image_url: { url: file.dataUrl }
    }))
  ];
}

function parseFeatures(value = 'ocr,semanticSearch,matching,completeness') {
  return new Set(
    String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function normalizeSupportsVision(savedValue, envValue, defaultValue) {
  if (savedValue != null && savedValue !== '') return savedValue === true || savedValue === 'true' || savedValue === 1;
  if (envValue != null && envValue !== '') return envValue === 'true';
  return defaultValue;
}

function maskApiKey(value) {
  const text = String(value || '');
  if (!text) return '';
  if (text.length <= 8) return '*'.repeat(text.length);
  return `${text.slice(0, 4)}${'*'.repeat(Math.max(4, text.length - 8))}${text.slice(-4)}`;
}

function modelOptionsFrom(model) {
  return [{ value: model, label: model }];
}
