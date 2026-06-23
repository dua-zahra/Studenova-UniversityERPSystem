const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');

const Admin = require('../models/Admin');
const Faculty = require('../models/Faculty');
const Student = require('../models/Student');

const uploadDir = path.join(__dirname, '../uploads/profile-pics/');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `admin-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed!'), false);
  }
});

const ADMIN_CREDENTIALS = {
  email: "admin@csuniversity.com",
  plainPassword: "universityadmin",
};

router.post('/login',
  [
    body('email').isEmail().withMessage('Enter a valid email'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;

    try {
      if (email === ADMIN_CREDENTIALS.email) {
        let admin = await Admin.findOne({ email });

        if (!admin) {
          admin = new Admin({
            email,
            password: ADMIN_CREDENTIALS.plainPassword
          });
          await admin.save();
        }

        const isValid = await bcrypt.compare(password, admin.password);
        if (!isValid) return res.status(401).json({ error: "Invalid admin password" });

        req.session.user = { id: admin._id, email: admin.email, role: 'admin' };

        return res.json({
          success: true,
          message: "Admin login successful",
          role: "admin",
          token: req.sessionID,
          user: {
            _id: admin._id,
            email: admin.email,
            profilePic: admin.profilePic || null,
            role: "admin"
          }
        });
      }

      let faculty = await Faculty.findOne({ universityEmail: email }).select('+password');
      if (faculty) {

        req.session.user = { id: faculty._id, email: faculty.universityEmail, role: 'faculty' };

        return res.json({
          success: true,
          message: "Faculty login successful",
          role: "faculty",
          token: req.sessionID,
          user: {
            _id: faculty._id,
            firstName: faculty.firstName,
            lastName: faculty.lastName,
            universityEmail: faculty.universityEmail,
            profilePic: faculty.photo,
            role: "faculty"
          }
        });
      }

      
      // let student = await Student.findOne({ universityEmail: email }).select('+password');
      // if (student) {

      //   req.session.user = { id: student._id, email: student.universityEmail, role: 'student' };

      //   return res.json({
      //     success: true,
      //     message: "Student login successful",
      //     role: "student",
      //     token: req.sessionID,
      //     user: {
      //       _id: student._id,
      //       firstName: student.firstName,
      //       lastName: student.lastName,
      //       universityEmail: student.universityEmail,
      //       profilePic: student.profilePic || null,
      //       role: "student"
      //     }
      //   });
      // }
let student = await Student.findOne({ universityEmail: email }).select('+password');
if (student) {
  const isValid = await bcrypt.compare(password, student.password);
  if (!isValid) return res.status(401).json({ error: "Invalid student password" });

  req.session.user = { 
    id: student._id, 
    email: student.universityEmail, 
    role: 'student',
    studentId: student.studentId, 
    name: `${student.firstName} ${student.lastName}`,
    fullName: `${student.firstName} ${student.lastName}`,
    username: student.studentId
  };

  return res.json({
    success: true,
    message: "Student login successful",
    role: "student",
    token: req.sessionID,
    user: {
      _id: student._id,
      firstName: student.firstName,
      lastName: student.lastName,
      universityEmail: student.universityEmail,
      profilePic: student.profilePic || null,
      role: "student",
      studentId: student.studentId,
      fullName: `${student.firstName} ${student.lastName}`
    }
  });
}
      return res.status(401).json({ error: "User not found" });

    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false, message: "Logout failed" });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, message: "Logged out" });
  });
});

router.get('/session', (req, res) => {
  if (req.session.user && req.session.user.role) {
    res.json({ role: req.session.user.role, email: req.session.user.email });
  } else {
    res.status(401).json({ role: null });
  }
});

// router.get('/me', async (req, res) => {
//   if (!req.session.user) {
//     return res.status(401).json({ error: "Not logged in" });
//   }

//   const { id, role } = req.session.user;

//   try {
//     let user;
//     if (role === "admin") user = await Admin.findById(id);
//     if (role === "faculty") user = await Faculty.findById(id);
//     if (role === "student") user = await Student.findById(id);

//     if (!user) return res.status(404).json({ error: "User not found" });

//     return res.json({
//       user: {
//         _id: user._id,
//         firstName: user.firstName,
//         lastName: user.lastName,
//         email: user.email || user.universityEmail,
//         profilePic: user.profilePic || null,
//         role
//       }
//     });

//   } catch (err) {
//     console.error("Session fetch error:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

router.get('/me', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in" });
  }

  const { id, role } = req.session.user;

  try {
    let user;
    if (role === "admin") user = await Admin.findById(id);
    if (role === "faculty") user = await Faculty.findById(id);
    if (role === "student") {
      user = await Student.findById(id);
      if (user) {
        return res.json({
          user: {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.universityEmail,
            profilePic: user.profilePic || null,
            role,
            studentId: user.studentId, 
            fullName: `${user.firstName} ${user.lastName}`
          }
        });
      }
    }

    if (!user) return res.status(404).json({ error: "User not found" });

    return res.json({
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email || user.universityEmail,
        profilePic: user.profilePic || null,
        role
      }
    });

  } catch (err) {
    console.error("Session fetch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post('/profile-pic', upload.single('profilePic'), async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const profilePicPath = `/uploads/profile-pics/${req.file.filename}`;

    const admin = await Admin.findByIdAndUpdate(
      req.session.user.id,
      { profilePic: profilePicPath },
      { new: true }
    );

    if (!admin) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: "Admin not found" });
    }

    res.json({
      success: true,
      message: "Profile picture updated successfully",
      profilePic: profilePicPath
    });

  } catch (err) {
    console.error("Upload error:", err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
