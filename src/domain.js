import { EVIDENCE_LABELS, EVIDENCE_TYPES } from '../shared/evidenceDomain.js';

export const evidenceLabels = EVIDENCE_LABELS;

export const evidenceTypes = EVIDENCE_TYPES;

export const statusLabels = {
  matched: '已匹配',
  partial: '部分匹配',
  unmatched: '无匹配',
  auto: '自动确认',
  manual: '人工确认',
  candidate: '候选'
};
