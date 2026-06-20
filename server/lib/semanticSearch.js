import { getEvidenceEmbedding, saveEvidenceEmbedding, searchEvidence } from '../repository.js';

export async function rankEvidenceSemantically({ provider, projectId, query, type, fallback, embeddingModel }) {
  const queryVector = await provider.embed(query);
  if (!queryVector.length) return fallback;
  const evidence = searchEvidence({ projectId, query: '', type });
  const scored = [];
  for (const record of evidence) {
    const text = evidenceSearchText(record);
    const vector = await embeddingForEvidence({ provider, record, text, model: embeddingModel });
    scored.push({
      ...record,
      semanticScore: Math.round(cosineSimilarity(queryVector, vector) * 100)
    });
  }
  return scored
    .filter((item) => item.semanticScore > 35)
    .sort((a, b) => b.semanticScore - a.semanticScore)
    .slice(0, 80);
}

export function evidenceSearchText(record) {
  return [
    record.type,
    record.code,
    record.title,
    record.location,
    record.evidenceDate,
    JSON.stringify(record.payload || {})
  ].filter(Boolean).join(' ');
}

export function cosineSimilarity(a, b) {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let aLen = 0;
  let bLen = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += Number(a[index]) * Number(b[index]);
    aLen += Number(a[index]) ** 2;
    bLen += Number(b[index]) ** 2;
  }
  if (!aLen || !bLen) return 0;
  return dot / (Math.sqrt(aLen) * Math.sqrt(bLen));
}

async function embeddingForEvidence({ provider, record, text, model }) {
  const cached = getEvidenceEmbedding(record.id, model, text);
  if (cached) return cached;
  const embedding = await provider.embed(text);
  saveEvidenceEmbedding({
    evidenceId: record.id,
    model,
    searchText: text,
    embedding
  });
  return embedding;
}
