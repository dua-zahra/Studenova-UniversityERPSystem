require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session'); 
const MongoStore = require('connect-mongo'); 
const dbConnection = require('./config/dbcon');
const mongoose = require('mongoose');
const facultyRoutes = require('./routes/facultyRoutes');
const courseRoutes = require('./routes/courseRoutes');
const studentRoutes = require('./routes/studentRoutes');
const batchRoutes = require('./routes/batchRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const sectionRoutes = require('./routes/sectionRoutes');
const authRoutes = require('./routes/authRoutes'); 
const teacherAssignmentRoutes = require('./routes/teacherAssignmentRoutes');
const feeRoutes = require('./routes/feeRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const eventPaymentRoutes = require('./routes/eventPaymentRoutes');
const universityExpenseRoutes = require('./routes/universityExpenseRoutes');
const repeatFreshCourseFeeRoutes = require('./routes/repeatFreshCourseFeeRoutes');
const facultyCoursesRoutes = require("./routes/facultyCoursesRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const resultsRoutes = require("./routes/resultsRoutes");
const facultyTasksRoute = require("./routes/facultyTasks");
const adminProfilePicRoutes = require('./routes/adminProfilePic');
const chatbotRoutes = require('./routes/chatbot');


const app = express();
app.use(cors({
  origin: ['http://localhost:3000', 'https://studenova-university-erp-system.vercel.app'],
  // origin: 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path} | IP: ${req.ip} | Time: ${new Date().toISOString()}`);
  console.log(`   Headers:`, {
    origin: req.headers.origin,
    'user-agent': req.headers['user-agent'],
    cookie: req.headers.cookie ? 'Present' : 'Missing'
  });
  next();
});

app.get('/api/debug/session-full', (req, res) => {
  const sessionData = {
    sessionID: req.sessionID,
    session: req.session,
    user: req.session.user,
    sessionStore: req.sessionStore ? 'Connected' : 'No Store',
    cookies: req.cookies,
    headers: {
      cookie: req.headers.cookie,
      origin: req.headers.origin,
      'user-agent': req.headers['user-agent']
    },
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  };
  
  console.log('🔍 SESSION DEBUG:', JSON.stringify(sessionData, null, 2));
  res.json(sessionData);
});

app.get('/api/debug/test-cors', (req, res) => {
  res.json({
    success: true,
    message: "CORS test successful",
    corsConfig: {
      origin: 'http://localhost:3000',
      credentials: true
    },
    headers: req.headers,
    cookies: req.cookies,
    sessionExists: !!req.session,
    sessionUser: req.session?.user || 'No user'
  });
});

app.get('/api/debug/db-status', async (req, res) => {
  try {
    const dbStatus = {
      readyState: mongoose.connection.readyState,
      states: {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
      },
      connection: mongoose.connection.host ? {
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
      } : 'No connection',
      collections: await mongoose.connection.db?.listCollections().toArray().catch(() => []) || 'No DB access'
    };
    
    res.json(dbStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/debug/sessions-count', async (req, res) => {
  try {
    if (req.sessionStore && req.sessionStore.all) {
      req.sessionStore.all((err, sessions) => {
        if (err) {
          res.json({ error: err.message });
        } else {
          res.json({
            totalSessions: sessions ? Object.keys(sessions).length : 0,
            sampleSessions: sessions ? Object.keys(sessions).slice(0, 3) : []
          });
        }
      });
    } else {
      res.json({ error: 'Session store not accessible' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/debug/chatbot-test', async (req, res) => {
  try {
    const { studentId, query } = req.body;
    
    const student = await Student.findOne({
      $or: [
        { studentId },
        { _id: studentId },
        { universityEmail: studentId }
      ]
    }).lean();
    
    const sessionInfo = {
      sessionUser: req.session?.user || null,
      sessionId: req.sessionID,
      hasStudentId: !!(req.session?.user?.studentId)
    };
    
    res.json({
      success: true,
      debug: {
        providedStudentId: studentId,
        foundStudent: student ? {
          id: student._id,
          studentId: student.studentId,
          name: `${student.firstName} ${student.lastName}`,
          email: student.universityEmail
        } : null,
        session: sessionInfo,
        requestBody: req.body,
        headers: {
          cookie: req.headers.cookie,
          origin: req.headers.origin
        }
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.get('/api/debug/student/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const student = await Student.findOne({
      $or: [
        { studentId: id },
        { _id: id },
        { universityEmail: id }
      ]
    }).lean();
    
    res.json({
      exists: !!student,
      student: student ? {
        _id: student._id,
        studentId: student.studentId,
        name: `${student.firstName} ${student.lastName}`,
        email: student.universityEmail,
        batch: student.batch,
        currentSemester: student.currentSemester
      } : null,
      searchCriteria: `Looking for: ${id}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/default-avatar.png', express.static(path.join(__dirname, 'public/default-avatar.png')));

(async () => {
  try {
    await dbConnection();

    app.use(session({
      secret: process.env.SESSION_SECRET || '*&()*()*KLJ:JSDWALKDE(**)',
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        // mongoUrl: "mongodb://127.0.0.1:27017/UniverityERP"
        mongoUrl: process.env.MONGODB_URI,
            ttl: 24 * 60 * 60
      }),
        cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 
  }
    }));

    app.use('/api/auth', authRoutes);
    app.use('/api/faculty', facultyRoutes); 
    app.use('/api', courseRoutes);
    app.use('/api/students', studentRoutes);
    app.use('/api/departments', departmentRoutes);
    app.use('/api/batches', batchRoutes);
    app.use('/api/batches', sectionRoutes);
    app.use('/api/teacher-assignment', teacherAssignmentRoutes);
    app.use('/api/fees', feeRoutes);
    app.use('/api/timetables', timetableRoutes);
    app.use('/api/event-payments', eventPaymentRoutes);
    app.use('/api/university-expenses', universityExpenseRoutes);
    app.use('/api/repeat-fresh-course-fees', repeatFreshCourseFeeRoutes);
    require('./jobs/semesterProgress');
    require('./jobs/feeJob');
    app.use('/api/faculty-courses', facultyCoursesRoutes);
    app.use("/api/attendance", attendanceRoutes);
    app.use("/api/results", resultsRoutes);
    app.use("/api/faculty-timetable", require("./routes/facultyTimetableRoutes"));
    app.use("/api/faculty-tasks", facultyTasksRoute);
    app.use('/api/admin/profile', adminProfilePicRoutes);
    app.use('/api/chatbot', chatbotRoutes);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
  

app.get("/api/test", async (req, res) => {
  res.json({ 
    message: "API and database are working fine!"
  });
});



    const port = process.env.PORT || 50000;
    app.listen(port, () => {
      console.log(`Server is running on port ${port}.`);
    });

  } catch (err) {
    console.error('Failed to start server:', err);
  }
})();

