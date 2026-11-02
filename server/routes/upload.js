const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

function makeStorage(subfolder) {
  return multer.diskStorage({
    destination: path.join(__dirname, '..', 'uploads', subfolder),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeName = crypto.randomBytes(16).toString('hex') + ext;
      cb(null, safeName);
    },
  });
}

const thumbnailUpload = multer({
  storage: makeStorage('thumbnails'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return cb(new Error('Thumbnails must be JPG, PNG, or WebP.'));
    }
    cb(null, true);
  },
});

const videoUpload = multer({
  storage: makeStorage('videos'),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB — see README on hosting large video files
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
      return cb(new Error('Videos must be MP4, WebM, or MOV.'));
    }
    cb(null, true);
  },
});

function handleUpload(uploader, subfolder) {
  return (req, res) => {
    uploader(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: 'No file received.' });
      res.json({ url: `/uploads/${subfolder}/${req.file.filename}` });
    });
  };
}

router.post('/thumbnail', requireAdmin, handleUpload(thumbnailUpload.single('thumbnail'), 'thumbnails'));
router.post('/video', requireAdmin, handleUpload(videoUpload.single('video'), 'videos'));

module.exports = router;
