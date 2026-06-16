const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { 
  createFaculty, 
  getAllFaculty, 
  updateFaculty, 
  deleteFaculty, 
  getFacultyById, 
  blockFaculty, 
  unblockFaculty,
  getFacultyCount,
  cleanupBlockedFaculty,
  syncFacultyAssignments
} = require('../controllers/facultyController');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');  
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage: storage });

router.post('/', upload.fields([{ name: 'photo' }, { name: 'resume' }, { name: 'degree' }]), createFaculty);

router.get('/count', getFacultyCount);  
router.get('/', getAllFaculty);
router.put('/block/:id', blockFaculty);
router.put('/unblock/:id', unblockFaculty);

router.get('/:id', getFacultyById);
router.put('/:id', upload.fields([{ name: 'photo' }, { name: 'resume' }, { name: 'degree' }]), updateFaculty);
router.delete('/:id', deleteFaculty);
router.post('/faculty/cleanup-blocked', cleanupBlockedFaculty);
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});
router.post('/:facultyId/sync-assignments', syncFacultyAssignments);
module.exports = router;