import { FolderOpen, Plus, ShieldCheck } from 'lucide-react';
import { SectionTitle } from '../components.jsx';

export function ProjectRequiredPage({ state, onCreateProject }) {
  return (
    <section className="workspace project-gate">
      <div className="panel project-gate-panel">
        <SectionTitle icon={FolderOpen} title={state.headerTitle} />
        <h2>{state.gateTitle}</h2>
        <p>{state.gateDescription}</p>
        <button onClick={onCreateProject}>
          <Plus size={17} />
          {state.actionLabel}
        </button>
      </div>
      <aside className="workspace-side project-gate-side">
        <SectionTitle icon={ShieldCheck} title="项目边界" />
        <p>当前还没有选中的项目。证据、部位、组卷批次和导出文件都会保存在项目下面。</p>
      </aside>
    </section>
  );
}
