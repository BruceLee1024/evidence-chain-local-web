import { Router } from 'express';
import { DATA_DIR } from '../config.js';
import {
  addLocation,
  createProject,
  getOverview,
  getProject,
  listLocations,
  listProjects
} from '../repository.js';

export function createProjectRouter() {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ ok: true, dataDir: DATA_DIR });
  });

  router.get('/projects', (_req, res) => {
    res.json(listProjects());
  });

  router.post('/projects', (req, res) => {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: '项目名称不能为空' });
    const locations = splitLocations(req.body.locations);
    res.status(201).json(createProject({ ...req.body, name, locations }));
  });

  router.get('/projects/:projectId/overview', requireProject, (req, res) => {
    res.json(getOverview(req.params.projectId));
  });

  router.get('/projects/:projectId/locations', requireProject, (req, res) => {
    res.json(listLocations(req.params.projectId));
  });

  router.post('/projects/:projectId/locations', requireProject, (req, res) => {
    const location = addLocation(req.params.projectId, req.body.name);
    res.status(201).json(location);
  });

  return router;
}

export function requireProject(req, res, next) {
  if (!getProject(req.params.projectId)) return res.status(404).json({ error: '项目不存在' });
  next();
}

function splitLocations(value) {
  if (Array.isArray(value)) return value;
  return String(value || '')
    .split(/\r?\n|,|，/)
    .map((item) => item.trim())
    .filter(Boolean);
}
