const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const REACTIONS = ['fire', 'good', 'bad'];

function publicProject(p) {
  // Never send the visitor map to the browser — it's only for server-side de-duping.
  const { reactedVisitors, ...rest } = p;
  return rest;
}

function nextId(projects) {
  const nums = projects
    .map((p) => parseInt(String(p.id).replace('proj_', ''), 10))
    .filter((n) => !Number.isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `proj_${String(max + 1).padStart(3, '0')}`;
}

// ---------- Public: list + filter ----------
router.get('/', (req, res) => {
  const data = db.read();
  const { category } = req.query;
  let projects = data.projects.filter((p) => p.published);
  if (category) {
    projects = projects.filter((p) => p.category === category);
  }
  projects.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(projects.map(publicProject));
});

// ---------- Admin: list everything, including unpublished ----------
router.get('/all', requireAdmin, (req, res) => {
  const data = db.read();
  const projects = [...data.projects].sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(projects);
});

// ---------- Public: single project ----------
router.get('/:id', (req, res) => {
  const data = db.read();
  const project = data.projects.find((p) => p.id === req.params.id && p.published);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  res.json(publicProject(project));
});

// ---------- Admin: create ----------
router.post('/', requireAdmin, async (req, res) => {
  const { title, category, description, date, videoType, videoId, videoUrl, thumbnail, published } =
    req.body || {};

  if (!title || !category || !(videoId || videoUrl) || !thumbnail) {
    return res.status(400).json({
      error: 'Title, category, thumbnail, and a video source are required.',
    });
  }

  const project = await db.update((data) => {
    const newProject = {
      id: nextId(data.projects),
      title,
      category,
      description: description || '',
      date: date || new Date().toISOString().slice(0, 10),
      videoType: videoType || 'youtube',
      videoId: videoId || null,
      videoUrl: videoUrl || null,
      thumbnail,
      published: Boolean(published),
      reactions: { fire: 0, good: 0, bad: 0 },
      reactedVisitors: {},
    };
    data.projects.push(newProject);
    return newProject;
  });

  res.status(201).json(project);
});

// ---------- Admin: update ----------
router.put('/:id', requireAdmin, async (req, res) => {
  const updates = req.body || {};
  const allowed = [
    'title',
    'category',
    'description',
    'date',
    'videoType',
    'videoId',
    'videoUrl',
    'thumbnail',
    'published',
  ];

  const updated = await db.update((data) => {
    const project = data.projects.find((p) => p.id === req.params.id);
    if (!project) return null;
    for (const key of allowed) {
      if (key in updates) project[key] = updates[key];
    }
    return project;
  });

  if (!updated) return res.status(404).json({ error: 'Project not found.' });
  res.json(updated);
});

// ---------- Admin: publish / unpublish toggle ----------
router.patch('/:id/publish', requireAdmin, async (req, res) => {
  const updated = await db.update((data) => {
    const project = data.projects.find((p) => p.id === req.params.id);
    if (!project) return null;
    project.published = req.body && typeof req.body.published === 'boolean'
      ? req.body.published
      : !project.published;
    return project;
  });

  if (!updated) return res.status(404).json({ error: 'Project not found.' });
  res.json(updated);
});

// ---------- Admin: delete ----------
router.delete('/:id', requireAdmin, async (req, res) => {
  const result = await db.update((data) => {
    const before = data.projects.length;
    data.projects = data.projects.filter((p) => p.id !== req.params.id);
    return data.projects.length < before;
  });

  if (!result) return res.status(404).json({ error: 'Project not found.' });
  res.status(204).end();
});

// ---------- Public: react ----------
// Light per-IP rate limit as a backstop against scripted spam,
// on top of the one-reaction-per-visitor rule below.
const reactAttempts = new Map(); // ip -> { count, windowStart }
const REACT_WINDOW_MS = 60 * 1000;
const REACT_MAX_PER_WINDOW = 20;

function isRateLimited(ip) {
  const rec = reactAttempts.get(ip);
  if (!rec || Date.now() - rec.windowStart > REACT_WINDOW_MS) {
    reactAttempts.set(ip, { count: 1, windowStart: Date.now() });
    return false;
  }
  rec.count += 1;
  return rec.count > REACT_MAX_PER_WINDOW;
}

router.post('/:id/react', async (req, res) => {
  const { reaction, visitorId } = req.body || {};

  if (!REACTIONS.includes(reaction)) {
    return res.status(400).json({ error: 'Reaction must be fire, good, or bad.' });
  }
  if (!visitorId || typeof visitorId !== 'string' || visitorId.length > 100) {
    return res.status(400).json({ error: 'Missing visitor id.' });
  }
  if (isRateLimited(req.ip)) {
    return res.status(429).json({ error: 'Slow down — too many reactions from this connection.' });
  }

  // Visitor ids are hashed before storage so the raw id never sits in the database file.
  const visitorHash = crypto.createHash('sha256').update(visitorId).digest('hex');

  const result = await db.update((data) => {
    const project = data.projects.find((p) => p.id === req.params.id && p.published);
    if (!project) return null;

    const previous = project.reactedVisitors[visitorHash];

    if (previous === reaction) {
      // Clicking the same reaction again removes it.
      project.reactions[reaction] = Math.max(0, project.reactions[reaction] - 1);
      delete project.reactedVisitors[visitorHash];
    } else {
      if (previous) {
        project.reactions[previous] = Math.max(0, project.reactions[previous] - 1);
      }
      project.reactions[reaction] += 1;
      project.reactedVisitors[visitorHash] = reaction;
    }

    return {
      reactions: project.reactions,
      yourReaction: project.reactedVisitors[visitorHash] || null,
    };
  });

  if (!result) return res.status(404).json({ error: 'Project not found.' });
  res.json(result);
});

module.exports = router;
