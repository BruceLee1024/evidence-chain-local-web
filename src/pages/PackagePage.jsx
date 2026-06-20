import { Boxes, CheckCircle2, ClipboardList, Download, FileArchive, FolderOpen, Link2, Upload, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api, sampleSettlementText } from '../api.js';
import { evidenceLabels, evidenceTypes, statusLabels } from '../domain.js';
import { ColumnSelect, CompletenessBadge, EmptyText, SectionTitle, SessionList, StatusBadge, SupplementalUpload } from '../components.jsx';

export function PackagePage({ projectId, evidence, sessions, refreshProjectData, runAction }) {
  const [pasteText, setPasteText] = useState(sampleSettlementText);
  const [parsed, setParsed] = useState(null);
  const [columns, setColumns] = useState({});
  const [payload, setPayload] = useState(null);
  const [activeItemId, setActiveItemId] = useState('');
  const [preview, setPreview] = useState(null);
  const [completeness, setCompleteness] = useState([]);

  const activeItem = payload?.items.find((item) => item.id === activeItemId) || payload?.items[0];
  const activeLinks = payload?.links.filter((link) => link.itemId === activeItem?.id) || [];
  const evidenceById = useMemo(() => new Map((payload?.evidence || []).map((item) => [item.id, item])), [payload]);
  const completenessByItem = useMemo(() => new Map(completeness.map((item) => [item.itemId, item])), [completeness]);
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
    setCompleteness([]);
    await refreshProjectData(projectId);
  }

  async function loadSession(sessionId) {
    const result = await api.settlement(projectId, sessionId);
    setPayload(result);
    setActiveItemId(result.items[0]?.id || '');
    setPreview(null);
    setCompleteness([]);
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
          {payload && (
            <div className="button-row package-ai-actions">
              <button
                type="button"
                onClick={() => runAction(async () => {
                  const next = await api.rematchAi(projectId, payload.session.id);
                  await refreshSession(next);
                }, 'AI 候选匹配已生成')}
              >
                <Link2 size={16} />
                AI 增强匹配
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => runAction(async () => {
                  setCompleteness(await api.checkCompleteness(projectId, payload.session.id));
                }, '完整性检查已完成')}
              >
                <CheckCircle2 size={16} />
                完整性检查
              </button>
            </div>
          )}
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
                    <th>完整性</th>
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
                      <td><CompletenessBadge item={completenessByItem.get(item.id)} /></td>
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
