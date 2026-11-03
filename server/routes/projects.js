const express = require('express');
const crypto = require('crypto');
const Project = require('../models/Project');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const REACTIONS = ['fire', 'good', 'bad'];

function publicProject(p) {
  const obj = p.toObject ? p.toObject() : { ...p };
  delete obj.reactedVisitors;
  obj.id = obj._id.toString();
  return obj;
}

// ---------- Public: list + filter ----------
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    const query = { published: true };
    if (category) query.category = category;
    
    const projects = await Project.find(query).sort({ date: -1 });
    res.json(projects.map(publicProject));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects.' });
  }
});

// ---------- Admin: list everything ----------
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const projects = await Project.find().sort({ date: -1 });
    res.json(projects.map(p => {
      const obj = p.toObject();
      obj.id = obj._id.toString();
      return obj;
    }));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch all projects.' });
  }
});

// ---------- Public: single project ----------
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, published: true });
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    res.json(publicProject(project));
  } catch (err) {
    res.status(404).json({ error: 'Project not found.' });
  }
});

// ---------- Admin: create ----------
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { title, category, description, date, videoType, videoId, videoUrl, thumbnail, published } = req.body || {};

    if (!title || !category || !(videoId || videoUrl) || !thumbnail) {
      return res.status(400).json({ error: 'Title, category, thumbnail, and a video source are required.' });
    }

    const newProject = new Project({
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
      reactedVisitors: {}
    });

    await newProject.save();
    const result = newProject.toObject();
    result.id = result._id.toString();
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create project.' });
  }
});

// ---------- Admin: update ----------
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const updates = req.body || {};
    const allowed = ['title', 'category', 'description', 'date', 'videoType', 'videoId', 'videoUrl', 'thumbnail', 'published'];
    
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    for (const key of allowed) {
      if (key in updates) project[key] = updates[key];
    }

    await project.save();
    const result = project.toObject();
    result.id = result._id.toString();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update project.' });
  }
});

// ---------- Admin: publish / unpublish toggle ----------
router.patch('/:id/publish', requireAdmin, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    project.published = req.body && typeof req.body.published === 'boolean'
      ? req.body.published
      : !project.published;

    await project.save();
    const result = project.toObject();
    result.id = result._id.toString();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle publish status.' });
  }
});

// ---------- Admin: delete ----------
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await Project.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Project not found.' });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project.' });
  }
});

// ---------- Public: react ----------
const reactAttempts = new Map();
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
  try {
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

    const visitorHash = crypto.createHash('sha256').update(visitorId).digest('hex');
    const project = await Project.findOne({ _id: req.params.id, published: true });
    
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const previous = project.reactedVisitors.get(visitorHash);

    if (previous === reaction) {
      project.reactions[reaction] = Math.max(0, project.reactions[reaction] - 1);
      project.reactedVisitors.delete(visitorHash);
    } else {
      if (previous) {
        project.reactions[previous] = Math.max(0, project.reactions[previous] - 1);
      }
      project.reactions[reaction] = (project.reactions[reaction] || 0) + 1;
      project.reactedVisitors.set(visitorHash, reaction);
    }

    await project.save();

    res.json({
      reactions: project.reactions,
      yourReaction: project.reactedVisitors.get(visitorHash) || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record reaction.' });
  }
});

module.exports = router;
