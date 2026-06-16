const Faculty = require('../models/Faculty');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
exports.createFaculty = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      joiningDate,
      designation,
      degreeLevel, 
      department,
      gender,
      mobile,
      birthDate,
      address,
      education,
      specialization,
      experienceYears,
      previousInstitutions,
      facultyType,
      salary
    } = req.body;

    if (!degreeLevel || !department) {
      return res.status(400).json({ message: "Degree level and department are required" });
    }

    if (!mobile || mobile.length !== 11) {
      return res.status(400).json({ message: "Mobile number must be 11 digits long" });
    }

    const resume = req.files?.['resume']?.[0]?.filename || null;
    const degree = req.files?.['degree']?.[0]?.filename || null;
    const photo = req.files?.['photo']?.[0]?.filename || null;

    const universityEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@university.edu.pk`;

    const existingEmail = await Faculty.findOne({ email });
    const existingUniversityEmail = await Faculty.findOne({ universityEmail });

    if (existingEmail || existingUniversityEmail) {
      return res.status(400).json({ message: "Email or University email already exists" });
    }

    const departmentInitials = department.split(' ').map(word => word.charAt(0).toUpperCase()).join('');
    const randomNumber = Math.floor(100 + Math.random() * 900);
    const employeeId = `EMP-${departmentInitials}-${randomNumber}`;

    let usernameBase = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
    let username = usernameBase;
    let existingUsername = await Faculty.findOne({ username });
    let counter = 1;

    while (existingUsername) {
      username = `${usernameBase}${counter}`;
      existingUsername = await Faculty.findOne({ username });
      counter++;
    }

    const defaultPassword = "faculty@@";
    const passwordToUse = req.body.password ? req.body.password : defaultPassword;
    const hashedPassword = await bcrypt.hash(passwordToUse, 10);

    const newFaculty = new Faculty({
      firstName,
      lastName,
      email,
      universityEmail,
      username,
      employeeId,
      password: hashedPassword,
      joiningDate,
      designation,
      degreeLevel, 
      department,
      gender,
      mobile,
      birthDate,
      address,
      education,
      specialization,
      experienceYears,
      previousInstitutions,
      facultyType,
      salary,
      resume,
      degree,
      photo,
      role: "faculty",
      isActive: true
    });

    await newFaculty.save();

    res.status(201).json({
      message: 'Faculty created successfully',
      faculty: newFaculty
    });

  } catch (error) {
    console.error("Error creating faculty:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getAllFaculty = async (req, res) => {
  try {
    const facultyList = await Faculty.find();
    res.json(facultyList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getFacultyById = async (req, res) => {
  try {
    const { id } = req.params;
    const faculty = await Faculty.findById(id);
    if (!faculty) {
      return res.status(404).json({ message: "Faculty not found" });
    }
    res.status(200).json(faculty);
  } catch (error) {
    console.error("Error fetching faculty by ID:", error);
    res.status(500).json({ message: "Server error" });
  }
};
exports.cleanupBlockedFaculty = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await Faculty.cleanupBlockedFacultyAssignments(session);
    
    await session.commitTransaction();
    
    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: error.message
    });
  } finally {
    session.endSession();
  }
};

exports.updateFaculty = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();
    const { id } = req.params;
    const updateData = { ...req.body };

    console.log(' UPDATE FACULTY PROCESS STARTED');
    console.log('Update data received:', Object.keys(updateData));

    if (updateData.assignedCourses !== undefined) {
      try {
        let assignedCoursesData = updateData.assignedCourses;
        
        if (typeof assignedCoursesData === 'string' && assignedCoursesData === '[object Object]') {
          console.log('Detected "[object Object]" string - skipping assignedCourses update');
          delete updateData.assignedCourses;
        } 
        else if (typeof assignedCoursesData === 'string') {
          try {
            if (assignedCoursesData.startsWith('[') || assignedCoursesData.startsWith('{')) {
              assignedCoursesData = JSON.parse(assignedCoursesData);
            } else {
              console.warn('assignedCourses is string but not JSON format, skipping');
              delete updateData.assignedCourses;
            }
          } catch (parseError) {
            console.error('Error parsing assignedCourses JSON:', parseError.message);
            delete updateData.assignedCourses;
          }
        }
        else if (typeof assignedCoursesData === 'object') {
          console.log('Processing assignedCourses object...');
          const coursesArray = Array.isArray(assignedCoursesData) 
            ? assignedCoursesData 
            : [assignedCoursesData];

          updateData.assignedCourses = coursesArray.map(course => ({
            batchId: course.batchId || null,
            batchName: course.batchName || '',
            semester: Number(course.semester) || 1,
            courseCode: course.courseCode || '',
            courseName: course.courseName || '',
            sectionName: course.sectionName || '',
            creditHrs: Number(course.creditHrs) || 0,
            degreeLevel: course.degreeLevel || '',
            department: course.department || '',
            assignedAt: course.assignedAt ? new Date(course.assignedAt) : new Date(),
            removedAt: course.removedAt ? new Date(course.removedAt) : undefined,
            completedAt: course.completedAt ? new Date(course.completedAt) : undefined,
            teachingStatus: course.teachingStatus || 'in-progress',
            isActive: course.isActive !== undefined ? course.isActive : true,
            batchStatus: course.batchStatus || 'pending'
          }));
        } else {
          delete updateData.assignedCourses;
        }
      } catch (error) {
        console.error('Unexpected error processing assignedCourses:', error);
        delete updateData.assignedCourses;
      }
    }

    const fieldsToRemove = ['_id', '__v', 'createdAt', 'updatedAt', 'currentWorkload'];
    fieldsToRemove.forEach(field => {
      delete updateData[field];
    });

    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    if (req.files?.['photo']) {
      updateData.photo = req.files['photo'][0].filename;
    }
    if (req.files?.['resume']) {
      updateData.resume = req.files['resume'][0].filename;
    }
    if (req.files?.['degree']) {
      updateData.degree = req.files['degree'][0].filename;
    }

    console.log('Final update data keys:', Object.keys(updateData));

    const facultyBeforeUpdate = await Faculty.findById(id).session(session);
    if (!facultyBeforeUpdate) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Faculty not found" });
    }

    const oldFullName = `${facultyBeforeUpdate.firstName} ${facultyBeforeUpdate.lastName}`;

    const updatedFaculty = await Faculty.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true, session }
    );

    if (!updatedFaculty) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Faculty not found" });
    }

    const newFullName = `${updatedFaculty.firstName} ${updatedFaculty.lastName}`;
    
    if (oldFullName !== newFullName) {
      console.log(`NAME CHANGE DETECTED: ${oldFullName} → ${newFullName}`);
      
      try {
        const nameSyncResult = await updatedFaculty.syncNameToTeacherAssignments(session);
        console.log(`Name sync completed: ${nameSyncResult.sectionsUpdated} sections updated`);
      } catch (nameSyncError) {
        console.error('Name sync failed:', nameSyncError);
      }
    }

    try {
      const TeacherAssignment = mongoose.model('TeacherAssignment');
      
      const result = await TeacherAssignment.updateMany(
        {
          'semesterAssignments.assignments.sections.facultyId': id
        },
        {
          $set: {
            'semesterAssignments.$[].assignments.$[].sections.$[section].facultyName': newFullName
          }
        },
        {
          arrayFilters: [
            { 'section.facultyId': mongoose.Types.ObjectId.createFromHexString(id) }
          ],
          session
        }
      );
      
      console.log(`TeacherAssignment sync: ${result.modifiedCount} records updated`);
    } catch (taError) {
      console.error('TeacherAssignment sync failed:', taError.message);
    }

    await session.commitTransaction();
    console.log('FACULTY UPDATE COMPLETED SUCCESSFULLY');

    res.status(200).json({
      success: true,
      message: "Faculty updated successfully",
      faculty: updatedFaculty,
      sync: {
        nameChanged: oldFullName !== newFullName,
        oldName: oldFullName,
        newName: newFullName
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("UPDATE ERROR:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: "Invalid data format", 
        error: `Invalid ${error.path}: ${error.value}`
      });
    }
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: "Validation failed", 
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      message: "Update failed", 
      error: error.message 
    });
  } finally {
    session.endSession();
  }
};

exports.blockFaculty = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();
    const { id } = req.params;
    
    console.log(`=== STARTING FACULTY BLOCK PROCESS ===`);
    console.log(`Faculty ID: ${id}`);

    const faculty = await Faculty.findById(id).session(session);
    if (!faculty) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Faculty not found" });
    }

    if (!faculty.isActive) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Faculty is already blocked" });
    }

    console.log(`Blocking faculty: ${faculty.firstName} ${faculty.lastName}`);

    const TeacherAssignment = mongoose.model('TeacherAssignment');
    const assignmentCleanup = await TeacherAssignment.cleanupInactiveFacultyAssignments(session);

    const Timetable = mongoose.model('Timetable');
    const timetableCleanup = await Timetable.removeFacultyTimeSlots(id, session);

    const facultyCleanup = await faculty.handleFacultyBlock(session);

    faculty.isActive = false;
    await faculty.save({ session });

    await session.commitTransaction();
    
    console.log(`=== FACULTY BLOCK COMPLETED SUCCESSFULLY ===`);

    res.json({ 
      success: true,
      message: "Faculty blocked successfully - removed from ALL assignments and timetables", 
      data: {
        faculty: {
          _id: faculty._id,
          name: `${faculty.firstName} ${faculty.lastName}`,
          isActive: faculty.isActive,
          currentWorkload: faculty.currentWorkload
        },
        cleanup: {
          teacherAssignments: assignmentCleanup,
          timetableSlots: timetableCleanup,
          facultySpecific: facultyCleanup,
          note: "Faculty completely removed from ALL current assignments and timetables"
        }
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error(`BLOCK PROCESS FAILED:`, error);
    res.status(500).json({ 
      success: false,
      message: "Error blocking faculty",
      error: error.message 
    });
  } finally {
    session.endSession();
  }
};



exports.unblockFaculty = async (req, res) => {
  const { id } = req.params;
  try {
    const updatedFaculty = await Faculty.findByIdAndUpdate(
      id, 
      { isActive: true }, 
      { new: true }
    );
    if (!updatedFaculty) {
      return res.status(404).json({ message: "Faculty not found" });
    }
    res.json({ message: "Faculty unblocked successfully", faculty: updatedFaculty });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteFaculty = async (req, res) => {
  const { id } = req.params;
  try {
    const updatedFaculty = await Faculty.findByIdAndUpdate(
      id, 
      { isActive: false }, 
      { new: true }
    );
    if (!updatedFaculty) {
      return res.status(404).json({ message: "Faculty not found" });
    }
    res.json({ message: "Faculty deleted successfully", faculty: updatedFaculty });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.getFacultyCount = async (req, res) => {
  try {
    const count = await Faculty.countDocuments();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.syncFacultyAssignments = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { facultyId } = req.params;
    
    const syncResult = await mongoose.model('TeacherAssignment')
      .syncWithFacultyAssignments(facultyId, session);

    await session.commitTransaction();
    
    res.json({
      success: true,
      message: 'Faculty assignments synced successfully',
      data: syncResult
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: error.message
    });
  } finally {
    session.endSession();
  }
};
