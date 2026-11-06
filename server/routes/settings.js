const express = require('express');
const router = express.Router();
const Setting = require('../models/Setting');
const verifyToken = require('../middleware/auth'); // Aapke auth middleware ka path

// GET settings & categories
router.get('/', async (req, res) => {
  try {
    let settingDoc = await Setting.findOne();
    if (!settingDoc) {
      settingDoc = await Setting.create({});
    }
    res.json({ 
      settings: settingDoc.settings || {}, 
      categories: settingDoc.categories || [] 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update settings & categories
router.put('/', verifyToken, async (req, res) => {
  try {
    let settingDoc = await Setting.findOne();
    if (!settingDoc) {
      settingDoc = new Setting();
    }

    // Settings fields update karo
    settingDoc.settings = {
      name: req.body.name,
      tagline: req.body.tagline,
      intro: req.body.intro,
      aboutText: req.body.aboutText,
      yearsExperience: req.body.yearsExperience,
      skills: req.body.skills,
      profilePhoto: req.body.profilePhoto,
      gmail: req.body.gmail,
      instagram: req.body.instagram,
      discord: req.body.discord,
      accentColor: req.body.accentColor
    };

    // Categories update karo agar bheji gayi hain
    if (req.body.categories) {
      settingDoc.categories = req.body.categories;
    }

    await settingDoc.save();
    res.json({ 
      success: true, 
      settings: settingDoc.settings, 
      categories: settingDoc.categories 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
