const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Admin = require('../models/Admin');

const uploadDir = path.join(__dirname, '../uploads/admin-profile-pics/');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `admin-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Error: Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 
  },
  fileFilter: fileFilter
});

const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(401).json({ 
      success: false, 
      message: 'Unauthorized: Admin access required' 
    });
  }
  next();
};

router.get('/profile-pic', requireAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.session.user.id).select('profilePic email');
    
    if (!admin) {
      return res.status(404).json({ 
        success: false, 
        message: 'Admin not found' 
      });
    }
    
    res.json({
      success: true,
      profilePic: admin.profilePic || null,
      email: admin.email
    });
    
  } catch (error) {
    console.error('Error fetching profile picture:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching profile picture' 
    });
  }
});

router.post('/upload', requireAdmin, upload.single('profilePic'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }

    const profilePicPath = `/uploads/admin-profile-pics/${req.file.filename}`;
    
    const admin = await Admin.findById(req.session.user.id);
    
    if (!admin) {
      
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ 
        success: false, 
        message: 'Admin not found' 
      });
    }
    
    if (admin.profilePic) {
      const oldImagePath = path.join(__dirname, '..', admin.profilePic);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }
    

    admin.profilePic = profilePicPath;
    await admin.save();
    
    res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      profilePic: profilePicPath,
      admin: {
        id: admin._id,
        email: admin.email
      }
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    
   
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Server error during upload' 
    });
  }
});

router.delete('/delete', requireAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.session.user.id);
    
    if (!admin) {
      return res.status(404).json({ 
        success: false, 
        message: 'Admin not found' 
      });
    }
    if (!admin.profilePic) {
      return res.status(400).json({ 
        success: false, 
        message: 'No profile picture to delete' 
      });
    }
    
    const imagePath = path.join(__dirname, '..', admin.profilePic);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
    
    admin.profilePic = null;
    await admin.save();
    
    res.json({
      success: true,
      message: 'Profile picture deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while deleting profile picture' 
    });
  }
});

module.exports = router;