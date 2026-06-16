const UniversityExpense = require('../models/UniversityExpense');
const Student = require('../models/Student');
const Batch = require('../models/Batch');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');

exports.createStudentExpense = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      degreeLevel,
      department,
      batch,
      studentId,
      expenseConfigurations,
      transportDetails,
      hostelDetails,
      sportsDetails,
      societyDetails,
      fineDetails,
      libraryDetails
    } = req.body;

    console.log(' Creating/Updating expense with data:', {
      degreeLevel, department, batch, studentId, expenseConfigurations
    });

    if (!degreeLevel || !department || !batch || !studentId || 
        !expenseConfigurations || !expenseConfigurations.length) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: degreeLevel, department, batch, studentId, expenseConfigurations'
      });
    }

    for (const config of expenseConfigurations) {
      if (!config.expenseTitle || !config.durationInMonths || !config.startDate || !config.paymentDueDate) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Each expense configuration must have expenseTitle, durationInMonths, startDate, and paymentDueDate'
        });
      }

      config.endDate = new Date(config.startDate);
      config.endDate.setMonth(config.endDate.getMonth() + parseInt(config.durationInMonths));
    }

    const student = await Student.findOne({ 
      studentId: studentId
    }).populate('batch').session(session);

    if (!student) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: `Student with ID ${studentId} not found`
      });
    }

    console.log('✅ Found student:', student.studentId, student.firstName, student.lastName);

    // Get batch info
    const batchInfo = await Batch.findOne({
      batchName: batch,
      degreeLevel: degreeLevel,
      departmentName: department
    }).session(session);

    if (!batchInfo) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: `Batch ${batch} not found for ${degreeLevel} - ${department}`
      });
    }

    // Check for duplicate/conflicting expenses
    const duplicateCheck = await UniversityExpense.checkDuplicateExpense(studentId, expenseConfigurations);
    if (duplicateCheck.isDuplicate) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Expense conflicts found',
        conflicts: duplicateCheck.conflicts
      });
    }

    // Prepare student data
    const studentData = {
      degreeLevel,
      department,
      batch,
      studentId: student.studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      currentSemester: student.currentSemester,
      section: student.section || 'N/A',
      createdBy: req.user?.username || 'admin'
    };

    // Prepare expense details with default values to ensure amounts can be calculated
    const expenseDetails = {
      transportDetails: transportDetails || { monthlyFee: 0 },
      hostelDetails: hostelDetails || { monthlyRent: 0, monthlyMessCharges: 0 },
      sportsDetails: sportsDetails || { monthlyFee: 0 },
      societyDetails: societyDetails || { fee: 0 },
      fineDetails: fineDetails || { amount: 0 },
      libraryDetails: libraryDetails || { monthlyFee: 0 }
    };

    const expense = await UniversityExpense.findOrCreateForStudent(
      studentData,
      expenseConfigurations,
      expenseDetails
    );

    await session.commitTransaction();

    console.log(' Expense created/updated successfully with', expense.invoices.length, 'individual invoices');
    console.log(' Invoice amounts:', expense.invoices.map(inv => ({ 
      number: inv.invoiceNumber, 
      amount: inv.amount,
      title: inv.expenseTitle 
    })));

    res.status(201).json({
      success: true,
      message: `Expense created successfully for student ${student.studentId} with ${expense.invoices.length} invoices`,
      data: {
        expense: {
          _id: expense._id,
          studentId: expense.studentId,
          studentName: expense.studentName,
          totalAmount: expense.totalAmount,
          paymentStatus: expense.paymentStatus
        },
        invoices: expense.invoices.map(invoice => ({
          invoiceNumber: invoice.invoiceNumber,
          expenseTitle: invoice.expenseTitle,
          description: invoice.description,
          amount: invoice.amount,
          dueDate: invoice.dueDate,
          paymentStatus: invoice.paymentStatus
        }))
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error(' Error creating/updating student expense:', error);
    
    if (error.errors) {
      console.error('Validation errors:', Object.keys(error.errors));
      Object.keys(error.errors).forEach(key => {
        console.error(`- ${key}:`, error.errors[key].message);
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create/update expense: ' + error.message,
      details: error.errors ? Object.keys(error.errors) : undefined
    });
  } finally {
    session.endSession();
  }
};


exports.getStudentsByBatch = async (req, res) => {
  try {
    const { degreeLevel, department, batch } = req.query;
    
    console.log(' Fetching students for:', { degreeLevel, department, batch });

    if (!degreeLevel || !department || !batch) {
      return res.status(400).json({
        success: false,
        message: 'Degree level, department, and batch are required'
      });
    }

    const batchInfo = await Batch.findOne({
      degreeLevel: degreeLevel,
      departmentName: { $regex: new RegExp(department, 'i') },
      batchName: batch
    });

    if (!batchInfo) {
      console.log('Batch not found:', { degreeLevel, department, batch });
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }
    console.log('Found batch:', batchInfo._id);

    const students = await Student.find({
      batch: batchInfo._id,
      status: 'active'
    }).select('studentId firstName lastName currentSemester section universityEmail contactNumber')
      .sort({ studentId: 1 });

    console.log(`✅ Found ${students.length} students in batch`);

    res.json({
      success: true,
      data: {
        batch: batchInfo.batchName,
        degreeLevel: batchInfo.degreeLevel,
        department: batchInfo.departmentName,
        students: students
      }
    });
  } catch (error) {
    console.error(' Error fetching students by batch:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students: ' + error.message
    });
  }
};


exports.getAllExpenses = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      expenseTitle, 
      degreeLevel, 
      department, 
      batch,
      studentId,
      studentName,
      paymentStatus,
      startDate,
      endDate
    } = req.query;
    
    const filter = {};
    
    if (status) filter.status = status;
    if (degreeLevel) filter.degreeLevel = degreeLevel;
    if (department) filter.department = department;
    if (batch) filter.batch = batch;
    if (studentId) filter.studentId = { $regex: studentId, $options: 'i' };
    if (studentName) filter.studentName = { $regex: studentName, $options: 'i' };
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    
    if (expenseTitle) {
      filter['expenseConfigurations.expenseTitle'] = expenseTitle;
    }
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const expenses = await UniversityExpense.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await UniversityExpense.countDocuments(filter);

    res.json({
      success: true,
      data: expenses,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        hasNext: (page * limit) < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expenses'
    });
  }
};

exports.getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const expense = await UniversityExpense.findById(id);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    res.json({
      success: true,
      data: expense
    });
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense'
    });
  }
};


exports.updateExpense = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const updateData = req.body;

    const expense = await UniversityExpense.findById(id).session(session);
    if (!expense) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    if (updateData.expenseConfigurations) {
      const duplicateCheck = await UniversityExpense.checkDuplicateExpense(
        expense.studentId, 
        updateData.expenseConfigurations
      );
      
      if (duplicateCheck.isDuplicate) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Duplicate expense found',
          conflicts: duplicateCheck.conflicts
        });
      }
    }

    const updatedExpense = await UniversityExpense.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true, session }
    );

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Expense updated successfully',
      data: updatedExpense
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error updating expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update expense'
    });
  } finally {
    session.endSession();
  }
};


exports.deleteExpense = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    const expense = await UniversityExpense.findById(id);
    if (!expense) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    await UniversityExpense.findByIdAndDelete(id).session(session);
    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error deleting expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete expense'
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
    const { amountPaid, paymentDate, paymentMethod, transactionId, invoiceNumber } = req.body;

    const expense = await UniversityExpense.findById(id).session(session);
    if (!expense) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    if (invoiceNumber) {
      const invoice = expense.invoices.find(inv => inv.invoiceNumber === invoiceNumber);
      if (!invoice) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }

      if (invoice.paymentStatus === 'paid') {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Invoice is already paid'
        });
      }

      const paymentAmount = parseFloat(amountPaid);
      const remainingBalance = invoice.amount - invoice.amountPaid;

      if (paymentAmount > remainingBalance) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Payment amount exceeds remaining balance. Maximum payment allowed: Rs. ${remainingBalance}`
        });
      }

      invoice.amountPaid += paymentAmount;
      
      if (invoice.amountPaid >= invoice.amount) {
        invoice.paymentStatus = 'paid';
        invoice.paidDate = new Date();
      }

      if (!invoice.paymentHistory) {
        invoice.paymentHistory = [];
      }
      
      invoice.paymentHistory.push({
        amount: paymentAmount,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        paymentMethod: paymentMethod || 'cash',
        transactionId: transactionId,
        recordedBy: req.user?.username || 'admin'
      });

      expense.amountPaid += paymentAmount;
      if (expense.amountPaid >= expense.totalAmount) {
        expense.paymentStatus = 'paid';
      }

    } else {
      const paymentAmount = parseFloat(amountPaid);
      expense.amountPaid += paymentAmount;
      
      if (expense.amountPaid >= expense.totalAmount) {
        expense.paymentStatus = 'paid';
        expense.expenseConfigurations.forEach(config => {
          config.status = 'completed';
        });
        expense.invoices.forEach(invoice => {
          if (invoice.paymentStatus !== 'paid') {
            invoice.paymentStatus = 'paid';
            invoice.amountPaid = invoice.amount;
            invoice.paidDate = new Date();
          }
        });
      } else if (expense.amountPaid > 0) {
        expense.paymentStatus = 'pending';
      }
    }

    await expense.save({ session });
    await session.commitTransaction();

    res.json({
      success: true,
      message: `Payment recorded successfully${invoiceNumber ? ' for invoice ' + invoiceNumber : ''}`,
      data: expense
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


exports.getExpenseStatistics = async (req, res) => {
  try {
    const { degreeLevel, department, batch, startDate, endDate } = req.query;
    
    const matchStage = {};
    if (degreeLevel) matchStage.degreeLevel = degreeLevel;
    if (department) matchStage.department = department;
    if (batch) matchStage.batch = batch;
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const totalExpenses = await UniversityExpense.countDocuments(matchStage);
    const activeExpenses = await UniversityExpense.countDocuments({ ...matchStage, status: 'active' });
    
    const totalRevenue = await UniversityExpense.aggregate([
      { $match: { ...matchStage, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amountPaid' } } }
    ]);

    const expenseByType = await UniversityExpense.aggregate([
      { $match: matchStage },
      { $unwind: '$expenseConfigurations' },
      { $group: { 
        _id: '$expenseConfigurations.expenseTitle', 
        count: { $sum: 1 }, 
        totalAmount: { $sum: '$expenseConfigurations.calculatedAmount' } 
      }}
    ]);

    const pendingPayments = await UniversityExpense.aggregate([
      { $match: { ...matchStage, paymentStatus: { $in: ['pending', 'overdue'] } } },
      { $group: { _id: null, total: { $sum: { $subtract: ['$totalAmount', '$amountPaid'] } } } }
    ]);

    const paymentStatusStats = await UniversityExpense.aggregate([
      { $match: matchStage },
      { $group: { 
        _id: '$paymentStatus', 
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' }
      }}
    ]);

   
    const invoiceStats = await UniversityExpense.aggregate([
      { $match: matchStage },
      { $unwind: '$invoices' },
      { $group: {
        _id: '$invoices.paymentStatus',
        count: { $sum: 1 },
        totalAmount: { $sum: '$invoices.amount' },
        totalPaid: { $sum: '$invoices.amountPaid' }
      }}
    ]);

    const monthlyRevenue = await UniversityExpense.aggregate([
      { $match: { ...matchStage, paymentStatus: 'paid' } },
      { 
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
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
        totalExpenses,
        activeExpenses,
        totalRevenue: totalRevenue[0]?.total || 0,
        pendingPayments: pendingPayments[0]?.total || 0,
        expenseByType,
        paymentStatusStats,
        invoiceStats,
        monthlyRevenue
      }
    });
  } catch (error) {
    console.error('Error fetching expense statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense statistics'
    });
  }
};


exports.getStudentExpenseHistory = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'Student ID is required'
      });
    }

    const expenses = await UniversityExpense.find({ studentId })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await UniversityExpense.countDocuments({ studentId });

    const summary = await UniversityExpense.aggregate([
      { $match: { studentId } },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$amountPaid' },
          pendingAmount: { $sum: { $subtract: ['$totalAmount', '$amountPaid'] } }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        expenses,
        summary: summary[0] || {
          totalExpenses: 0,
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
    console.error('Error fetching student expense history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student expense history'
    });
  }
};


exports.getStudentInvoices = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'Student ID is required'
      });
    }

    const expense = await UniversityExpense.findOne({ 
      studentId: studentId,
      status: 'active'
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'No active expense record found for this student'
      });
    }

    let invoices = expense.invoices;
    
    
    if (status) {
      invoices = invoices.filter(invoice => invoice.paymentStatus === status);
    }

    invoices.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedInvoices = invoices.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        studentInfo: {
          studentId: expense.studentId,
          studentName: expense.studentName,
          degreeLevel: expense.degreeLevel,
          department: expense.department,
          batch: expense.batch,
          currentSemester: expense.currentSemester,
          section: expense.section
        },
        invoices: paginatedInvoices,
        summary: {
          totalInvoices: invoices.length,
          paidInvoices: invoices.filter(inv => inv.paymentStatus === 'paid').length,
          pendingInvoices: invoices.filter(inv => inv.paymentStatus === 'pending').length,
          overdueInvoices: invoices.filter(inv => inv.paymentStatus === 'overdue').length,
          totalAmount: invoices.reduce((sum, inv) => sum + inv.amount, 0),
          totalPaid: invoices.reduce((sum, inv) => sum + inv.amountPaid, 0),
          totalDue: invoices.reduce((sum, inv) => sum + (inv.amount - inv.amountPaid), 0)
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(invoices.length / limit),
          totalRecords: invoices.length,
          hasNext: endIndex < invoices.length,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching student invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student invoices: ' + error.message
    });
  }
};

exports.getInvoiceDetails = async (req, res) => {
  try {
    const { id, invoiceNumber } = req.params;

    const expense = await UniversityExpense.findById(id);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense record not found'
      });
    }

    const invoice = expense.invoices.find(inv => inv.invoiceNumber === invoiceNumber);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const expenseConfig = expense.expenseConfigurations.find(
      config => config.invoiceNumber === invoiceNumber
    );

    res.json({
      success: true,
      data: {
        invoice: {
          ...invoice.toObject(),
          canDownload: invoice.paymentStatus !== 'paid'
        },
        expenseConfig: expenseConfig,
        studentInfo: {
          studentId: expense.studentId,
          studentName: expense.studentName,
          degreeLevel: expense.degreeLevel,
          department: expense.department,
          batch: expense.batch,
          currentSemester: expense.currentSemester,
          section: expense.section
        },
        expenseDetails: this.getExpenseSpecificDetails(expense, invoice.expenseTitle)
      }
    });
  } catch (error) {
    console.error('Error fetching invoice details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice details: ' + error.message
    });
  }
};


exports.generateIndividualInvoice = async (req, res) => {
  try {
    const { id, invoiceNumber } = req.params;

    const expense = await UniversityExpense.findById(id);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense record not found'
      });
    }

    const invoice = expense.invoices.find(inv => inv.invoiceNumber === invoiceNumber);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    
    if (invoice.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot download paid invoice. This invoice has already been paid and is no longer available for download.'
      });
    }

   
    const expenseConfig = expense.expenseConfigurations.find(
      config => config.invoiceNumber === invoiceNumber
    );

    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoiceNumber}.pdf`);
    
    doc.pipe(res);

    const addText = (text, x, y, options = {}) => {
      doc.fontSize(options.size || 10)
         .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
         .text(text, x, y, options);
    };

    
    addText('Superior University', 50, 50, { size: 20, bold: true });
    addText('OFFICIAL STUDENT EXPENSE INVOICE', 50, 75, { size: 16, bold: true });
    
    addText('Superior University ', 50, 110);
    addText('Lahore, Pakistan', 50, 125);
    addText('Phone: +92 312343212', 50, 140);
    addText('Email: admin@superioruniversity.com', 50, 155);

    addText(`Invoice #: ${invoiceNumber}`, 350, 110, { bold: true });
    addText(`Issue Date: ${invoice.issueDate.toLocaleDateString()}`, 350, 125);
    addText(`Due Date: ${invoice.dueDate.toLocaleDateString()}`, 350, 140);
    addText(`Status: ${invoice.paymentStatus.toUpperCase()}`, 350, 155, { 
      color: invoice.paymentStatus === 'overdue' ? 'red' : 'black'
    });

    doc.moveTo(50, 180).lineTo(550, 180).stroke();
    addText('STUDENT INFORMATION', 50, 190, { size: 14, bold: true });
    
    addText(`Student ID: ${expense.studentId}`, 50, 220);
    addText(`Name: ${expense.studentName}`, 50, 235);
    addText(`Semester: ${expense.currentSemester}`, 50, 250);
    addText(`Section: ${expense.section}`, 50, 265);
    
    addText(`Degree: ${expense.degreeLevel}`, 250, 220);
    addText(`Department: ${expense.department}`, 250, 235);
    addText(`Batch: ${expense.batch}`, 250, 250);

    doc.moveTo(50, 300).lineTo(550, 300).stroke();
    addText('INVOICE DETAILS', 50, 310, { size: 14, bold: true });
    
    addText('Description', 50, 340, { bold: true });
    addText('Duration', 200, 340, { bold: true });
    addText('Period', 280, 340, { bold: true });
    addText('Amount (Rs.)', 450, 340, { bold: true, align: 'right' });

    doc.moveTo(50, 355).lineTo(550, 355).stroke();

    let yPosition = 370;
    
    const expenseLabel = UniversityExpense.getExpenseLabel(invoice.expenseTitle);
    
    addText(expenseLabel, 50, yPosition);
    addText(`${expenseConfig?.durationInMonths || 1} months`, 200, yPosition);
    addText(`${expenseConfig?.startDate.toLocaleDateString() || ''} - ${expenseConfig?.endDate.toLocaleDateString() || ''}`, 280, yPosition);
    addText(invoice.amount.toLocaleString(), 450, yPosition, { align: 'right' });
    
    yPosition += 30;

    const expenseDetails = this.getExpenseSpecificDetails(expense, invoice.expenseTitle);
    if (expenseDetails) {
      addText('Details:', 50, yPosition, { bold: true });
      yPosition += 15;
      expenseDetails.forEach(detail => {
        addText(`• ${detail}`, 50, yPosition);
        yPosition += 12;
      });
      yPosition += 10;
    }

    doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
    addText('TOTAL AMOUNT', 280, yPosition + 15, { bold: true });
    addText(`Rs. ${invoice.amount.toLocaleString()}`, 450, yPosition + 15, { bold: true, align: 'right' });

    addText(`Payment Status: ${invoice.paymentStatus.toUpperCase()}`, 50, yPosition + 45);
    addText(`Amount Paid: Rs. ${invoice.amountPaid.toLocaleString()}`, 50, yPosition + 60);
    addText(`Balance Due: Rs. ${(invoice.amount - invoice.amountPaid).toLocaleString()}`, 50, yPosition + 75);

    addText('SCAN TO PAY', 400, yPosition + 120, { size: 12, bold: true, align: 'center', width: 100 });
    
    try {
      const qrCodeData = JSON.stringify({
        studentId: expense.studentId,
        invoiceNumber: invoiceNumber,
        amount: invoice.amount,
        expenseTitle: invoice.expenseTitle,
        dueDate: invoice.dueDate.toISOString()
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
    addText(`5. Due Date: ${invoice.dueDate.toLocaleDateString()}`, 50, yPosition + 200);

    // Footer
    doc.moveTo(50, 700).lineTo(550, 700).stroke();
    addText('Thank you for your prompt payment!', 50, 710, { align: 'center', width: 500 });
    addText('For queries contact: admin@superioruniversity.com | Phone: +92 312343212', 50, 725, { align: 'center', width: 500, size: 8 });

    doc.end();

  } catch (error) {
    console.error('Error generating individual invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice: ' + error.message
    });
  }
};


exports.recordInvoicePayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id, invoiceNumber } = req.params;
    const { amountPaid, paymentDate, paymentMethod, transactionId } = req.body;

    const expense = await UniversityExpense.findById(id).session(session);
    if (!expense) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Expense record not found'
      });
    }

    const invoice = expense.invoices.find(inv => inv.invoiceNumber === invoiceNumber);
    if (!invoice) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    if (invoice.paymentStatus === 'paid') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invoice is already paid. No further payments can be recorded.'
      });
    }

    const paymentAmount = parseFloat(amountPaid);
    const remainingBalance = invoice.amount - invoice.amountPaid;

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

    invoice.amountPaid += paymentAmount;
    
    if (Math.abs(invoice.amountPaid - invoice.amount) < 0.01) { 
      invoice.paymentStatus = 'paid';
      invoice.paidDate = new Date();
      
      
      const expenseConfig = expense.expenseConfigurations.find(
        config => config.invoiceNumber === invoiceNumber
      );
      if (expenseConfig) {
        expenseConfig.status = 'completed';
      }
    }

    
    expense.amountPaid += paymentAmount;
    if (expense.amountPaid >= expense.totalAmount) {
      expense.paymentStatus = 'paid';
    } else if (expense.amountPaid > 0) {
      expense.paymentStatus = 'pending';
    }

    if (!invoice.paymentHistory) {
      invoice.paymentHistory = [];
    }
    
    invoice.paymentHistory.push({
      amount: paymentAmount,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      paymentMethod: paymentMethod || 'cash',
      transactionId: transactionId,
      recordedBy: req.user?.username || 'admin'
    });

    await expense.save({ session });
    await session.commitTransaction();

    res.json({
      success: true,
      message: `Payment of Rs. ${paymentAmount} recorded successfully for invoice ${invoiceNumber}`,
      data: {
        invoice: {
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amount,
          amountPaid: invoice.amountPaid,
          paymentStatus: invoice.paymentStatus,
          dueDate: invoice.dueDate
        },
        expense: {
          totalAmount: expense.totalAmount,
          amountPaid: expense.amountPaid,
          paymentStatus: expense.paymentStatus
        }
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error recording invoice payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record payment: ' + error.message
    });
  } finally {
    session.endSession();
  }
};


exports.getExpenseSpecificDetails = (expense, expenseTitle) => {
  const details = [];
  
  switch(expenseTitle) {
    case 'bus':
      if (expense.transportDetails) {
        if (expense.transportDetails.routeName) details.push(`Route: ${expense.transportDetails.routeName}`);
        if (expense.transportDetails.busStop) details.push(`Bus Stop: ${expense.transportDetails.busStop}`);
        if (expense.transportDetails.vehicleNumber) details.push(`Vehicle: ${expense.transportDetails.vehicleNumber}`);
        if (expense.transportDetails.monthlyFee) details.push(`Monthly Fee: Rs. ${expense.transportDetails.monthlyFee}`);
      }
      break;
      
    case 'hostel':
      if (expense.hostelDetails) {
        if (expense.hostelDetails.hostelName) details.push(`Hostel: ${expense.hostelDetails.hostelName}`);
        if (expense.hostelDetails.roomNumber) details.push(`Room: ${expense.hostelDetails.roomNumber}`);
        if (expense.hostelDetails.roomType) details.push(`Room Type: ${expense.hostelDetails.roomType}`);
        if (expense.hostelDetails.monthlyRent) details.push(`Monthly Rent: Rs. ${expense.hostelDetails.monthlyRent}`);
        if (expense.hostelDetails.monthlyMessCharges) details.push(`Mess Charges: Rs. ${expense.hostelDetails.monthlyMessCharges}`);
      }
      break;
      
    case 'sports':
      if (expense.sportsDetails) {
        if (expense.sportsDetails.activityName) details.push(`Activity: ${expense.sportsDetails.activityName}`);
        if (expense.sportsDetails.coachName) details.push(`Coach: ${expense.sportsDetails.coachName}`);
        if (expense.sportsDetails.membershipType) details.push(`Membership: ${expense.sportsDetails.membershipType}`);
        if (expense.sportsDetails.monthlyFee) details.push(`Monthly Fee: Rs. ${expense.sportsDetails.monthlyFee}`);
      }
      break;
      
    case 'society':
      if (expense.societyDetails) {
        if (expense.societyDetails.societyName) details.push(`Society: ${expense.societyDetails.societyName}`);
        if (expense.societyDetails.eventName) details.push(`Event: ${expense.societyDetails.eventName}`);
        if (expense.societyDetails.participationType) details.push(`Participation: ${expense.societyDetails.participationType}`);
      }
      break;
      
    case 'fine':
      if (expense.fineDetails) {
        if (expense.fineDetails.reason) details.push(`Reason: ${expense.fineDetails.reason}`);
        if (expense.fineDetails.fineType) details.push(`Type: ${expense.fineDetails.fineType}`);
        if (expense.fineDetails.issuedBy) details.push(`Issued By: ${expense.fineDetails.issuedBy}`);
      }
      break;
      
    case 'library':
      if (expense.libraryDetails) {
        if (expense.libraryDetails.membershipType) details.push(`Membership: ${expense.libraryDetails.membershipType}`);
        if (expense.libraryDetails.maxBooks) details.push(`Max Books: ${expense.libraryDetails.maxBooks}`);
        if (expense.libraryDetails.monthlyFee) details.push(`Monthly Fee: Rs. ${expense.libraryDetails.monthlyFee}`);
      }
      break;
  }
  
  return details.length > 0 ? details : null;
};


exports.generateInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await UniversityExpense.findById(id);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    if (expense.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot download invoice for paid expense. Please download individual invoices for pending payments.'
      });
    }

    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=consolidated-invoice-${expense.studentId}-${Date.now()}.pdf`);
    
    doc.pipe(res);

    const addText = (text, x, y, options = {}) => {
      doc.fontSize(options.size || 10)
         .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
         .text(text, x, y, options);
    };

    addText('Superior University', 50, 50, { size: 20, bold: true });
    addText('CONSOLIDATED EXPENSE INVOICE', 50, 75, { size: 16, bold: true });
    
    addText('Superior University ', 50, 110);
    addText('Lahore, Pakistan', 50, 125);
    addText('Phone: +92 312343212', 50, 140);
    addText('Email: admin@superioruniversity.com', 50, 155);

    addText(`Invoice #: CONS-${expense._id.toString().slice(-8).toUpperCase()}`, 350, 110);
    addText(`Date: ${new Date().toLocaleDateString()}`, 350, 125);
    addText(`Due Date: ${expense.expenseConfigurations[0]?.paymentDueDate.toLocaleDateString() || 'N/A'}`, 350, 140);

    doc.moveTo(50, 180).lineTo(550, 180).stroke();
    addText('STUDENT INFORMATION', 50, 190, { size: 14, bold: true });
    
    addText(`Student ID: ${expense.studentId}`, 50, 220);
    addText(`Name: ${expense.studentName}`, 50, 235);
    addText(`Semester: ${expense.currentSemester}`, 50, 250);
    addText(`Section: ${expense.section}`, 50, 265);
    
    addText(`Degree: ${expense.degreeLevel}`, 250, 220);
    addText(`Department: ${expense.department}`, 250, 235);
    addText(`Batch: ${expense.batch}`, 250, 250);

    doc.moveTo(50, 300).lineTo(550, 300).stroke();
    addText('EXPENSE DETAILS', 50, 310, { size: 14, bold: true });
    
    addText('Description', 50, 340, { bold: true });
    addText('Duration', 200, 340, { bold: true });
    addText('Period', 280, 340, { bold: true });
    addText('Amount (Rs.)', 450, 340, { bold: true, align: 'right' });

    doc.moveTo(50, 355).lineTo(550, 355).stroke();

    let yPosition = 370;
    expense.expenseConfigurations.forEach((config, index) => {
      const expenseLabel = UniversityExpense.getExpenseLabel(config.expenseTitle);
      
      addText(expenseLabel, 50, yPosition);
      addText(`${config.durationInMonths} months`, 200, yPosition);
      addText(`${config.startDate.toLocaleDateString()} - ${config.endDate.toLocaleDateString()}`, 280, yPosition);
      addText(config.calculatedAmount.toLocaleString(), 450, yPosition, { align: 'right' });
      
      yPosition += 20;
    });

    doc.moveTo(50, yPosition + 10).lineTo(550, yPosition + 10).stroke();
    addText('TOTAL AMOUNT', 280, yPosition + 25, { bold: true });
    addText(`Rs. ${expense.totalAmount.toLocaleString()}`, 450, yPosition + 25, { bold: true, align: 'right' });

    addText(`Payment Status: ${expense.paymentStatus.toUpperCase()}`, 50, yPosition + 55);
    addText(`Amount Paid: Rs. ${expense.amountPaid.toLocaleString()}`, 50, yPosition + 70);
    addText(`Balance Due: Rs. ${(expense.totalAmount - expense.amountPaid).toLocaleString()}`, 50, yPosition + 85);

    addText('NOTE: This is a consolidated invoice. For individual invoice downloads and payments,', 50, yPosition + 120, { size: 9 });
    addText('please use the individual invoice system.', 50, yPosition + 132, { size: 9 });

    doc.moveTo(50, 700).lineTo(550, 700).stroke();
    addText('Thank you for your prompt payment!', 50, 710, { align: 'center', width: 500 });
    addText('For queries contact: admin@superioruniversity.com | Phone: +92 312343212', 50, 725, { align: 'center', width: 500, size: 8 });

    doc.end();

  } catch (error) {
    console.error('Error generating consolidated invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice: ' + error.message
    });
  }
};

exports.getInvoiceData = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await UniversityExpense.findById(id);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    const invoiceData = {
      invoiceNumber: `CONS-${expense._id.toString().slice(-8).toUpperCase()}`,
      issueDate: new Date().toLocaleDateString(),
      dueDate: expense.expenseConfigurations[0]?.paymentDueDate.toLocaleDateString(),
      studentInfo: {
        studentId: expense.studentId,
        name: expense.studentName,
        semester: expense.currentSemester,
        section: expense.section,
        degree: expense.degreeLevel,
        department: expense.department,
        batch: expense.batch
      },
      expenses: expense.expenseConfigurations.map(config => ({
        description: UniversityExpense.getExpenseLabel(config.expenseTitle),
        duration: `${config.durationInMonths} months`,
        period: `${config.startDate.toLocaleDateString()} - ${config.endDate.toLocaleDateString()}`,
        amount: config.calculatedAmount
      })),
      summary: {
        totalAmount: expense.totalAmount,
        amountPaid: expense.amountPaid,
        balanceDue: expense.totalAmount - expense.amountPaid,
        paymentStatus: expense.paymentStatus
      },
      individualInvoices: expense.invoices.map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        expenseTitle: inv.expenseTitle,
        description: UniversityExpense.getExpenseLabel(inv.expenseTitle),
        amount: inv.amount,
        amountPaid: inv.amountPaid,
        paymentStatus: inv.paymentStatus,
        dueDate: inv.dueDate.toLocaleDateString(),
        canDownload: inv.paymentStatus !== 'paid'
      }))
    };

    res.json({
      success: true,
      data: invoiceData
    });

  } catch (error) {
    console.error('Error getting invoice data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get invoice data: ' + error.message
    });
  }
};


exports.getExpenseRevenueStats = async (req, res) => {
  try {
    const expenses = await UniversityExpense.find({})
      .populate('studentId', 'firstName lastName');
    
    const expenseStats = {
      totalCollected: 0,
      totalPending: 0,
      categoryBreakdown: [],
      monthlyBreakdown: [],
      typeWiseStats: {}
    };
    
    expenses.forEach(expense => {
      expenseStats.totalCollected += expense.amountPaid || 0;
      expenseStats.totalPending += (expense.totalAmount - expense.amountPaid) || 0;
    });
    
    const categories = {
      transport: { amount: 0, collected: 0, pending: 0, count: 0 },
      hostel: { amount: 0, collected: 0, pending: 0, count: 0 },
      sports: { amount: 0, collected: 0, pending: 0, count: 0 },
      society: { amount: 0, collected: 0, pending: 0, count: 0 },
      fine: { amount: 0, collected: 0, pending: 0, count: 0 },
      library: { amount: 0, collected: 0, pending: 0, count: 0 }
    };
    
    expenses.forEach(expense => {
      expense.expenseConfigurations.forEach(config => {
        const category = config.expenseTitle;
        if (categories[category]) {
          categories[category].amount += config.calculatedAmount || 0;
          categories[category].count += 1;
          
          const invoice = expense.invoices.find(inv => inv.invoiceNumber === config.invoiceNumber);
          if (invoice) {
            categories[category].collected += invoice.amountPaid || 0;
            categories[category].pending += (invoice.amount - invoice.amountPaid) || 0;
          }
        }
      });
    });
    
    expenseStats.categoryBreakdown = Object.entries(categories)
      .filter(([_, data]) => data.amount > 0)
      .map(([category, data]) => ({
        category: category.charAt(0).toUpperCase() + category.slice(1),
        amount: Math.round(data.amount),
        collected: Math.round(data.collected),
        pending: Math.round(data.pending),
        count: data.count,
        percentage: Math.round((data.amount / expenseStats.totalCollected) * 100)
      }));
    
    
    const monthlyExpenseData = {};
    expenses.forEach(expense => {
      expense.invoices.forEach(invoice => {
        if (invoice.paidDate) {
          const paidDate = new Date(invoice.paidDate);
          const monthKey = `${paidDate.getFullYear()}-${(paidDate.getMonth() + 1).toString().padStart(2, '0')}`;
          const monthName = paidDate.toLocaleString('default', { month: 'short' });
          
          if (!monthlyExpenseData[monthKey]) {
            monthlyExpenseData[monthKey] = {
              month: monthName,
              amount: 0
            };
          }
          
          monthlyExpenseData[monthKey].amount += invoice.amountPaid || 0;
        }
      });
    });
    
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const monthName = date.toLocaleString('default', { month: 'short' });
      
      if (monthlyExpenseData[monthKey]) {
        months.push(monthlyExpenseData[monthKey]);
      } else {
        months.push({
          month: monthName,
          amount: 0
        });
      }
    }
    
    expenseStats.monthlyBreakdown = months;
    
    res.json({
      success: true,
      data: expenseStats
    });
    
  } catch (error) {
    console.error('Error fetching expense revenue stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense statistics'
    });
  }
};
module.exports = exports;
