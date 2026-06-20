import { ensureArtifactToolWorkspace, importArtifactTool } from '/Users/bruce/.codex/plugins/cache/openai-primary-runtime/presentations/26.601.10930/skills/presentations/scripts/artifact_tool_utils.mjs';
const workspace = '/Users/bruce/Desktop/证据链管理系统搭建/outputs/manual-20260615-hanyu-editable/presentations/hanyu-shishuo-editable';
await ensureArtifactToolWorkspace(workspace);
const { Presentation } = await importArtifactTool(workspace);
const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const s = p.slides.add();
const n = s.speakerNotes;
console.log('own', Object.getOwnPropertyNames(n));
let proto = Object.getPrototypeOf(n); let level=0;
while(proto){ console.log('proto', level++, Object.getOwnPropertyNames(proto)); proto=Object.getPrototypeOf(proto); }
