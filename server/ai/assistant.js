import { EVIDENCE_LABELS } from '../../shared/evidenceDomain.js';
import { normalizeOcrDraft } from './ocr.js';

const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 2000;

export function sanitizeAssistantMessages(messages = []) {
  return messages
    .filter((message) => message && ['user', 'assistant'].includes(message.role))
    .map((message) => ({
      role: message.role,
      content: String(message.content || '').slice(0, MAX_MESSAGE_LENGTH)
    }))
    .filter((message) => message.content.trim())
    .slice(-MAX_MESSAGES);
}

export function buildProjectAssistantContext({ project, overview = {} }) {
  return {
    project: {
      name: project?.name || '',
      code: project?.code || '',
      manager: project?.manager || ''
    },
    evidenceCounts: overview.counts || {},
    commonLocations: (overview.locations || []).slice(0, 12).map((location) => location.name),
    recentEvidence: (overview.recentEvidence || []).slice(0, 8).map((record) => ({
      type: record.type,
      typeLabel: EVIDENCE_LABELS[record.type] || record.type,
      code: record.code || '',
      title: record.title || '',
      location: record.location || '',
      evidenceDate: record.evidenceDate || '',
      amount: record.amount ?? null
    })),
    recentSessions: (overview.sessions || []).slice(0, 5).map((session) => ({
      name: session.name || '',
      createdAt: session.createdAt || ''
    }))
  };
}

export function normalizeAssistantDraft(rawDraft) {
  if (!rawDraft || typeof rawDraft !== 'object') return null;
  if (!rawDraft.type) return null;
  try {
    const draft = normalizeOcrDraft(rawDraft.type, rawDraft);
    return {
      type: draft.type,
      fields: draft.fields,
      confidence: draft.confidence,
      warnings: draft.warnings
    };
  } catch {
    return null;
  }
}

export function normalizeAssistantBasis(value) {
  return ['project', 'professional', 'mixed'].includes(value) ? value : 'professional';
}

export async function runAssistantChat({ provider, config, projectContext, currentPage, currentEvidenceType, messages }) {
  const sanitizedMessages = sanitizeAssistantMessages(messages);
  if (!sanitizedMessages.length) {
    throw new Error('请输入要咨询 AI 助手的问题');
  }

  const payload = await provider.chatJson({
    model: config.model,
    messages: [
      {
        role: 'system',
        content: [
          '你是施工单位商务结算人员使用的证据链管理系统 AI 助手。',
          '你只能基于当前项目摘要和用户问题给出建议，不要声称读取了附件全文或数据库之外的数据。',
          '你可以生成证据录入草稿，但草稿只供用户检查后手动保存。',
          '当用户表达“填写表单、生成草稿、帮我录入、补一份资料”时，必须尽量返回 draft，而不只是文字说明。',
          '如果用户在证据管理页且没有明确证据类型，优先使用当前证据表单类型。',
          'draft.type 只能是 variation、hidden、material、monthly。',
          'variation 字段：code, changeType, reason, amount, signDate, contractorSigner, supervisorSigner, ownerSigner, scheduleImpact, note, location。',
          '生成 variation 签证变更单草稿时必须尽量填写 code；优先参考当前项目摘要中的既有证据编号规律。',
          '如果项目摘要中没有可参考编号，请基于工程常见编号习惯生成临时变更编号，例如 YYYY-序号，并在 warnings 中提示“编号为 AI 建议，请按项目台账核对”。',
          'hidden 字段：location, process, acceptanceDate, conclusion, photographer, note。',
          'material 字段：entryDate, materialName, spec, unit, quantity, brand, supplier, receiver, note。',
          'monthly 字段：month, confirmDate, currentValue, cumulativeValue, ownerSigner, note。',
          '无法确定的字段不要编造精确值，可留空并在 warnings 中说明。',
          '如果缺少项目必要信息，可以基于你的工程结算专业知识给出参考，但必须明确区分依据来源。',
          'basis 必须说明回答依据来源：project=仅来自当前项目摘要，professional=基于 AI 工程结算专业知识，mixed=项目摘要 + AI 专业知识。',
          'reply 中也要用简短中文说明依据，例如“根据当前项目摘要...”或“基于工程结算常规经验...”。',
          '只返回 JSON：{"reply":"中文回答","basis":"project|professional|mixed","draft":null 或 {"type":"material","fields":{},"confidence":0-1,"warnings":[]}}。'
        ].join('\n')
      },
      {
        role: 'user',
        content: [
          `当前页面：${currentPage || 'unknown'}`,
          `当前证据表单类型：${currentEvidenceType || 'unknown'}`,
          '当前项目摘要：',
          JSON.stringify(projectContext)
        ].join('\n')
      },
      ...sanitizedMessages
    ]
  });

  return {
    reply: String(payload.reply || '我已收到，请补充更具体的问题。').trim(),
    basis: normalizeAssistantBasis(payload.basis),
    draft: normalizeAssistantDraft(payload.draft),
    provider: config.provider,
    model: config.model
  };
}
