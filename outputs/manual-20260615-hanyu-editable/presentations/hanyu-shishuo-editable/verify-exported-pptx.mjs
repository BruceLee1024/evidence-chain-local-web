import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureArtifactToolWorkspace, importArtifactTool, saveBlobToFile } from '/Users/bruce/.codex/plugins/cache/openai-primary-runtime/presentations/26.601.10930/skills/presentations/scripts/artifact_tool_utils.mjs';
const workspace = '/Users/bruce/Desktop/证据链管理系统搭建/outputs/manual-20260615-hanyu-editable/presentations/hanyu-shishuo-editable';
const pptxPath = '/Users/bruce/Desktop/证据链管理系统搭建/ppt/hanyu-shishuo-argument/跟着韩愈学吵架_师说议论文结构课_可编辑版.pptx';
const outDir = path.join(workspace, 'verify-exported');
await fs.mkdir(outDir, { recursive: true });
await ensureArtifactToolWorkspace(workspace);
const { FileBlob, PresentationFile } = await importArtifactTool(workspace);
const presentation = await PresentationFile.importPptx(await FileBlob.load(pptxPath));
const count = presentation.slides.count;
const picks = [0, 7, 16, 25].filter(i => i < count);
for (const i of picks) {
  const slide = presentation.slides.getItem(i);
  const png = await presentation.export({ slide, format: 'png', scale: 1 });
  await saveBlobToFile(png, path.join(outDir, `imported-${String(i + 1).padStart(2, '0')}.png`));
}
console.log(JSON.stringify({ count, rendered: picks.map(i => i + 1), outDir }, null, 2));
