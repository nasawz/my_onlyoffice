const { Router } = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`);
  }
});

const imageUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error("仅支持图片文件 (jpg/png/gif/webp/svg/bmp)"));
    }
  }
});

const docUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(docx?|xlsx?|pdf|tex|md)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error("仅支持文档文件 (doc/docx/xls/xlsx/pdf/tex/md)"));
    }
  }
});

const router = Router();

router.post("/upload-image", imageUpload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: "未收到图片文件" });
  }
  res.json({
    ok: true,
    url: `/uploads/${req.file.filename}`,
    filename: req.file.filename,
    size: req.file.size
  });
});

router.post("/upload-doc", docUpload.single("document"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: "未收到文档文件" });
  }
  res.json({
    ok: true,
    url: `/uploads/${req.file.filename}`,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size
  });
});

module.exports = { router, UPLOADS_DIR };
