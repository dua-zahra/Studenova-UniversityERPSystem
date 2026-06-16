const RepeatFreshCourseFee = require('../models/RepeatFreshCourseFee');
const Student = require('../models/Student');
const Batch = require('../models/Batch');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');

exports.createCourseFee = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      studentId,
      courseType,
      courseName,
      courseCode,
      amount,
      dueDate,
      description
    } = req.body;

    console.log('Creating repeat/fresh course fee with data:', {
      studentId, courseType, courseName, amount, dueDate
    });

    if (!studentId || !courseType || !courseName || !amount || !dueDate) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: studentId, courseType, courseName, amount, dueDate'
      });
    }

    if (amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    const student = await Student.findOne({ studentId })
      .populate('batch')
      .session(session);

    if (!student) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: `Student with ID ${studentId} not found`
      });
    }

    const batchInfo = await Batch.findById(student.batch._id).session(session);
    if (!batchInfo) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Batch information not found for student'
      });
    }

    const invoiceNumber = RepeatFreshCourseFee.generateInvoiceNumber();

    const courseFee = new RepeatFreshCourseFee({
      studentId: student.studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      degreeLevel: batchInfo.degreeLevel,
      department: batchInfo.departmentName,
      batch: batchInfo.batchName,
      currentSemester: student.currentSemester,
      section: student.section || 'N/A',
      courseType,
      courseName,
      courseCode: courseCode || '',
      amount: parseFloat(amount),
      dueDate: new Date(dueDate),
      invoiceNumber,
      description: description || `${courseType === 'repeat' ? 'Repeat' : 'Fresh'} Course Fee - ${courseName}`,
      createdBy: req.user?.username || 'admin'
    });

    await courseFee.save({ session });
    await session.commitTransaction();

    console.log(' Repeat/Fresh course fee created successfully:', invoiceNumber);

    res.status(201).json({
      success: true,
      message: `${courseType === 'repeat' ? 'Repeat' : 'Fresh'} course fee created successfully for ${student.firstName} ${student.lastName}`,
      data: {
        courseFee: {
          _id: courseFee._id,
          invoiceNumber: courseFee.invoiceNumber,
          studentId: courseFee.studentId,
          studentName: courseFee.studentName,
          courseName: courseFee.courseName,
          courseType: courseFee.courseType,
          amount: courseFee.amount,
          dueDate: courseFee.dueDate,
          paymentStatus: courseFee.paymentStatus
        }
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error(' Error creating repeat/fresh course fee:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Invoice number already exists. Please try again.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create course fee: ' + error.message
    });
  } finally {
    session.endSession();
  }
};

exports.getCourseFees = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      studentId,
      studentName,
      courseType,
      courseName,
      paymentStatus,
      startDate,
      endDate
    } = req.query;
    
    const filter = {};
    
    if (studentId) filter.studentId = { $regex: studentId, $options: 'i' };
    if (studentName) filter.studentName = { $regex: studentName, $options: 'i' };
    if (courseType) filter.courseType = courseType;
    if (courseName) filter.courseName = { $regex: courseName, $options: 'i' };
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const courseFees = await RepeatFreshCourseFee.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await RepeatFreshCourseFee.countDocuments(filter);

    res.json({
      success: true,
      data: courseFees,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        hasNext: (page * limit) < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching repeat/fresh course fees:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course fees'
    });
  }
};

exports.getCourseFeeById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const courseFee = await RepeatFreshCourseFee.findById(id);
    if (!courseFee) {
      return res.status(404).json({
        success: false,
        message: 'Course fee record not found'
      });
    }

    res.json({
      success: true,
      data: courseFee
    });
  } catch (error) {
    console.error('Error fetching course fee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course fee'
    });
  }
};

exports.updateCourseFee = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const updateData = req.body;

    const courseFee = await RepeatFreshCourseFee.findById(id).session(session);
    if (!courseFee) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Course fee record not found'
      });
    }

    if (courseFee.paymentStatus === 'paid') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Cannot update paid course fee'
      });
    }

    const updatedCourseFee = await RepeatFreshCourseFee.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true, session }
    );

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Course fee updated successfully',
      data: updatedCourseFee
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error updating course fee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update course fee'
    });
  } finally {
    session.endSession();
  }
};

exports.deleteCourseFee = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    const courseFee = await RepeatFreshCourseFee.findById(id);
    if (!courseFee) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Course fee record not found'
      });
    }

    if (courseFee.paymentStatus === 'paid') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Cannot delete paid course fee'
      });
    }

    await RepeatFreshCourseFee.findByIdAndDelete(id).session(session);
    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Course fee deleted successfully'
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error deleting course fee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete course fee'
    });
  } finally {
    session.endSession();
  }
};

exports.recordPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { amountPaid, paymentDate, paymentMethod, transactionId } = req.body;

    const courseFee = await RepeatFreshCourseFee.findById(id).session(session);
    if (!courseFee) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Course fee record not found'
      });
    }

    if (courseFee.paymentStatus === 'paid') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Course fee is already paid'
      });
    }

    const paymentAmount = parseFloat(amountPaid);
    const remainingBalance = courseFee.amount - courseFee.amountPaid;

    if (paymentAmount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be greater than 0'
      });
    }

    if (paymentAmount > remainingBalance) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Payment amount exceeds remaining balance. Maximum payment allowed: Rs. ${remainingBalance}`
      });
    }

    courseFee.amountPaid += paymentAmount;
    
    if (courseFee.amountPaid >= courseFee.amount) {
      courseFee.paymentStatus = 'paid';
      courseFee.paidDate = new Date();
    }

    if (!courseFee.paymentHistory) {
      courseFee.paymentHistory = [];
    }
    
    courseFee.paymentHistory.push({
      amount: paymentAmount,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      paymentMethod: paymentMethod || 'cash',
      transactionId: transactionId,
      recordedBy: req.user?.username || 'admin'
    });

    await courseFee.save({ session });
    await session.commitTransaction();

    res.json({
      success: true,
      message: `Payment of Rs. ${paymentAmount} recorded successfully`,
      data: courseFee
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error recording payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record payment'
    });
  } finally {
    session.endSession();
  }
};

exports.getStudentCourseFees = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { page = 1, limit = 10, paymentStatus } = req.query;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'Student ID is required'
      });
    }

    const filter = { studentId };
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    const courseFees = await RepeatFreshCourseFee.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await RepeatFreshCourseFee.countDocuments(filter);

    const summary = await RepeatFreshCourseFee.aggregate([
      { $match: { studentId } },
      {
        $group: {
          _id: null,
          totalFees: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalPaid: { $sum: '$amountPaid' },
          pendingAmount: { $sum: { $subtract: ['$amount', '$amountPaid'] } }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        courseFees,
        summary: summary[0] || {
          totalFees: 0,
          totalAmount: 0,
          totalPaid: 0,
          pendingAmount: 0
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalRecords: total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching student course fees:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student course fees'
    });
  }
};

exports.generateInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const courseFee = await RepeatFreshCourseFee.findById(id);
    if (!courseFee) {
      return res.status(404).json({
        success: false,
        message: 'Course fee record not found'
      });
    }

    if (courseFee.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot download invoice for paid course fee.'
      });
    }

    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=course-fee-${courseFee.invoiceNumber}.pdf`);
    
    doc.pipe(res);

    const addText = (text, x, y, options = {}) => {
      doc.fontSize(options.size || 10)
         .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
         .text(text, x, y, options);
    };

    
    addText('Superior University', 50, 50, { size: 20, bold: true });
    addText('COURSE FEE INVOICE', 50, 75, { size: 16, bold: true });
    
    addText('Superior University ', 50, 110);
    addText('Lahore, Pakistan', 50, 125);
    addText('Phone: +92 312343212', 50, 140);
    addText('Email: admin@superioruniversity.com', 50, 155);

    addText(`Invoice #: ${courseFee.invoiceNumber}`, 350, 110, { bold: true });
    addText(`Issue Date: ${courseFee.createdAt.toLocaleDateString()}`, 350, 125);
    addText(`Due Date: ${courseFee.dueDate.toLocaleDateString()}`, 350, 140);
    addText(`Status: ${courseFee.paymentStatus.toUpperCase()}`, 350, 155, { 
      color: courseFee.paymentStatus === 'overdue' ? 'red' : 'black'
    });

    doc.moveTo(50, 180).lineTo(550, 180).stroke();
    addText('STUDENT INFORMATION', 50, 190, { size: 14, bold: true });
    
    addText(`Student ID: ${courseFee.studentId}`, 50, 220);
    addText(`Name: ${courseFee.studentName}`, 50, 235);
    addText(`Semester: ${courseFee.currentSemester}`, 50, 250);
    addText(`Section: ${courseFee.section}`, 50, 265);
    
    addText(`Degree: ${courseFee.degreeLevel}`, 250, 220);
    addText(`Department: ${courseFee.department}`, 250, 235);
    addText(`Batch: ${courseFee.batch}`, 250, 250);

    doc.moveTo(50, 300).lineTo(550, 300).stroke();
    addText('COURSE FEE DETAILS', 50, 310, { size: 14, bold: true });
    
    addText('Course Type', 50, 340, { bold: true });
    addText('Course Name', 150, 340, { bold: true });
    addText('Description', 300, 340, { bold: true });
    addText('Amount (Rs.)', 450, 340, { bold: true, align: 'right' });

    doc.moveTo(50, 355).lineTo(550, 355).stroke();

    let yPosition = 370;
    
    addText(courseFee.courseType === 'repeat' ? 'Repeat Course' : 'Fresh Course', 50, yPosition);
    addText(courseFee.courseName, 150, yPosition);
    addText(courseFee.description || `${courseFee.courseType} course fee`, 300, yPosition);
    addText(courseFee.amount.toLocaleString(), 450, yPosition, { align: 'right' });
    
    yPosition += 30;

    if (courseFee.courseCode) {
      addText(`Course Code: ${courseFee.courseCode}`, 50, yPosition);
      yPosition += 15;
    }

    doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
    addText('TOTAL AMOUNT', 300, yPosition + 15, { bold: true });
    addText(`Rs. ${courseFee.amount.toLocaleString()}`, 450, yPosition + 15, { bold: true, align: 'right' });

    addText(`Payment Status: ${courseFee.paymentStatus.toUpperCase()}`, 50, yPosition + 45);
    addText(`Amount Paid: Rs. ${courseFee.amountPaid.toLocaleString()}`, 50, yPosition + 60);
    addText(`Balance Due: Rs. ${(courseFee.amount - courseFee.amountPaid).toLocaleString()}`, 50, yPosition + 75);

    addText('SCAN TO PAY', 400, yPosition + 120, { size: 12, bold: true, align: 'center', width: 100 });
    
    try {
      const qrCodeData = JSON.stringify({
        studentId: courseFee.studentId,
        invoiceNumber: courseFee.invoiceNumber,
        amount: courseFee.amount,
        courseName: courseFee.courseName,
        courseType: courseFee.courseType,
        dueDate: courseFee.dueDate.toISOString()
      });
      
      const qrCodeImage = await QRCode.toDataURL(qrCodeData);
      doc.image(qrCodeImage, 400, yPosition + 140, { width: 80, height: 80 });
    } catch (qrError) {
      console.error('QR Code generation error:', qrError);
      addText('QR Code unavailable', 400, yPosition + 160, { align: 'center', width: 100 });
    }

    addText('PAYMENT INSTRUCTIONS', 50, yPosition + 120, { size: 12, bold: true });
    addText('1. Scan QR code or visit payment portal', 50, yPosition + 140);
    addText('2. Use Invoice Number as reference', 50, yPosition + 155);
    addText('3. Keep transaction ID for records', 50, yPosition + 170);
    addText('4. Contact accounts for assistance', 50, yPosition + 185);
    addText(`5. Due Date: ${courseFee.dueDate.toLocaleDateString()}`, 50, yPosition + 200);

    doc.moveTo(50, 700).lineTo(550, 700).stroke();
    addText('Thank you for your prompt payment!', 50, 710, { align: 'center', width: 500 });
    addText('For queries contact: admin@superioruniversity.com | Phone: +92 312343212', 50, 725, { align: 'center', width: 500, size: 8 });

    doc.end();

  } catch (error) {
    console.error('Error generating course fee invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice: ' + error.message
    });
  }
};

exports.getCourseFeeStats = async (req, res) => {
  try {
    const { startDate, endDate, courseType } = req.query;
    
    const matchStage = {};
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }
    if (courseType) matchStage.courseType = courseType;

    const totalFees = await RepeatFreshCourseFee.countDocuments(matchStage);
    
    const totalRevenue = await RepeatFreshCourseFee.aggregate([
      { $match: { ...matchStage, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amountPaid' } } }
    ]);

    const pendingPayments = await RepeatFreshCourseFee.aggregate([
      { $match: { ...matchStage, paymentStatus: { $in: ['pending', 'overdue'] } } },
      { $group: { _id: null, total: { $sum: { $subtract: ['$amount', '$amountPaid'] } } } }
    ]);

    const paymentStatusStats = await RepeatFreshCourseFee.aggregate([
      { $match: matchStage },
      { $group: { 
        _id: '$paymentStatus', 
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }}
    ]);

    const courseTypeStats = await RepeatFreshCourseFee.aggregate([
      { $match: matchStage },
      { $group: { 
        _id: '$courseType', 
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalPaid: { $sum: '$amountPaid' }
      }}
    ]);

    const monthlyRevenue = await RepeatFreshCourseFee.aggregate([
      { $match: { ...matchStage, paymentStatus: 'paid' } },
      { 
        $group: {
          _id: {
            year: { $year: '$paidDate' },
            month: { $month: '$paidDate' }
          },
          revenue: { $sum: '$amountPaid' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ]);

    res.json({
      success: true,
      data: {
        totalFees,
        totalRevenue: totalRevenue[0]?.total || 0,
        pendingPayments: pendingPayments[0]?.total || 0,
        paymentStatusStats,
        courseTypeStats,
        monthlyRevenue
      }
    });
  } catch (error) {
    console.error('Error fetching course fee statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course fee statistics'
    });
  }
};