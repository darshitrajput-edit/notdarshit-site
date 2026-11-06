const express = require('express');
const Setting = require('../models/Setting');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

async function getSettingsDoc() {
  let doc = await Setting.findOne();
  if (!doc) {
    doc = await Setting.create({
      settings: {},
      categories: ['Gaming Edits', 'Shorts / Reels', 'Cinematic Edits', 'Motion Graphics', 'YouTube Videos', 'Montage', 'Other Projects']
    });
  }
  return doc;
}

router.get('/', async (req, res) => {
  try {
    const doc = await getSettingsDoc();
    res.json({ settings: doc.settings, categories: doc.categories });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings.' });
  }
});

router.put('/', requireAdmin, async (req, res) => {
  try {
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

    const doc = await getSettingsDoc();

    for (const key of allowed) {
      if (key in req.body) {
        doc.settings[key] = req.body[key];
      }
    }

    if (req.body.categories) {
      doc.categories = req.body.categories;
    }

    doc.markModified('settings');
    await doc.save();

    res.json(doc.settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

module.exports = router;
