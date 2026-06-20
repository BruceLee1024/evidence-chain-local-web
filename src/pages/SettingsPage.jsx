import { FolderOpen, RefreshCw, Save, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { EmptyText, Field, FormPanel, SectionTitle, SubmitButton, Textarea } from '../components.jsx';

export function SettingsPage({ activeProject, locations = [], onCreated }) {
  const [busy, setBusy] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  useEffect(() => {
    api.aiSettings().then(setAiStatus).catch(() => setAiStatus({ enabled: false, error: 'AI 状态读取失败', providers: [] }));
  }, []);
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
        <SectionTitle icon={Settings} title="AI 配置" compact />
        <AiSettingsPanel aiStatus={aiStatus} setAiStatus={setAiStatus} />
      </aside>
    </section>
  );
}

function AiSettingsPanel({ aiStatus, setAiStatus }) {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const providers = aiStatus?.providers || [];
  const selectedProvider = providers.find((provider) => provider.id === aiStatus?.provider) || providers[0];
  const modelOptions = selectedProvider?.modelOptions || [];
  const visionModelOptions = selectedProvider?.visionModelOptions || modelOptions;
  const embeddingModelOptions = selectedProvider?.embeddingModelOptions || modelOptions;

  async function saveSettings(event) {
    event.preventDefault();
    const payload = aiSettingsPayloadFromForm(event.currentTarget);
    setSaving(true);
    setMessage('');
    try {
      const next = await api.saveAiSettings(payload);
      setAiStatus(next);
      setMessage('AI 设置已保存');
      event.currentTarget.elements.apiKey.value = '';
    } catch (error) {
      setMessage(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function testSettings(event) {
    const form = event.currentTarget.form;
    const payload = aiSettingsPayloadFromForm(form);
    setTesting(true);
    setMessage('');
    try {
      const result = await api.testAiSettings(payload);
      setMessage(`API 连通正常 · ${result.model} · ${result.durationMs}ms`);
    } catch (error) {
      setMessage(error.message || 'API 连通检查失败');
    } finally {
      setTesting(false);
    }
  }

  if (!aiStatus) {
    return <div className="ai-status-box"><span>正在读取 AI 配置</span></div>;
  }

  return (
    <form className="ai-settings-form" onSubmit={saveSettings}>
      <div className="ai-status-head">
        <strong>{aiStatus.enabled ? 'AI 已启用' : 'AI 未启用'}</strong>
        {aiStatus.apiKeySet && <span>Key：{aiStatus.apiKeyMasked}</span>}
      </div>

      <label className="field">
        <span>AI 服务商</span>
        <select
          name="provider"
          defaultValue={aiStatus.provider || selectedProvider?.id || 'deepseek'}
          onChange={(event) => {
            const provider = providers.find((item) => item.id === event.target.value);
            if (!provider) return;
            setAiStatus({
              ...aiStatus,
              provider: provider.id,
              baseUrl: provider.baseUrl,
              model: provider.model,
              visionModel: provider.visionModel,
              embeddingModel: provider.embeddingModel,
              supportsVision: provider.supportsVision,
              selectedProvider: provider
            });
          }}
        >
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>{provider.label}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>API Key</span>
        <input name="apiKey" type="password" placeholder={aiStatus.apiKeySet ? '留空则保留当前 Key' : '输入国内模型 API Key'} autoComplete="off" />
      </label>

      <label className="field">
        <span>API 地址</span>
        <input name="baseUrl" value={aiStatus.baseUrl || ''} onChange={(event) => setAiStatus({ ...aiStatus, baseUrl: event.target.value })} />
      </label>

      <ModelSelect
        label="文本模型"
        name="model"
        value={aiStatus.model || ''}
        options={modelOptions}
        onChange={(value) => setAiStatus({ ...aiStatus, model: value })}
      />

      <ModelSelect
        label="视觉模型"
        name="visionModel"
        value={aiStatus.visionModel || ''}
        options={visionModelOptions}
        onChange={(value) => setAiStatus({ ...aiStatus, visionModel: value })}
      />

      <ModelSelect
        label="向量模型"
        name="embeddingModel"
        value={aiStatus.embeddingModel || ''}
        options={embeddingModelOptions}
        onChange={(value) => setAiStatus({ ...aiStatus, embeddingModel: value })}
      />

      <label className="toggle-field">
        <input
          type="checkbox"
          name="supportsVision"
          value="true"
          checked={Boolean(aiStatus.supportsVision)}
          onChange={(event) => setAiStatus({ ...aiStatus, supportsVision: event.target.checked })}
        />
        支持图片/扫描件识别
      </label>

      <div className="ai-feature-grid">
        {[
          ['ocr', 'OCR 填表'],
          ['semanticSearch', '语义搜索'],
          ['matching', '增强匹配'],
          ['completeness', '完整性检查']
        ].map(([value, label]) => (
          <label key={value}>
            <input type="checkbox" name="features" value={value} defaultChecked={(aiStatus.features || []).includes(value)} />
            {label}
          </label>
        ))}
      </div>

      <div className="ai-settings-actions">
        <button type="button" className="secondary" disabled={testing} onClick={testSettings}>
          <RefreshCw size={16} />
          {testing ? '检查中' : '检查连通'}
        </button>
        <button disabled={saving}>
          <Save size={16} />
          {saving ? '保存中' : '保存 AI 设置'}
        </button>
      </div>
      {message && <p className="form-hint">{message}</p>}
      {aiStatus.error && <p className="form-hint error">{aiStatus.error}</p>}
    </form>
  );
}

function ModelSelect({ label, name, value, options, onChange }) {
  const normalizedOptions = normalizeModelOptions(options, value);
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} value={value} onChange={(event) => onChange(event.target.value)}>
        {normalizedOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function normalizeModelOptions(options = [], value = '') {
  const normalized = options.length ? options : value ? [{ value, label: value }] : [];
  if (value && !normalized.some((option) => option.value === value)) {
    return [{ value, label: `${value}（当前）` }, ...normalized];
  }
  return normalized;
}

function aiSettingsPayloadFromForm(form) {
  const formData = new FormData(form);
  return {
    provider: formData.get('provider'),
    apiKey: formData.get('apiKey'),
    baseUrl: formData.get('baseUrl'),
    model: formData.get('model'),
    visionModel: formData.get('visionModel'),
    embeddingModel: formData.get('embeddingModel'),
    supportsVision: formData.get('supportsVision') === 'true',
    features: formData.getAll('features')
  };
}
