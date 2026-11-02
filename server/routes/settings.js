const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  const data = db.read();
  res.json({ settings: data.settings, categories: data.categories });
});

router.put('/', requireAdmin, async (req, res) => {
  const allowed = [
    'name',
    'tagline',
    'intro',
    'aboutText',
    'yearsExperience',
    'profilePhoto',
    'gmail',
    'instagram',
    'discord',
    'accentColor',
    'skills',
  ];

  const updated = await db.update((data) => {
    for (const key of allowed) {
      if (key in req.body) data.settings[key] = req.body[key];
    }
    return data.settings;
  });

  res.json(updated);
});

module.exports = router;
