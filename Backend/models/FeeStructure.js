const mongoose = require('mongoose');

const baseFeeSchema = new mongoose.Schema({
  tuitionFee: { type: Number, required: true, min: 0 },
  miscellaneousFee: { type: Number, required: true, min: 0 },
  examFee: { type: Number, required: true, min: 0 },
  libraryFee: { type: Number, required: true, min: 0 },
  labFee: { type: Number, required: true, min: 0 },
  totalBaseFee: { type: Number, required: true, min: 0 }
}, { _id: false });

const semesterFeeBreakdownSchema = new mongoose.Schema({
  semester: { type: Number, required: true },
  credits: { type: Number, required: true },
  courses: { type: Number, required: true },
  baseFee: { type: Number, required: true },
  courseFee: { type: Number, required: true },
  semesterTotal: { type: Number, required: true }
}, { _id: false });

const FeeStructureSchema = new mongoose.Schema({
  degreeLevel: { type: String, required: true },
  department: { type: String, required: true },
  batch: { type: String, required: true },
  
  masterBaseFee: baseFeeSchema,
  semesterBaseFees: {
    type: Map,
    of: baseFeeSchema,
    default: new Map()
  },
  semesterBreakdown: [semesterFeeBreakdownSchema],
  degreeTotal: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

FeeStructureSchema.index(
  { degreeLevel: 1, department: 1, batch: 1 },
  { unique: true }
);

FeeStructureSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  if (this.semesterBaseFees && !(this.semesterBaseFees instanceof Map)) {
    this.semesterBaseFees = new Map(Object.entries(this.semesterBaseFees));
  }
  
  next();
});

module.exports = mongoose.model('FeeStructure', FeeStructureSchema);