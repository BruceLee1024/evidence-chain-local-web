import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('server route structure', () => {
  it('keeps settlement route details out of the app bootstrap', () => {
    const appSource = readFileSync(new URL('../server/app.js', import.meta.url), 'utf8');
    const routePath = new URL('../server/routes/settlements.js', import.meta.url);

    expect(existsSync(routePath)).toBe(true);
    expect(readFileSync(routePath, 'utf8')).toContain('/settlements/:sessionId');
    expect(appSource).not.toContain('/settlements/:sessionId');
  });

  it('keeps AI and search route details out of the app bootstrap', () => {
    const appSource = readFileSync(new URL('../server/app.js', import.meta.url), 'utf8');
    const aiRoutePath = new URL('../server/routes/ai.js', import.meta.url);
    const searchRoutePath = new URL('../server/routes/search.js', import.meta.url);

    expect(existsSync(aiRoutePath)).toBe(true);
    expect(existsSync(searchRoutePath)).toBe(true);
    expect(readFileSync(aiRoutePath, 'utf8')).toContain('/ocr/extract');
    expect(readFileSync(searchRoutePath, 'utf8')).toContain('/semantic');
    expect(appSource).not.toContain('/ocr/extract');
    expect(appSource).not.toContain('/semantic');
  });

  it('keeps project and evidence route details out of the app bootstrap', () => {
    const appSource = readFileSync(new URL('../server/app.js', import.meta.url), 'utf8');
    const projectRoutePath = new URL('../server/routes/projects.js', import.meta.url);
    const evidenceRoutePath = new URL('../server/routes/evidence.js', import.meta.url);

    expect(existsSync(projectRoutePath)).toBe(true);
    expect(existsSync(evidenceRoutePath)).toBe(true);
    expect(readFileSync(projectRoutePath, 'utf8')).toContain('/projects/:projectId/overview');
    expect(readFileSync(evidenceRoutePath, 'utf8')).toContain('/variation-orders');
    expect(appSource).not.toContain('/api/projects/:projectId/overview');
    expect(appSource).not.toContain('/variation-orders');
  });
});
