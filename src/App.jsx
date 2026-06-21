import {
  Archive,
  ClipboardList,
  FileArchive,
  FileSearch,
  Home,
  RefreshCw,
  Settings,
  ShieldCheck
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api.js';
import { AssistantWidget } from './AssistantWidget.jsx';
import { resolveNavigationState } from './navigationState.js';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { EvidencePage } from './pages/EvidencePage.jsx';
import { PackagePage } from './pages/PackagePage.jsx';
import { ProjectRequiredPage } from './pages/ProjectRequiredPage.jsx';
import { SearchPage } from './pages/SearchPage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';

const navItems = [
  { id: 'dashboard', label: '项目主页', icon: Home },
  { id: 'evidence', label: '证据管理', icon: ClipboardList },
  { id: 'package', label: '结算组卷', icon: FileArchive },
  { id: 'search', label: '全局搜索', icon: FileSearch },
  { id: 'settings', label: '基础设置', icon: Settings }
];

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [overview, setOverview] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAssistantDraft, setPendingAssistantDraft] = useState(null);
  const [activeEvidenceType, setActiveEvidenceType] = useState('variation');

  const activeProject = projects.find((project) => project.id === projectId);
  const navigationState = resolveNavigationState({ page, hasProject: Boolean(projectId) });

  useEffect(() => {
    refreshProjects();
  }, []);

  useEffect(() => {
    if (projectId) refreshProjectData(projectId);
  }, [projectId]);

  async function refreshProjects() {
    const data = await api.projects();
    setProjects(data);
    if (!projectId && data[0]) setProjectId(data[0].id);
  }

  async function refreshProjectData(nextProjectId = projectId) {
    if (!nextProjectId) return;
    const [overviewData, evidenceData, sessionData] = await Promise.all([
      api.overview(nextProjectId),
      api.evidence(nextProjectId),
      api.settlements(nextProjectId)
    ]);
    setOverview(overviewData);
    setEvidence(evidenceData);
    setSessions(sessionData);
  }

  async function runAction(action, message) {
    try {
      setLoading(true);
      await action();
      if (projectId) await refreshProjectData(projectId);
      setToast(message);
      window.setTimeout(() => setToast(''), 2600);
    } catch (error) {
      setToast(error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleAssistantDraft(draft) {
    setPendingAssistantDraft(draft);
    setPage('evidence');
  }

  function handleAssistantDraftApplied() {
    setPendingAssistantDraft(null);
    setToast('AI 草稿已填入，请检查后保存');
    window.setTimeout(() => setToast(''), 2600);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <ShieldCheck size={26} />
          <div>
            <strong>证据链管理</strong>
            <span>本机 Web 版</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}>
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="storage-note">
          <Archive size={17} />
          <span>文件进入系统证据库</span>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <h1>{activeProject ? activeProject.name : navigationState.headerTitle}</h1>
            <p>{activeProject ? `${activeProject.code || '未填编号'} · ${activeProject.manager || '未填负责人'}` : navigationState.headerDescription}</p>
          </div>
          <div className="topbar-actions">
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">选择项目</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button className="icon-button" onClick={() => projectId && refreshProjectData(projectId)} title="刷新">
              <RefreshCw size={18} />
            </button>
          </div>
        </header>

        {toast && <div className="toast">{toast}</div>}
        {loading && <div className="loading-line" />}

        {!projectId && navigationState.mode === 'project-required' ? (
          <ProjectRequiredPage state={navigationState} onCreateProject={() => setPage('settings')} />
        ) : !projectId ? (
          <SettingsPage onCreated={(project) => {
            refreshProjects();
            setProjectId(project.id);
          }} />
        ) : (
          <>
            {page === 'dashboard' && <DashboardPage overview={overview} evidence={evidence} sessions={sessions} setPage={setPage} />}
            {page === 'evidence' && (
              <EvidencePage
                projectId={projectId}
                evidence={evidence}
                locations={overview?.locations || []}
                runAction={runAction}
                assistantDraft={pendingAssistantDraft}
                onAssistantDraftApplied={handleAssistantDraftApplied}
                onModeChange={setActiveEvidenceType}
              />
            )}
            {page === 'package' && (
              <PackagePage
                projectId={projectId}
                evidence={evidence}
                sessions={sessions}
                refreshProjectData={refreshProjectData}
                runAction={runAction}
              />
            )}
            {page === 'search' && <SearchPage projectId={projectId} />}
            {page === 'settings' && (
              <SettingsPage
                activeProject={activeProject}
                locations={overview?.locations || []}
                onCreated={(project) => {
                  refreshProjects();
                  setProjectId(project.id);
                }}
              />
            )}
          </>
        )}
      </main>
      <AssistantWidget
        projectId={projectId}
        currentPage={page}
        currentEvidenceType={activeEvidenceType}
        onApplyDraft={handleAssistantDraft}
      />
    </div>
  );
}
