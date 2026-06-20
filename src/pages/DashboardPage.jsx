import { Boxes, ClipboardList, FileArchive, FolderOpen, Plus } from 'lucide-react';
import { EmptyText, EvidenceList, SectionTitle, SessionList } from '../components.jsx';

export function DashboardPage({ overview, evidence, sessions, setPage }) {
  const counts = overview?.counts || {};
  return (
    <section className="screen-grid">
      <div className="band span-2 overview-band">
        <div>
          <h2>项目证据概览</h2>
          <p>当前围绕 P0/P1 证据闭环：签证变更单、隐蔽工程记录、材料进场、月度计量和结算组卷。</p>
        </div>
        <div className="quick-actions">
          <button onClick={() => setPage('evidence')}>
            <Plus size={17} />
            新增证据
          </button>
          <button className="secondary" onClick={() => setPage('package')}>
            <Boxes size={17} />
            结算组卷
          </button>
        </div>
      </div>

      <Metric label="签证变更单" value={counts.variation || 0} tone="blue" />
      <Metric label="隐蔽工程记录" value={counts.hidden || 0} tone="green" />
      <Metric label="材料进场记录" value={counts.material || 0} tone="purple" />
      <Metric label="月度计量记录" value={counts.monthly || 0} tone="orange" />
      <Metric label="结算组卷批次" value={sessions.length} tone="amber" />

      <div className="panel">
        <SectionTitle icon={ClipboardList} title="最近证据" />
        <EvidenceList records={evidence.slice(0, 6)} compact />
      </div>
      <div className="panel">
        <SectionTitle icon={FolderOpen} title="常用部位" />
        <div className="tag-list">
          {(overview?.locations || []).map((location) => (
            <span key={location.id}>{location.name}</span>
          ))}
          {(overview?.locations || []).length === 0 && <EmptyText text="录入证据后会自动沉淀部位" />}
        </div>
      </div>
      <div className="panel span-2">
        <SectionTitle icon={FileArchive} title="最近组卷" />
        <SessionList sessions={sessions} />
      </div>
    </section>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
