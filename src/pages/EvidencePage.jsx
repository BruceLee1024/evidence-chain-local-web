import { ClipboardList } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api.js';
import { evidenceLabels, evidenceTypes } from '../domain.js';
import { AiRecognizeButton, AiResultNote, createWatermarkedImage, EmptyText, Field, FileDrop, FormPanel, LocationField, SectionTitle, SelectField, SubmitButton, Textarea, UnitField } from '../components.jsx';

export function EvidencePage({ projectId, evidence, locations, runAction }) {
  const [mode, setMode] = useState('variation');
  const visibleEvidence = evidence.filter((item) => evidenceTypes.includes(item.type));
  return (
    <section className="workspace evidence-workspace">
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
  const [aiResult, setAiResult] = useState(null);
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
      <AiRecognizeButton evidenceType="variation" files={files} setResult={setAiResult} />
      <AiResultNote result={aiResult} />
      <SubmitButton label="保存签证变更单" />
    </FormPanel>
  );
}

function HiddenRecordForm({ locations, onSubmit }) {
  const [photos, setPhotos] = useState([]);
  const [acceptanceFile, setAcceptanceFile] = useState([]);
  const [busy, setBusy] = useState(false);
  const [aiResult, setAiResult] = useState(null);
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
      <AiRecognizeButton evidenceType="hidden" files={[...photos, ...acceptanceFile]} setResult={setAiResult} />
      <AiResultNote result={aiResult} />
      <SubmitButton label={busy ? '正在生成水印' : '保存隐蔽工程记录'} disabled={busy} />
    </FormPanel>
  );
}

function MaterialRecordForm({ onSubmit }) {
  const [certificates, setCertificates] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');
  const [aiResult, setAiResult] = useState(null);

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
      <AiRecognizeButton evidenceType="material" files={[...certificates, ...photos]} setResult={setAiResult} />
      <AiResultNote result={aiResult} />
      {error && <p className="form-hint error">{error}</p>}
      <SubmitButton label="保存材料进场记录" />
    </FormPanel>
  );
}

function MonthlyMeasurementForm({ onSubmit }) {
  const [confirmFiles, setConfirmFiles] = useState([]);
  const [detailFiles, setDetailFiles] = useState([]);
  const [aiResult, setAiResult] = useState(null);

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
      <AiRecognizeButton evidenceType="monthly" files={[...confirmFiles, ...detailFiles]} setResult={setAiResult} />
      <AiResultNote result={aiResult} />
      <SubmitButton label="保存月度计量记录" />
    </FormPanel>
  );
}
