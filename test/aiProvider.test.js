import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAiConfig, createAiProvider, extractJsonObject, publicAiConfig, supportedAiProviders } from '../server/ai/provider.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildAiConfig', () => {
  it('uses the official DeepSeek base URL and current default model', () => {
    const config = buildAiConfig({ AI_PROVIDER: 'deepseek' });

    expect(config.baseUrl).toBe('https://api.deepseek.com');
    expect(config.model).toBe('deepseek-v4-flash');
    expect(config.model).not.toBe('deepseek-chat');
  });

  it('builds domestic provider config without OpenAI defaults', () => {
    const config = buildAiConfig({
      AI_PROVIDER: 'qwen',
      AI_API_KEY: 'test-key',
      AI_MODEL: 'qwen-plus',
      AI_VISION_MODEL: 'qwen-vl-plus',
      AI_EMBEDDING_MODEL: 'text-embedding-v3'
    });

    expect(config).toMatchObject({
      provider: 'qwen',
      apiKey: 'test-key',
      model: 'qwen-plus',
      visionModel: 'qwen-vl-plus',
      embeddingModel: 'text-embedding-v3'
    });
    expect(config.baseUrl).toContain('dashscope');
    expect(config.baseUrl).not.toContain('openai.com');
  });

  it('lets saved local settings override environment defaults', () => {
    const config = buildAiConfig(
      {
        AI_PROVIDER: 'deepseek',
        AI_API_KEY: 'env-key'
      },
      {
        provider: 'qwen',
        apiKey: 'saved-key',
        model: 'qwen-max',
        visionModel: 'qwen-vl-max',
        embeddingModel: 'text-embedding-v3'
      }
    );

    expect(config).toMatchObject({
      provider: 'qwen',
      apiKey: 'saved-key',
      model: 'qwen-max',
      visionModel: 'qwen-vl-max',
      embeddingModel: 'text-embedding-v3',
      enabled: true
    });
  });
});

describe('publicAiConfig', () => {
  it('redacts api keys before returning settings to the browser', () => {
    const publicConfig = publicAiConfig(buildAiConfig({}, { apiKey: 'sk-secret-local-key' }));

    expect(publicConfig.apiKeySet).toBe(true);
    expect(publicConfig.apiKeyMasked).toMatch(/^sk-s\*+-key$/);
    expect(JSON.stringify(publicConfig)).not.toContain('sk-secret-local-key');
  });
});

describe('supportedAiProviders', () => {
  it('lists only domestic or local providers for the settings UI', () => {
    const ids = supportedAiProviders().map((item) => item.id);
    expect(ids).toContain('deepseek');
    expect(ids).toContain('qwen');
    expect(ids).toContain('ollama');
    expect(ids).not.toContain('openai');
  });

  it('includes DeepSeek V4 flash and V4 pro model choices', () => {
    const deepseek = supportedAiProviders().find((item) => item.id === 'deepseek');

    expect(deepseek.modelOptions).toEqual([
      { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
      { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' }
    ]);
    expect(deepseek.visionModelOptions).toEqual(deepseek.modelOptions);
    expect(deepseek.embeddingModelOptions).toEqual(deepseek.modelOptions);
  });
});

describe('createAiProvider', () => {
  it('refuses unsupported foreign providers', () => {
    expect(() => createAiProvider({ provider: 'openai' })).toThrow('不支持的 AI 服务商');
  });

  it('checks chat completion connectivity with the configured endpoint and model', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'pong' } }]
      })
    });
    const provider = createAiProvider(buildAiConfig({}, {
      provider: 'deepseek',
      apiKey: 'test-key',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash'
    }));

    const result = await provider.testConnection();

    expect(result.ok).toBe(true);
    expect(result.model).toBe('deepseek-v4-flash');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' })
      })
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      model: 'deepseek-v4-flash',
      stream: false,
      max_tokens: 8
    });
  });

  it('retries a transient network failure once before returning a successful response', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"ok":true}' } }]
        })
      });
    const provider = createAiProvider({
      provider: 'deepseek',
      enabled: true,
      apiKey: 'test-key',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash',
      timeoutMs: 15000,
      retryDelayMs: 0
    });

    await expect(provider.chatJson({ messages: [], model: 'deepseek-v4-flash' })).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retriable authentication errors', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'invalid api key' } })
    });
    const provider = createAiProvider({
      provider: 'deepseek',
      enabled: true,
      apiKey: 'bad-key',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash',
      timeoutMs: 15000,
      retryDelayMs: 0
    });

    await expect(provider.chatJson({ messages: [], model: 'deepseek-v4-flash' })).rejects.toThrow('invalid api key');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries rate-limit responses once', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'rate limited' } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"ok":true}' } }]
        })
      });
    const provider = createAiProvider({
      provider: 'deepseek',
      enabled: true,
      apiKey: 'test-key',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash',
      timeoutMs: 15000,
      retryDelayMs: 0
    });

    await expect(provider.chatJson({ messages: [], model: 'deepseek-v4-flash' })).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('extractJsonObject', () => {
  it('parses fenced model JSON responses', () => {
    expect(extractJsonObject('```json\n{"relevant":true,"confidence":86}\n```')).toEqual({
      relevant: true,
      confidence: 86
    });
  });
});
