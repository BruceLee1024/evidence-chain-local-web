export const EVIDENCE_TYPES = ['variation', 'hidden', 'material', 'monthly'];

export const SUPPLEMENTAL_EVIDENCE_TYPE = 'supplemental';

export const EVIDENCE_LABELS = {
  variation: '签证变更单',
  hidden: '隐蔽工程记录',
  material: '材料进场记录',
  monthly: '月度计量记录',
  [SUPPLEMENTAL_EVIDENCE_TYPE]: '后补资料'
};

export const EVIDENCE_TYPES_FOR_AI = new Set(EVIDENCE_TYPES);

export function evidenceLabel(type, fallback = type) {
  return EVIDENCE_LABELS[type] || fallback;
}
