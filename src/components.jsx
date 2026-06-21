import { FileArchive, FileSearch, Save, Upload } from 'lucide-react';
import { useState } from 'react';
import { api } from './api.js';
import { evidenceLabels, statusLabels } from './domain.js';

export function EvidenceList({ records, compact = false }) {
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
          {record.semanticScore != null && <span>AI 相关度 {record.semanticScore}%{record.semanticFallback ? ' · 关键词回退' : ''}</span>}
          {!compact && <span>{evidenceDetail(record)}</span>}
        </article>
      ))}
    </div>
  );
}

export function SessionList({ sessions, onSelect }) {
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

export function SupplementalUpload({ onSubmit }) {
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

export function FormPanel({ title, onSubmit, children }) {
  return (
    <form className="form-panel" onSubmit={onSubmit}>
      <h2>{title}</h2>
      {children}
    </form>
  );
}

export function Field({ label, name, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} {...props} />
    </label>
  );
}

export function Textarea({ label, name, ...props }) {
  return (
    <label className="field full">
      <span>{label}</span>
      <textarea name={name} {...props} />
    </label>
  );
}

export function SelectField({ label, name, options }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

export function UnitField() {
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

export function LocationField({ label, name, locations, ...props }) {
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

export function FileDrop({ label, files, setFiles, multiple = false, accept }) {
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

export function SubmitButton({ label, disabled }) {
  return (
    <button className="submit-button" disabled={disabled}>
      <Save size={17} />
      {label}
    </button>
  );
}

export function AiRecognizeButton({ evidenceType, files, setResult }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="secondary ai-recognize-button"
      disabled={busy || files.length === 0}
      onClick={async (event) => {
        const form = event.currentTarget.form;
        setBusy(true);
        try {
          const draft = await api.ocrExtract(evidenceType, files);
          applyDraftToForm(form, draft.fields || {});
          setResult({ ...draft, ok: true });
        } catch (error) {
          setResult({ ok: false, warnings: [error.message || 'AI 识别失败，请手动填写'] });
        } finally {
          setBusy(false);
        }
      }}
    >
      <FileSearch size={16} />
      {busy ? 'AI 识别中' : 'AI 识别填写'}
    </button>
  );
}

export function AiResultNote({ result }) {
  if (!result) return null;
  const warnings = result.warnings || [];
  return (
    <div className={result.ok ? 'ai-result-note' : 'ai-result-note error'}>
      <strong>{result.ok ? `识别完成 · 置信度 ${Math.round((result.confidence || 0) * 100)}%` : '识别未完成'}</strong>
      {warnings.map((warning) => <span key={warning}>{warning}</span>)}
    </div>
  );
}

export function CompletenessBadge({ item }) {
  if (!item) return <span className="completeness-badge muted">未检查</span>;
  const labels = {
    complete: '完整',
    incomplete: '不完整',
    critical: '严重缺失'
  };
  return <span className={`completeness-badge ${item.status}`}>{labels[item.status] || item.status}</span>;
}

export function applyDraftToForm(form, fields) {
  if (!form) return;
  for (const [key, value] of Object.entries(fields)) {
    const field = form.elements.namedItem(key);
    if (!field) continue;
    if (field.type === 'checkbox') {
      field.checked = Boolean(value);
    } else {
      field.value = value;
    }
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

export function ColumnSelect({ label, value, headers, onChange }) {
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

export function SectionTitle({ icon: Icon, title, compact = false }) {
  return (
    <div className={compact ? 'section-title compact-title' : 'section-title'}>
      <Icon size={18} />
      <h2>{title}</h2>
    </div>
  );
}

export function StatusBadge({ status }) {
  return <span className={`status-badge ${status}`}>{statusLabels[status] || status}</span>;
}

export function StatusDot({ type }) {
  return <span className={`status-dot ${type}`} />;
}

export function EmptyText({ text }) {
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

export async function createWatermarkedImage(file, { location, date, photographer }) {
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
