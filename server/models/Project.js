const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, default: '' },
  date: { type: String, default: () => new Date().toISOString().slice(0, 10) },
  videoType: { type: String, default: 'youtube' },
  videoId: { type: String, default: null },
  videoUrl: { type: String, default: null },
  thumbnail: { type: String, required: true },
  published: { type: Boolean, default: false },
  reactions: {
    fire: { type: Number, default: 0 },
    good: { type: Number, default: 0 },
    bad: { type: Number, default: 0 }
  },
  reactedVisitors: { type: Map, of: String, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
