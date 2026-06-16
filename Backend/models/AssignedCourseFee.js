const mongoose = require('mongoose');

const courseFeeSchema = new mongoose.Schema({
  courseCode: {
    type: String,
    required: true
  },
  courseName: {
    type: String,
    required: true
  },
  feeAmount: {
    type: Number,
    required: true,
    min: 0
  },
  creditHrs: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['Core', 'Elective', 'Lab', 'Project'],
    default: 'Core'
  }
});

const semesterFeesSchema = new mongoose.Schema({
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  courses: [courseFeeSchema]
});

const assignedCourseFeeSchema = new mongoose.Schema({
  degreeLevel: {
    type: String,
    required: true,
    enum: ['Undergraduate', 'Graduate', 'PhD']
  },
  department: {
    type: String,
    required: true
  },
  semesters: [semesterFeesSchema],
  departmentCode: {
    type: String
  }
}, {
  timestamps: true
});

assignedCourseFeeSchema.index({ 
  degreeLevel: 1, 
  department: 1 
}, { 
  unique: true 
});

assignedCourseFeeSchema.virtual('semesterData').get(function() {
  return this.semesters.reduce((acc, semester) => {
    acc[semester.semester] = semester.courses;
    return acc;
  }, {});
});

module.exports = mongoose.model('AssignedCourseFee', assignedCourseFeeSchema);