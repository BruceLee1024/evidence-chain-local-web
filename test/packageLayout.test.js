import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('package page layout contract', () => {
  const appSource = readFileSync(new URL('../src/pages/PackagePage.jsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

  it('keeps settlement packaging as a command rail, result board, and review rail', () => {
    expect(appSource).toContain('package-stage');
    expect(appSource).toContain('package-command-panel');
    expect(appSource).toContain('package-stack');
    expect(appSource).toContain('package-result-panel');
    expect(appSource).toContain('package-review-panel');
    expect(styles).toMatch(/\.package-layout\s*{[^}]*grid-template-columns:\s*minmax\(300px,\s*360px\)\s+minmax\(0,\s*1fr\)/s);
    expect(styles).toContain('"stage stage"');
    expect(styles).toContain('"command work"');
  });
});
