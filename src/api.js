async function request(path, options = {}) {
  const response = await fetch(path, options);
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(payload?.error || payload || '请求失败');
  }
  return payload;
}

export const api = {
  projects: () => request('/api/projects'),
  createProject: (payload) =>
    request('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }),
  overview: (projectId) => request(`/api/projects/${projectId}/overview`),
  locations: (projectId) => request(`/api/projects/${projectId}/locations`),
  evidence: (projectId, type = '') =>
    request(`/api/projects/${projectId}/evidence${type ? `?type=${encodeURIComponent(type)}` : ''}`),
  createVariation: (projectId, formData) =>
    request(`/api/projects/${projectId}/variation-orders`, { method: 'POST', body: formData }),
  createHidden: (projectId, formData) =>
    request(`/api/projects/${projectId}/hidden-records`, { method: 'POST', body: formData }),
  createMaterial: (projectId, formData) =>
    request(`/api/projects/${projectId}/material-records`, { method: 'POST', body: formData }),
  createMonthly: (projectId, formData) =>
    request(`/api/projects/${projectId}/monthly-measurements`, { method: 'POST', body: formData }),
  aiStatus: () => request('/api/ai/status'),
  aiSettings: () => request('/api/ai/settings'),
  saveAiSettings: (payload) =>
    request('/api/ai/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }),
  testAiSettings: (payload) =>
    request('/api/ai/settings/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }),
  ocrExtract: (evidenceType, files) => {
    const formData = new FormData();
    formData.append('evidenceType', evidenceType);
    files.forEach((file) => formData.append('files', file));
    return request('/api/ai/ocr/extract', { method: 'POST', body: formData });
  },
  search: ({ projectId, q, type }) => {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (q) params.set('q', q);
    if (type) params.set('type', type);
    return request(`/api/search?${params.toString()}`);
  },
  semanticSearch: ({ projectId, q, type }) => {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (q) params.set('q', q);
    if (type) params.set('type', type);
    return request(`/api/search/semantic?${params.toString()}`);
  },
  parsePaste: (projectId, text) =>
    request(`/api/projects/${projectId}/settlements/parse-paste`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    }),
  parseFile: (projectId, file) => {
    const formData = new FormData();
    formData.append('spreadsheet', file);
    return request(`/api/projects/${projectId}/settlements/parse-file`, { method: 'POST', body: formData });
  },
  createSettlement: (projectId, payload) =>
    request(`/api/projects/${projectId}/settlements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }),
  settlements: (projectId) => request(`/api/projects/${projectId}/settlements`),
  settlement: (projectId, sessionId) => request(`/api/projects/${projectId}/settlements/${sessionId}`),
  linkEvidence: (projectId, sessionId, itemId, payload) =>
    request(`/api/projects/${projectId}/settlements/${sessionId}/items/${itemId}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }),
  removeLink: (projectId, sessionId, itemId, evidenceId) =>
    request(`/api/projects/${projectId}/settlements/${sessionId}/items/${itemId}/links/${evidenceId}`, {
      method: 'DELETE'
    }),
  supplemental: (projectId, sessionId, itemId, formData) =>
    request(`/api/projects/${projectId}/settlements/${sessionId}/items/${itemId}/supplemental`, {
      method: 'POST',
      body: formData
    }),
  rematchAi: (projectId, sessionId) =>
    request(`/api/projects/${projectId}/settlements/${sessionId}/rematch-ai`, { method: 'POST' }),
  checkCompleteness: (projectId, sessionId) =>
    request(`/api/projects/${projectId}/settlements/${sessionId}/check-completeness`),
  preview: (projectId, sessionId) => request(`/api/projects/${projectId}/settlements/${sessionId}/preview`)
};

export const sampleSettlementText =
  '清单名称\t部位\t开始日期\t结束日期\t金额\n' +
  '地下室底板混凝土\t3#楼地下室底板\t2026-05-01\t2026-05-31\t120000\n' +
  '地下室底板钢筋隐蔽\t3#楼地下室底板\t2026-05-10\t2026-05-20\t86000';
