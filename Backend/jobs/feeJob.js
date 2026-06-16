const schedule = require('node-schedule');
const feeController = require('../controllers/feeController');
const StudentFee = require('../models/StudentFee');
const { isAfter } = require('date-fns');

schedule.scheduleJob('0 6 * * *', async () => {
  console.log('Running daily fee overdue check...');
  try {
    const updated = await feeController.checkOverdueFees();
    console.log(`Fee check completed. Updated ${updated} records.`);
  } catch (err) {
    console.error('Error in fee check job:', err);
  }
});

schedule.scheduleJob('0 * * * *', async () => {
  try {
    const currentDate = new Date();
    console.log('Running hourly installment status check...');

    const studentFees = await StudentFee.find({
      'semesterFees.installments': {
        $elemMatch: {
          status: 'pending',
          dueDate: { $lt: currentDate }
        }
      }
    });

    let updatedCount = 0;

    for (const studentFee of studentFees) {
      let needsUpdate = false;
      
      for (const semester of studentFee.semesterFees) {
        for (const installment of semester.installments) {
          if (installment.status === 'pending' && installment.dueDate < currentDate) {
            const daysOverdue = Math.max(0, Math.floor((currentDate - installment.dueDate) / (1000 * 60 * 60 * 24)));
            
            if (daysOverdue > 0) {
              if (daysOverdue <= 7) {
                installment.status = 'fine_applied';
                installment.fineAmount = daysOverdue * 100;
                installment.daysOverdue = daysOverdue;
              } else {
                installment.status = 'readmission_required';
                installment.fineAmount = 30000 + installment.amount; 
                installment.daysOverdue = daysOverdue;
                studentFee.status = 'readmission_required';
              }
              needsUpdate = true;
            }
          }
        }
      }

      if (needsUpdate) {
        await studentFee.save();
        updatedCount++;
      }
    }

    console.log(`Hourly fee check completed. Updated ${updatedCount} student fee records.`);

  } catch (err) {
    console.error('Error updating installment statuses:', err);
  }
});

schedule.scheduleJob('0 2 * * *', async () => {
  try {
    console.log('Running daily fee completion check...');
    
    const studentFees = await StudentFee.find({
      status: { $in: ['active', 'overdue'] },
      totalDue: 0
    });

    let completedCount = 0;

    for (const studentFee of studentFees) {
      studentFee.status = 'completed';
      await studentFee.save();
      completedCount++;
    }

    console.log(`Fee completion check completed. Marked ${completedCount} fees as completed.`);

  } catch (err) {
    console.error('Error in fee completion check:', err);
  }
});