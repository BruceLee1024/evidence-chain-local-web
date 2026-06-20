import { matchEvidenceForItems } from '../lib/matching.js';

export async function buildAiMatchCandidates({ provider, items, evidenceRecords, existingLinks = [], limit = 50 }) {
  const existing = new Set(existingLinks.map((link) => `${link.itemId}:${link.evidenceId}`));
  const ruleMatches = matchEvidenceForItems(items, evidenceRecords);
  const candidates = [];
  let calls = 0;

  for (const match of ruleMatches) {
    const item = items.find((entry) => entry.id === match.itemId);
    if (!item) continue;
    const rejected = match.rejected || [];
    for (const rejectedLink of rejected) {
      if (calls >= limit) return candidates;
      if (existing.has(`${match.itemId}:${rejectedLink.evidenceId}`)) continue;
      const evidence = evidenceRecords.find((record) => record.id === rejectedLink.evidenceId);
      if (!evidence) continue;
      calls += 1;
      const judgment = await provider.judgeEvidenceMatch({ item, evidence });
      if (!judgment?.relevant) continue;
      const confidence = clampConfidence(judgment.confidence);
      if (confidence < 50) continue;
      candidates.push({
        itemId: match.itemId,
        evidenceId: evidence.id,
        confidence,
        matchKind: `AI语义匹配：${String(judgment.reason || '模型判断相关').slice(0, 80)}`,
        status: 'candidate',
        source: 'ai'
      });
    }
  }

  return candidates;
}

function clampConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 60;
  if (number <= 1) return Math.round(number * 100);
  return Math.max(0, Math.min(100, Math.round(number)));
}
