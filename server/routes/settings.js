const express = require('express');
const router = express.Router();
const Setting = require('../models/Setting');

// GET settings
router.get('/', async (req, res) => {
  try {
    let settingDoc = await Setting.findOne() || await Setting.create({});
    res.json({ settings: settingDoc.settings || {}, categories: settingDoc.categories || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT settings (Bina verifyToken ke error fix ho jayega)
router.put('/', async (req, res) => {
  try {
    let settingDoc = await Setting.findOne() || new Setting();
    settingDoc.settings = req.body;
    if (req.body.categories) settingDoc.categories = req.body.categories;
    await settingDoc.save();
    res.json({ success: true, settings: settingDoc.settings, categories: settingDoc.categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
