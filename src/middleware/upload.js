// src/middleware/upload.js
import multer from "multer";

const storage = multer.memoryStorage();

// Safe filter — do NOT reject images just because mimetype missing
const fileFilter = (req, file, cb) => {
  if (!file) return cb(null, false);

  if (!file.mimetype || file.mimetype === "application/octet-stream") {
    // accept anyway — Firebase will verify later
    return cb(null, true);
  }

  if (file.mimetype.startsWith("image/")) {
    return cb(null, true);
  }

  cb(null, false);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // allow 20MB for mobile images
  },
});
