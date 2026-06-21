import fsp from 'node:fs/promises';
import { Router } from 'express';
import { getDb } from '../db.js';
import { attachFileToEvidence, mapUploadFields, persistUpload } from '../fileStore.js';
import {
  createEvidence,
  listEvidence,
  listFilesForEvidence
} from '../repository.js';
import { requireProject } from './projects.js';

export function createEvidenceRouter(upload) {
  const router = Router();

  router.get('/projects/:projectId/evidence', requireProject, (req, res) => {
    const evidence = listEvidence(req.params.projectId, req.query.type || '');
    const fileRows = listFilesForEvidence(evidence.map((item) => item.id));
    res.json(withFiles(evidence, fileRows));
  });

  router.post('/projects/:projectId/variation-orders', requireProject, upload.array('attachments'), async (req, res, next) => {
    try {
      const evidence = createEvidence(req.params.projectId, {
        type: 'variation',
        code: req.body.code,
        title: req.body.reason || req.body.code || '签证变更单',
        location: req.body.location,
        evidenceDate: req.body.signDate,
        amount: req.body.amount,
        payload: {
          changeType: req.body.changeType,
          scheduleImpact: req.body.scheduleImpact === 'true',
          contractorSigner: req.body.contractorSigner,
          supervisorSigner: req.body.supervisorSigner,
          ownerSigner: req.body.ownerSigner,
          note: req.body.note
        }
      });

      await persistEvidenceFiles(req.params.projectId, evidence.id, { attachments: req.files || [] }, { attachments: 'attachment' });
      res.status(201).json(await getEvidenceWithFiles(evidence.id));
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/projects/:projectId/hidden-records',
    requireProject,
    upload.fields([
      { name: 'photos', maxCount: 30 },
      { name: 'watermarkedPhotos', maxCount: 30 },
      { name: 'acceptanceFile', maxCount: 1 }
    ]),
    async (req, res, next) => {
      try {
        const evidence = createEvidence(req.params.projectId, {
          type: 'hidden',
          title: req.body.process ? `${req.body.location || ''}${req.body.process}` : '隐蔽工程记录',
          location: req.body.location,
          evidenceDate: req.body.acceptanceDate,
          payload: {
            process: req.body.process,
            conclusion: req.body.conclusion,
            photographer: req.body.photographer,
            note: req.body.note
          }
        });

        const fields = mapUploadFields(req.files);
        await persistEvidenceFiles(req.params.projectId, evidence.id, fields, {
          photos: 'photo_original',
          watermarkedPhotos: 'watermarked',
          acceptanceFile: 'acceptance'
        });
        res.status(201).json(await getEvidenceWithFiles(evidence.id));
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/projects/:projectId/material-records',
    requireProject,
    upload.fields([
      { name: 'certificates', maxCount: 30 },
      { name: 'photos', maxCount: 30 }
    ]),
    async (req, res, next) => {
      try {
        const fields = mapUploadFields(req.files);
        const entryDate = String(req.body.entryDate || '').trim();
        const materialName = String(req.body.materialName || '').trim();
        const spec = String(req.body.spec || '').trim();
        const unit = String(req.body.unit || '').trim();
        const quantity = Number(req.body.quantity || 0);

        if (!entryDate) return await validationError(res, fields, '进场日期不能为空');
        if (!materialName) return await validationError(res, fields, '材料名称不能为空');
        if (!unit) return await validationError(res, fields, '单位不能为空');
        if (!Number.isFinite(quantity) || quantity <= 0) return await validationError(res, fields, '进场数量必须大于 0');
        if (!hasUpload(fields, ['certificates', 'photos'])) return await validationError(res, fields, '请至少上传合格证或验收照片');

        const evidence = createEvidence(req.params.projectId, {
          type: 'material',
          title: [materialName, spec].filter(Boolean).join(' '),
          location: '',
          evidenceDate: entryDate,
          amount: null,
          payload: {
            materialName,
            spec,
            unit,
            quantity,
            brand: req.body.brand,
            supplier: req.body.supplier,
            receiver: req.body.receiver,
            note: req.body.note
          }
        });

        await persistEvidenceFiles(req.params.projectId, evidence.id, fields, {
          certificates: 'certificate',
          photos: 'photo'
        });
        res.status(201).json(await getEvidenceWithFiles(evidence.id));
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/projects/:projectId/monthly-measurements',
    requireProject,
    upload.fields([
      { name: 'confirmFiles', maxCount: 30 },
      { name: 'detailFiles', maxCount: 30 }
    ]),
    async (req, res, next) => {
      try {
        const fields = mapUploadFields(req.files);
        const month = String(req.body.month || '').trim();
        const confirmDate = String(req.body.confirmDate || '').trim();
        const currentValue = Number(req.body.currentValue || 0);
        const cumulativeValue = Number(req.body.cumulativeValue || 0);

        if (!/^\d{4}-\d{2}$/.test(month)) return await validationError(res, fields, '计量月份格式必须为 YYYY-MM');
        if (!confirmDate) return await validationError(res, fields, '确认日期不能为空');
        if (!Number.isFinite(currentValue) || currentValue <= 0) return await validationError(res, fields, '本期完成产值必须大于 0');
        if (!Number.isFinite(cumulativeValue) || cumulativeValue <= 0) return await validationError(res, fields, '累计完成产值必须大于 0');

        const evidence = createEvidence(req.params.projectId, {
          type: 'monthly',
          title: `${month} 月度计量`,
          location: '',
          evidenceDate: confirmDate,
          amount: currentValue,
          payload: {
            month,
            confirmDate,
            currentValue,
            cumulativeValue,
            ownerSigner: req.body.ownerSigner,
            note: req.body.note
          }
        });

        await persistEvidenceFiles(req.params.projectId, evidence.id, fields, {
          confirmFiles: 'confirmation',
          detailFiles: 'detail'
        });
        res.status(201).json(await getEvidenceWithFiles(evidence.id));
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

async function persistEvidenceFiles(projectId, evidenceId, fields, roles) {
  for (const [fieldName, uploads] of Object.entries(fields)) {
    const role = roles[fieldName];
    if (!role) continue;
    for (const [index, uploadFile] of uploads.entries()) {
      const saved = await persistUpload(projectId, uploadFile);
      attachFileToEvidence(evidenceId, saved.id, role, index);
    }
  }
}

async function getEvidenceWithFiles(evidenceId) {
  const evidence = listEvidence('').find((item) => item.id === evidenceId);
  if (!evidence) {
    const row = getDb().prepare(`
      SELECT project_id AS projectId FROM evidence WHERE id = ?
    `).get(evidenceId);
    const fallback = listEvidence(row.projectId).find((item) => item.id === evidenceId);
    return withFiles([fallback], listFilesForEvidence([evidenceId]))[0];
  }
  return withFiles([evidence], listFilesForEvidence([evidenceId]))[0];
}

function withFiles(evidence, files) {
  const grouped = new Map();
  for (const file of files) {
    if (!grouped.has(file.evidenceId)) grouped.set(file.evidenceId, []);
    grouped.get(file.evidenceId).push(file);
  }
  return evidence.map((item) => ({ ...item, files: grouped.get(item.id) || [] }));
}

async function validationError(res, fields, message) {
  await discardUploads(fields);
  return res.status(400).json({ error: message });
}

function hasUpload(fields, names) {
  return names.some((name) => (fields[name] || []).length > 0);
}

async function discardUploads(fields = {}) {
  const uploads = Object.values(fields).flat();
  await Promise.all(uploads.map((file) => fsp.unlink(file.path).catch(() => {})));
}
