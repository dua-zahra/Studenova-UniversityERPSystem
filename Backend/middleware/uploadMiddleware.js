const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = 'uploads/students/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const sanitizeFilename = (filename) => {
  return filename.replace(/[^a-zA-Z0-9-_.]/g, '_');
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitized = sanitizeFilename(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(sanitized));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only ${allowedExtensions.join(', ')} are allowed.`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { 
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 
  }
});

const studentUpload = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'domicile', maxCount: 1 },
  { name: 'matricDocument', maxCount: 1 },
  { name: 'intermediateDocument', maxCount: 1 }
]);

const handleMulterErrors = (err, req, res, next) => {
  if (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ 
        success: false,
        error: 'File upload error',
        message: err.message 
      });
    }
    return res.status(400).json({ 
      success: false,
      error: 'Validation error',
      message: err.message 
    });
  }
  next();
};

module.exports = {
  studentUpload,
  handleMulterErrors
};