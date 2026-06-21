import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('assistant widget source contract', () => {
  const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const evidencePageSource = readFileSync(new URL('../src/pages/EvidencePage.jsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

  it('mounts a global assistant widget that can hand drafts to EvidencePage', () => {
    expect(appSource).toContain('AssistantWidget');
    expect(appSource).toContain('pendingAssistantDraft');
    expect(appSource).toContain('activeEvidenceType');
    expect(appSource).toContain('currentEvidenceType');
    expect(evidencePageSource).toContain('assistantDraft');
    expect(evidencePageSource).toContain('onAssistantDraftApplied');
    expect(evidencePageSource).toContain('onModeChange');
  });

  it('defines fixed assistant bubble and mobile drawer styles', () => {
    const widgetSource = readFileSync(new URL('../src/AssistantWidget.jsx', import.meta.url), 'utf8');
    expect(widgetSource).toContain('帮我填写当前表单');
    expect(widgetSource).toContain('basisLabels');
    expect(widgetSource).toContain('message.basis');
    expect(styles).toContain('.assistant-widget');
    expect(styles).toContain('.assistant-bubble');
    expect(styles).toContain('.assistant-panel');
    expect(styles).toContain('.assistant-basis');
    expect(styles).toContain('.assistant-quick-actions');
    expect(styles).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*\.assistant-panel/s);
  });
});
