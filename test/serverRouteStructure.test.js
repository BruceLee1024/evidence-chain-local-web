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
});
