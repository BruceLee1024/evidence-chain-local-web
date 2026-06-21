import { describe, expect, it } from 'vitest';
import {
  buildProjectAssistantContext,
  normalizeAssistantDraft,
  normalizeAssistantBasis,
  runAssistantChat,
  sanitizeAssistantMessages
} from '../server/ai/assistant.js';

describe('AI assistant helpers', () => {
  it('builds a project summary context without file paths or raw payload details', () => {
    const context = buildProjectAssistantContext({
      project: {
        id: 'project-1',
        name: '东方广场三期总承包项目',
        code: 'DFGC-2026',
        manager: '商务结算部'
      },
      overview: {
        counts: { hidden: 1, material: 1 },
        locations: [{ name: '3#楼地下室底板' }],
        recentEvidence: [
          {
            id: 'ev-1',
            type: 'hidden',
            code: 'YB-2026-001',
            title: '底板钢筋隐蔽验收',
            location: '3#楼地下室底板',
            evidenceDate: '2026-06-15',
            payload: { privateNote: '完整原始内容不应进入助手上下文' },
            files: [{ path: '/tmp/uploads/secret-photo.jpg', originalName: 'secret-photo.jpg' }]
          }
        ],
        sessions: [{ id: 'session-1', name: '2026年6月结算组卷' }]
      }
    });

    const text = JSON.stringify(context);
    expect(text).toContain('东方广场三期总承包项目');
    expect(text).toContain('YB-2026-001');
    expect(text).toContain('底板钢筋隐蔽验收');
    expect(text).toContain('2026年6月结算组卷');
    expect(text).not.toContain('/tmp/uploads/secret-photo.jpg');
    expect(text).not.toContain('完整原始内容不应进入助手上下文');
  });

  it('normalizes assistant evidence drafts to allowed fields only', () => {
    const draft = normalizeAssistantDraft({
      type: 'material',
      fields: {
        entryDate: '2026-06-21',
        materialName: 'HRB400 钢筋',
        quantity: '120',
        amount: 999999,
        unknownField: 'remove me'
      },
      confidence: 84,
      warnings: ['请核对数量']
    });

    expect(draft).toEqual({
      type: 'material',
      fields: {
        entryDate: '2026-06-21',
        materialName: 'HRB400 钢筋',
        quantity: 120
      },
      confidence: 0.84,
      warnings: expect.arrayContaining(['请核对数量', '缺少必填字段：unit'])
    });
  });

  it('keeps only recent user and assistant messages with bounded content', () => {
    const messages = Array.from({ length: 14 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `${index}-` + 'x'.repeat(2100)
    }));
    messages.push({ role: 'system', content: 'must be removed' });

    const sanitized = sanitizeAssistantMessages(messages);

    expect(sanitized).toHaveLength(12);
    expect(sanitized[0].content.startsWith('2-')).toBe(true);
    expect(sanitized.every((message) => ['user', 'assistant'].includes(message.role))).toBe(true);
    expect(sanitized.every((message) => message.content.length <= 2000)).toBe(true);
  });

  it('normalizes assistant answer source basis labels', () => {
    expect(normalizeAssistantBasis('project')).toBe('project');
    expect(normalizeAssistantBasis('professional')).toBe('professional');
    expect(normalizeAssistantBasis('mixed')).toBe('mixed');
    expect(normalizeAssistantBasis('unknown')).toBe('professional');
    expect(normalizeAssistantBasis()).toBe('professional');
  });

  it('passes the current evidence form type to the model when asking for drafts', async () => {
    let capturedMessages = [];
    const provider = {
      async chatJson({ messages }) {
        capturedMessages = messages;
        return {
          reply: '已准备签证变更单草稿。',
          basis: 'mixed',
          draft: {
            type: 'variation',
            fields: { code: '2026-024', reason: '基坑超挖增加混凝土量', signDate: '2026-06-21' }
          }
        };
      }
    };

    const result = await runAssistantChat({
      provider,
      config: { provider: 'deepseek', model: 'deepseek-v4-flash' },
      projectContext: { project: { name: '测试项目' } },
      currentPage: 'evidence',
      currentEvidenceType: 'variation',
      messages: [{ role: 'user', content: '帮我填写当前表单' }]
    });

    expect(JSON.stringify(capturedMessages)).toContain('当前证据表单类型：variation');
    expect(capturedMessages[0].content).toContain('当用户表达“填写表单、生成草稿、帮我录入、补一份资料”时，必须尽量返回 draft');
    expect(capturedMessages[0].content).toContain('生成 variation 签证变更单草稿时必须尽量填写 code');
    expect(capturedMessages[0].content).toContain('basis 必须说明回答依据来源');
    expect(result.basis).toBe('mixed');
    expect(result.draft).toMatchObject({
      type: 'variation',
      fields: {
        code: '2026-024',
        reason: '基坑超挖增加混凝土量',
        signDate: '2026-06-21'
      }
    });
  });
});
