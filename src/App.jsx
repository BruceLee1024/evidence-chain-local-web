import {
  Archive,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Download,
  FileArchive,
  FileSearch,
  FolderOpen,
  Home,
  Link2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Upload,
  X
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api, sampleSettlementText } from './api.js';

const navItems = [
  { id: 'dashboard', label: '项目主页', icon: Home },
  { id: 'evidence', label: '证据管理', icon: ClipboardList },
  { id: 'package', label: '结算组卷', icon: FileArchive },
  { id: 'search', label: '全局搜索', icon: FileSearch },
  { id: 'settings', label: '基础设置', icon: Settings }
];

const evidenceLabels = {
  variation: '签证变更单',
  hidden: '隐蔽工程记录',
  material: '材料进场记录',
  monthly: '月度计量记录',
  supplemental: '后补资料'
};

const evidenceTypes = ['variation', 'hidden', 'material', 'monthly'];

const statusLabels = {
  matched: '已匹配',
  partial: '部分匹配',
  unmatched: '无匹配',
  auto: '自动确认',
  manual: '人工确认',
  candidate: '候选'
};

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [overview, setOverview] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);

  const activeProject = projects.find((project) => project.id === projectId);

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
            <h1>{activeProject ? activeProject.name : '创建第一个项目'}</h1>
            <p>{activeProject ? `${activeProject.code || '未填编号'} · ${activeProject.manager || '未填负责人'}` : '先建立项目，再录入证据和组卷'}</p>
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

        {!projectId ? (
          <SettingsPage onCreated={(project) => {
            refreshProjects();
            setProjectId(project.id);
          }} />
        ) : (
          <>
            {page === 'dashboard' && <Dashboard overview={overview} evidence={evidence} sessions={sessions} setPage={setPage} />}
            {page === 'evidence' && (
              <EvidencePage
                projectId={projectId}
                evidence={evidence}
                locations={overview?.locations || []}
                runAction={runAction}
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
    </div>
  );
}

function Dashboard({ overview, evidence, sessions, setPage }) {
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

function EvidencePage({ projectId, evidence, locations, runAction }) {
  const [mode, setMode] = useState('variation');
  const visibleEvidence = evidence.filter((item) => evidenceTypes.includes(item.type));
  return (
    <section className="workspace">
      <div className="workspace-main">
        <div className="tabs">
          {evidenceTypes.map((type) => (
            <button key={type} className={mode === type ? 'active' : ''} onClick={() => setMode(type)}>
              {evidenceLabels[type]}
            </button>
          ))}
        </div>
        {mode === 'variation' && (
          <VariationForm
            locations={locations}
            onSubmit={(formData) => runAction(() => api.createVariation(projectId, formData), '签证变更单已归档')}
          />
        )}
        {mode === 'hidden' && (
          <HiddenRecordForm
            locations={locations}
            onSubmit={(formData) => runAction(() => api.createHidden(projectId, formData), '隐蔽工程记录已归档')}
          />
        )}
        {mode === 'material' && (
          <MaterialRecordForm
            onSubmit={(formData) => runAction(() => api.createMaterial(projectId, formData), '材料进场记录已归档')}
          />
        )}
        {mode === 'monthly' && (
          <MonthlyMeasurementForm
            onSubmit={(formData) => runAction(() => api.createMonthly(projectId, formData), '月度计量记录已归档')}
          />
        )}
      </div>
      <aside className="workspace-side">
        <SectionTitle icon={ClipboardList} title="P0/P1 证据列表" />
        <EvidenceList records={visibleEvidence} />
      </aside>
    </section>
  );
}

function VariationForm({ locations, onSubmit }) {
  const [files, setFiles] = useState([]);
  return (
    <FormPanel
      title="签证变更单归档"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        files.forEach((file) => formData.append('attachments', file));
        onSubmit(formData);
        event.currentTarget.reset();
        setFiles([]);
      }}
    >
      <div className="form-grid">
        <Field name="code" label="变更编号" placeholder="2026-023" required />
        <SelectField name="changeType" label="变更类型" options={['设计变更', '现场签证', '工程联系单']} />
        <Field name="reason" label="变更原因" placeholder="基坑超挖增加混凝土量" required />
        <LocationField name="location" label="关联部位" locations={locations} />
        <Field name="amount" label="增减金额" type="number" placeholder="120000" />
        <Field name="signDate" label="签证日期" type="date" required />
        <Field name="contractorSigner" label="施工单位签字人" />
        <Field name="supervisorSigner" label="监理签字人" />
        <Field name="ownerSigner" label="甲方签字人" />
        <label className="check-field">
          <input name="scheduleImpact" type="checkbox" value="true" />
          涉及工期
        </label>
      </div>
      <Textarea name="note" label="备注" />
      <FileDrop label="扫描件 / 照片 / 图纸" files={files} setFiles={setFiles} multiple />
      <SubmitButton label="保存签证变更单" />
    </FormPanel>
  );
}

function HiddenRecordForm({ locations, onSubmit }) {
  const [photos, setPhotos] = useState([]);
  const [acceptanceFile, setAcceptanceFile] = useState([]);
  const [busy, setBusy] = useState(false);
  return (
    <FormPanel
      title="隐蔽工程记录归档"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        try {
          setBusy(true);
          const location = formData.get('location') || '';
          const date = formData.get('acceptanceDate') || '';
          const photographer = formData.get('photographer') || '';
          for (const photo of photos) {
            formData.append('photos', photo);
            const watermarked = await createWatermarkedImage(photo, {
              location,
              date,
              photographer
            }).catch(() => photo);
            formData.append('watermarkedPhotos', watermarked);
          }
          acceptanceFile.forEach((file) => formData.append('acceptanceFile', file));
          await onSubmit(formData);
          form.reset();
          setPhotos([]);
          setAcceptanceFile([]);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        <LocationField name="location" label="隐蔽部位" locations={locations} required />
        <SelectField name="process" label="工序" options={['钢筋绑扎', '模板安装', '混凝土浇筑', '管线预埋', '防水施工']} />
        <Field name="acceptanceDate" label="验收日期" type="date" required />
        <SelectField name="conclusion" label="验收结论" options={['合格', '不合格', '需整改']} />
        <Field name="photographer" label="拍摄人" />
      </div>
      <Textarea name="note" label="备注" />
      <FileDrop label="现场照片（自动生成水印副本）" files={photos} setFiles={setPhotos} multiple accept="image/*" />
      <FileDrop label="签字验收单" files={acceptanceFile} setFiles={setAcceptanceFile} accept=".pdf,image/*" />
      <SubmitButton label={busy ? '正在生成水印' : '保存隐蔽工程记录'} disabled={busy} />
    </FormPanel>
  );
}

function MaterialRecordForm({ onSubmit }) {
  const [certificates, setCertificates] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');

  return (
    <FormPanel
      title="材料进场记录归档"
      onSubmit={async (event) => {
        event.preventDefault();
        if (certificates.length === 0 && photos.length === 0) {
          setError('请至少上传合格证或验收照片');
          return;
        }
        setError('');
        const form = event.currentTarget;
        const formData = new FormData(form);
        certificates.forEach((file) => formData.append('certificates', file));
        photos.forEach((file) => formData.append('photos', file));
        await onSubmit(formData);
        form.reset();
        setCertificates([]);
        setPhotos([]);
      }}
    >
      <div className="form-grid">
        <Field name="entryDate" label="进场日期" type="date" required />
        <Field name="materialName" label="材料名称" placeholder="HRB400 钢筋" required />
        <Field name="spec" label="规格型号" placeholder="Φ25" />
        <UnitField />
        <Field name="quantity" label="进场数量" type="number" min="0.0001" step="0.0001" placeholder="120" required />
        <Field name="brand" label="品牌厂家" placeholder="首钢" />
        <Field name="supplier" label="供应商" placeholder="XX钢铁有限公司" />
        <Field name="receiver" label="收货人" placeholder="张三" />
      </div>
      <Textarea name="note" label="备注" placeholder="3#楼地下室底板用" />
      <FileDrop label="合格证 / 检测报告" files={certificates} setFiles={setCertificates} multiple accept=".pdf,image/*,.doc,.docx" />
      <FileDrop label="验收照片" files={photos} setFiles={setPhotos} multiple accept="image/*" />
      {error && <p className="form-hint error">{error}</p>}
      <SubmitButton label="保存材料进场记录" />
    </FormPanel>
  );
}

function MonthlyMeasurementForm({ onSubmit }) {
  const [confirmFiles, setConfirmFiles] = useState([]);
  const [detailFiles, setDetailFiles] = useState([]);

  return (
    <FormPanel
      title="月度计量确认单归档"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        confirmFiles.forEach((file) => formData.append('confirmFiles', file));
        detailFiles.forEach((file) => formData.append('detailFiles', file));
        await onSubmit(formData);
        form.reset();
        setConfirmFiles([]);
        setDetailFiles([]);
      }}
    >
      <div className="form-grid">
        <Field name="month" label="计量月份" type="month" required />
        <Field name="confirmDate" label="确认日期" type="date" required />
        <Field name="currentValue" label="本期完成产值" type="number" min="0.01" step="0.01" placeholder="380000" required />
        <Field name="cumulativeValue" label="累计完成产值" type="number" min="0.01" step="0.01" placeholder="1650000" required />
        <Field name="ownerSigner" label="甲方签字人" placeholder="王经理" />
      </div>
      <Textarea name="note" label="备注" placeholder="3#楼已施工至主体10层" />
      <p className="form-hint">请与合同约定的产值单位保持一致。</p>
      <FileDrop label="签字确认单" files={confirmFiles} setFiles={setConfirmFiles} multiple accept=".pdf,image/*" />
      {confirmFiles.length === 0 && <p className="form-hint warning">建议上传签字确认单</p>}
      <FileDrop label="计量明细表" files={detailFiles} setFiles={setDetailFiles} multiple accept=".pdf,.xls,.xlsx,image/*" />
      <SubmitButton label="保存月度计量记录" />
    </FormPanel>
  );
}

function PackagePage({ projectId, evidence, sessions, refreshProjectData, runAction }) {
  const [pasteText, setPasteText] = useState(sampleSettlementText);
  const [parsed, setParsed] = useState(null);
  const [columns, setColumns] = useState({});
  const [payload, setPayload] = useState(null);
  const [activeItemId, setActiveItemId] = useState('');
  const [preview, setPreview] = useState(null);

  const activeItem = payload?.items.find((item) => item.id === activeItemId) || payload?.items[0];
  const activeLinks = payload?.links.filter((link) => link.itemId === activeItem?.id) || [];
  const evidenceById = useMemo(() => new Map((payload?.evidence || []).map((item) => [item.id, item])), [payload]);
  const packageStats = useMemo(() => {
    const items = payload?.items || [];
    return {
      total: items.length,
      matched: items.filter((item) => item.status === 'matched').length,
      partial: items.filter((item) => item.status === 'partial').length,
      unmatched: items.filter((item) => item.status === 'unmatched').length,
      confirmedLinks: (payload?.links || []).filter((link) => link.status === 'auto' || link.status === 'manual').length,
      candidateLinks: (payload?.links || []).filter((link) => link.status === 'candidate').length
    };
  }, [payload]);

  async function parsePaste() {
    const result = await api.parsePaste(projectId, pasteText);
    setParsed(result);
    setColumns(result.columns);
  }

  async function parseFile(file) {
    const result = await api.parseFile(projectId, file);
    setParsed(result);
    setColumns(result.columns);
  }

  async function createSession() {
    if (!parsed) return;
    const result = await api.createSettlement(projectId, {
      name: `${new Date().toISOString().slice(0, 10)} 结算组卷`,
      rows: parsed.rows,
      columns
    });
    setPayload(result);
    setActiveItemId(result.items[0]?.id || '');
    setPreview(null);
    await refreshProjectData(projectId);
  }

  async function loadSession(sessionId) {
    const result = await api.settlement(projectId, sessionId);
    setPayload(result);
    setActiveItemId(result.items[0]?.id || '');
    setPreview(null);
  }

  async function refreshSession(nextPayload) {
    setPayload(nextPayload);
    await refreshProjectData(projectId);
  }

  return (
    <section className="package-layout">
      <div className="package-stage">
        <PackageStep
          icon={Upload}
          step="01"
          title="导入清单"
          meta={parsed ? `${parsed.rows.length} 项已解析` : '等待结算项'}
          active={!payload}
        />
        <PackageStep
          icon={Boxes}
          step="02"
          title="匹配结果"
          meta={payload ? `${packageStats.total} 项 · ${packageStats.candidateLinks} 个候选` : '生成后校对'}
          active={Boolean(payload)}
        />
        <PackageStep
          icon={CheckCircle2}
          step="03"
          title="组卷导出"
          meta={preview ? '目录已预览' : '人工确认后导出'}
          active={Boolean(preview)}
        />
      </div>

      <div className="panel import-panel package-command-panel">
        <SectionTitle icon={Upload} title="导入结算项" />
        <textarea value={pasteText} onChange={(event) => setPasteText(event.target.value)} aria-label="粘贴结算项清单" />
        <div className="button-row package-actions">
          <button onClick={parsePaste}>
            <ClipboardList size={16} />
            解析粘贴内容
          </button>
          <label className="button secondary file-button">
            <Upload size={16} />
            上传 Excel
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={(event) => event.target.files?.[0] && parseFile(event.target.files[0])}
            />
          </label>
        </div>

        {parsed && (
          <div className="mapping-box">
            <h3>列匹配</h3>
            <ColumnSelect label="结算项名称" value={columns.name} headers={parsed.headers} onChange={(value) => setColumns({ ...columns, name: value })} />
            <ColumnSelect label="部位" value={columns.location} headers={parsed.headers} onChange={(value) => setColumns({ ...columns, location: value })} />
            <ColumnSelect label="开始日期" value={columns.startDate} headers={parsed.headers} onChange={(value) => setColumns({ ...columns, startDate: value })} />
            <ColumnSelect label="结束日期" value={columns.endDate} headers={parsed.headers} onChange={(value) => setColumns({ ...columns, endDate: value })} />
            <ColumnSelect label="金额" value={columns.amount} headers={parsed.headers} onChange={(value) => setColumns({ ...columns, amount: value })} />
            <button onClick={createSession}>
              <Link2 size={16} />
              生成匹配结果
            </button>
          </div>
        )}

        <SectionTitle icon={FileArchive} title="历史组卷" compact />
        <SessionList sessions={sessions} onSelect={loadSession} />
      </div>

      <div className="package-stack">
        <div className="panel settlement-table package-result-panel">
          <div className="panel-heading">
            <SectionTitle icon={Boxes} title="匹配校对" />
            {payload && (
              <div className="summary-chips">
                <span>{packageStats.total} 项</span>
                <span>{packageStats.matched} 已匹配</span>
                <span>{packageStats.partial} 待确认</span>
                <span>{packageStats.unmatched} 无匹配</span>
              </div>
            )}
          </div>
          {!payload && <EmptyText text="导入结算项后显示匹配结果" />}
          {payload && (
            <div className="settlement-scroll">
              <table>
                <thead>
                  <tr>
                    <th>序号</th>
                    <th>结算项</th>
                    <th>部位</th>
                    <th>时间</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.items.map((item) => (
                    <tr key={item.id} className={activeItem?.id === item.id ? 'selected' : ''} onClick={() => setActiveItemId(item.id)}>
                      <td>{item.rowNumber}</td>
                      <td>{item.name}</td>
                      <td>{item.location}</td>
                      <td>{item.startDate} 至 {item.endDate}</td>
                      <td><StatusBadge status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="panel review-panel package-review-panel">
          <div className="panel-heading">
            <SectionTitle icon={CheckCircle2} title="人工校对" />
            {payload && (
              <div className="summary-chips">
                <span>{packageStats.confirmedLinks} 已确认</span>
                <span>{packageStats.candidateLinks} 候选</span>
              </div>
            )}
          </div>
          {!activeItem && <EmptyText text="选择一个结算项进行校对" />}
          {activeItem && (
            <>
              <div className="review-grid">
                <div className="active-item">
                  <span>当前结算项</span>
                  <strong>{activeItem.name}</strong>
                  <small>{activeItem.location}</small>
                  <StatusBadge status={activeItem.status} />
                </div>
                <div className="review-links">
                  <h3>已关联证据</h3>
                  <div className="link-list">
                    {activeLinks.map((link) => {
                      const record = evidenceById.get(link.evidenceId);
                      return (
                        <div className="link-row" key={link.id}>
                          <div>
                            <strong>{record?.title || link.evidenceId}</strong>
                            <span>{statusLabels[link.status]} · {link.matchKind} · {link.confidence}%</span>
                          </div>
                          <div className="row-actions">
                            {link.status === 'candidate' && (
                              <button
                                className="icon-button"
                                title="确认候选"
                                onClick={() => runAction(async () => {
                                  const next = await api.linkEvidence(projectId, payload.session.id, activeItem.id, {
                                    evidenceId: link.evidenceId,
                                    status: 'manual',
                                    confidence: link.confidence,
                                    matchKind: '人工确认候选'
                                  });
                                  await refreshSession(next);
                                }, '候选证据已确认')}
                              >
                                <CheckCircle2 size={16} />
                              </button>
                            )}
                            <button
                              className="icon-button danger"
                              title="移除"
                              onClick={() => runAction(async () => {
                                const next = await api.removeLink(projectId, payload.session.id, activeItem.id, link.evidenceId);
                                await refreshSession(next);
                              }, '证据关联已移除')}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {activeLinks.length === 0 && <EmptyText text="当前结算项暂无候选证据" />}
                  </div>
                </div>
              </div>

              <div className="review-tools">
                <SupplementalUpload
                  onSubmit={(formData) => runAction(async () => {
                    const next = await api.supplemental(projectId, payload.session.id, activeItem.id, formData);
                    await refreshSession(next);
                  }, '后补资料已关联')}
                />

                <div className="manual-block">
                  <SectionTitle icon={Link2} title="手动关联证据" compact />
                  <div className="manual-list">
                    {evidence.filter((item) => evidenceTypes.includes(item.type)).map((record) => (
                      <button
                        key={record.id}
                        onClick={() => runAction(async () => {
                          const next = await api.linkEvidence(projectId, payload.session.id, activeItem.id, {
                            evidenceId: record.id,
                            status: 'manual',
                            confidence: 100,
                            matchKind: '人工关联'
                          });
                          await refreshSession(next);
                        }, '证据已人工关联')}
                      >
                        {evidenceLabels[record.type]} · {record.title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="button-row sticky-actions">
                <button
                  onClick={async () => {
                    const result = await api.preview(projectId, payload.session.id);
                    setPreview(result);
                  }}
                >
                  <FolderOpen size={16} />
                  预览目录
                </button>
                <a className="button secondary" href={`/api/projects/${projectId}/settlements/${payload.session.id}/export.zip`}>
                  <Download size={16} />
                  导出 ZIP
                </a>
              </div>
            </>
          )}
        </aside>
      </div>

      {preview && (
        <div className="panel span-all tree-panel">
          <SectionTitle icon={FolderOpen} title="导出目录预览" />
          <div className="tree-root">{preview.rootName}</div>
          <div className="tree-grid">
            {preview.items.map((item) => (
              <div key={item.itemId} className="tree-folder">
                <strong>{item.folderName}</strong>
                {item.files.length === 0 ? <span>未匹配证据说明.txt</span> : item.files.map((file) => <span key={file.exportName}>{file.exportName}</span>)}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function PackageStep({ icon: Icon, step, title, meta, active }) {
  return (
    <div className={active ? 'package-step active' : 'package-step'}>
      <span>{step}</span>
      <Icon size={17} />
      <div>
        <strong>{title}</strong>
        <small>{meta}</small>
      </div>
    </div>
  );
}

function SearchPage({ projectId }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [results, setResults] = useState([]);

  async function runSearch(event) {
    event.preventDefault();
    setResults(await api.search({ projectId, q: query, type }));
  }

  return (
    <section className="workspace">
      <div className="workspace-main">
        <FormPanel title="全局搜索" onSubmit={runSearch}>
          <div className="search-row">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="签证编号、材料名称、计量月份、部位名称" />
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">全部类型</option>
              <option value="variation">签证变更单</option>
              <option value="hidden">隐蔽工程记录</option>
              <option value="material">材料进场记录</option>
              <option value="monthly">月度计量记录</option>
              <option value="supplemental">后补资料</option>
            </select>
            <button>
              <Search size={16} />
              搜索
            </button>
          </div>
        </FormPanel>
      </div>
      <aside className="workspace-side">
        <SectionTitle icon={FileSearch} title="搜索结果" />
        <EvidenceList records={results} />
      </aside>
    </section>
  );
}

function SettingsPage({ activeProject, locations = [], onCreated }) {
  const [busy, setBusy] = useState(false);
  return (
    <section className="workspace">
      <div className="workspace-main">
        <FormPanel
          title="项目管理"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            setBusy(true);
            const formData = new FormData(form);
            const project = await api.createProject(Object.fromEntries(formData.entries()));
            setBusy(false);
            onCreated(project);
            form.reset();
          }}
        >
          <div className="form-grid">
            <Field name="name" label="项目名称" placeholder="示例：东方广场三期总承包项目" required />
            <Field name="code" label="项目编号" placeholder="DFGC-2026" />
            <Field name="manager" label="负责人" placeholder="商务经理 / 结算专员" />
          </div>
          <Textarea name="locations" label="初始常用部位" placeholder={'3#楼地下室底板\n3#楼2层柱KL1\n地下室外墙防水'} />
          <SubmitButton label={busy ? '保存中' : activeProject ? '新增另一个项目' : '创建项目'} disabled={busy} />
        </FormPanel>
      </div>
      <aside className="workspace-side">
        <SectionTitle icon={FolderOpen} title="当前项目部位" />
        <div className="tag-list vertical">
          {locations.map((location) => <span key={location.id}>{location.name}</span>)}
          {locations.length === 0 && <EmptyText text="部位会从项目设置和证据录入中沉淀" />}
        </div>
      </aside>
    </section>
  );
}

function EvidenceList({ records, compact = false }) {
  if (!records.length) return <EmptyText text="暂无证据记录" />;
  return (
    <div className={compact ? 'evidence-list compact' : 'evidence-list'}>
      {records.map((record) => (
        <article key={record.id}>
          <div>
            <StatusDot type={record.type} />
            <strong>{record.title}</strong>
          </div>
          <p>{evidenceSummary(record)}</p>
          {!compact && <span>{evidenceDetail(record)}</span>}
        </article>
      ))}
    </div>
  );
}

function SessionList({ sessions, onSelect }) {
  if (!sessions.length) return <EmptyText text="暂无组卷批次" />;
  return (
    <div className="session-list">
      {sessions.map((session) => (
        <button key={session.id} onClick={() => onSelect?.(session.id)}>
          <FileArchive size={16} />
          <span>{session.name}</span>
        </button>
      ))}
    </div>
  );
}

function SupplementalUpload({ onSubmit }) {
  const [files, setFiles] = useState([]);
  return (
    <form
      className="supplemental"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        files.forEach((file) => formData.append('attachments', file));
        onSubmit(formData);
        setFiles([]);
        event.currentTarget.reset();
      }}
    >
      <FileDrop label="后补资料" files={files} setFiles={setFiles} multiple />
      <button>
        <Upload size={16} />
        补传并关联
      </button>
    </form>
  );
}

function FormPanel({ title, onSubmit, children }) {
  return (
    <form className="form-panel" onSubmit={onSubmit}>
      <h2>{title}</h2>
      {children}
    </form>
  );
}

function Field({ label, name, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} {...props} />
    </label>
  );
}

function Textarea({ label, name, ...props }) {
  return (
    <label className="field full">
      <span>{label}</span>
      <textarea name={name} {...props} />
    </label>
  );
}

function SelectField({ label, name, options }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function UnitField() {
  const listId = 'material-unit-options';
  return (
    <label className="field">
      <span>单位</span>
      <input name="unit" list={listId} placeholder="吨" required />
      <datalist id={listId}>
        {['吨', 'm³', '㎡', '个', '米', '千克', '箱', '根'].map((unit) => (
          <option key={unit} value={unit} />
        ))}
      </datalist>
    </label>
  );
}

function LocationField({ label, name, locations, ...props }) {
  const listId = `${name}-options`;
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} list={listId} placeholder="输入或选择部位" {...props} />
      <datalist id={listId}>
        {locations.map((location) => <option key={location.id} value={location.name} />)}
      </datalist>
    </label>
  );
}

function FileDrop({ label, files, setFiles, multiple = false, accept }) {
  return (
    <label className="file-drop">
      <Upload size={18} />
      <span>{label}</span>
      <strong>{files.length ? files.map((file) => file.name).join('，') : '选择文件'}</strong>
      <input
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={(event) => setFiles(Array.from(event.target.files || []))}
      />
    </label>
  );
}

function SubmitButton({ label, disabled }) {
  return (
    <button className="submit-button" disabled={disabled}>
      <Save size={17} />
      {label}
    </button>
  );
}

function ColumnSelect({ label, value, headers, onChange }) {
  return (
    <label className="column-select">
      <span>{label}</span>
      <select value={value || ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">不导入</option>
        {headers.map((header) => <option key={header} value={header}>{header}</option>)}
      </select>
    </label>
  );
}

function SectionTitle({ icon: Icon, title, compact = false }) {
  return (
    <div className={compact ? 'section-title compact-title' : 'section-title'}>
      <Icon size={18} />
      <h2>{title}</h2>
    </div>
  );
}

function StatusBadge({ status }) {
  return <span className={`status-badge ${status}`}>{statusLabels[status] || status}</span>;
}

function StatusDot({ type }) {
  return <span className={`status-dot ${type}`} />;
}

function EmptyText({ text }) {
  return <p className="empty-text">{text}</p>;
}

function evidenceSummary(record) {
  const payload = record.payload || {};
  const fileCount = (record.files || []).length;
  if (record.type === 'material') {
    const material = [payload.materialName || record.title, payload.spec].filter(Boolean).join(' ');
    const quantity = [formatNumber(payload.quantity), payload.unit].filter(Boolean).join('');
    return `材料进场 · ${material || '未填材料'} · ${quantity || '未填数量'} · ${record.evidenceDate || '未填日期'} · ${fileCount} 个附件`;
  }
  if (record.type === 'monthly') {
    const value = formatNumber(payload.currentValue ?? record.amount);
    return `月度计量 · ${payload.month || record.title} · 产值${value || '未填'} · ${fileCount} 个附件 · 趋势预留`;
  }
  return `${evidenceLabels[record.type] || record.type} · ${record.location || '未填部位'} · ${record.evidenceDate || '未填日期'}`;
}

function evidenceDetail(record) {
  const payload = record.payload || {};
  if (record.type === 'material') {
    return [payload.brand && `品牌 ${payload.brand}`, payload.supplier && `供应商 ${payload.supplier}`, payload.receiver && `收货人 ${payload.receiver}`]
      .filter(Boolean)
      .join(' · ') || `${(record.files || []).length} 个附件`;
  }
  if (record.type === 'monthly') {
    return [payload.confirmDate && `${payload.confirmDate} 确认`, payload.ownerSigner && `甲方 ${payload.ownerSigner}`, payload.cumulativeValue && `累计 ${formatNumber(payload.cumulativeValue)}`]
      .filter(Boolean)
      .join(' · ') || `${(record.files || []).length} 个附件`;
  }
  return `${(record.files || []).length} 个附件`;
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(number);
}

async function createWatermarkedImage(file, { location, date, photographer }) {
  if (!file.type.startsWith('image/')) return file;
  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  const maxWidth = 1800;
  const scale = Math.min(1, maxWidth / image.width);
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const line = `项目证据链 | ${location || '未填部位'} | ${date || new Date().toISOString().slice(0, 10)} | ${photographer || '未填拍摄人'}`;
  const fontSize = Math.max(22, Math.round(canvas.width * 0.022));
  ctx.font = `${fontSize}px "Microsoft YaHei", Arial, sans-serif`;
  const padding = Math.round(fontSize * 0.9);
  const height = fontSize + padding * 1.6;
  ctx.fillStyle = 'rgba(8, 20, 36, 0.72)';
  ctx.fillRect(0, canvas.height - height, canvas.width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(line, padding, canvas.height - padding);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('水印图片生成失败'));
    }, 'image/jpeg', 0.9);
  });
  return new File([blob], `水印_${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = reject;
    image.src = url;
  });
}
