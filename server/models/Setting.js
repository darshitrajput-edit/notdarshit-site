const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  settings: {
    name: { type: String, default: '' },
    tagline: { type: String, default: '' },
    intro: { type: String, default: '' },
    aboutText: { type: String, default: '' },
    yearsExperience: { type: String, default: '' },
    profilePhoto: { type: String, default: '' },
    gmail: { type: String, default: '' },
    instagram: { type: String, default: '' },
    discord: { type: String, default: '' },
    accentColor: { type: String, default: '' },
    skills: { type: mongoose.Schema.Types.Mixed, default: [] }
  },
  categories: { type: [String], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Setting', settingSchema);
