const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  degreeLevel: {
    type: String,
    required: true,
    enum: ['Undergraduate', 'Graduate', 'PhD'],
  },
  departmentName: {
    type: String,
    required: true,
  },
  departmentCode: {
    type: String,
    required: true,
    uppercase: true,
  },
  
}, { timestamps: true });

departmentSchema.index({ departmentCode: 1 }, { unique: true });

departmentSchema.index({ degreeLevel: 1, departmentName: 1 }, { unique: true });

module.exports = mongoose.model('Department', departmentSchema);
