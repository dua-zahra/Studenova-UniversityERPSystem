const StudentFee = require('../models/StudentFee');
const UniversityExpense = require('../models/UniversityExpense');
const Event = require('../models/EventPayment');

exports.getDashboardRevenueStats = async (req, res) => {
  try {
    const [studentFees, expenses, events] = await Promise.all([
      StudentFee.find({}),
      UniversityExpense.find({}),
      Event.find({ status: 'active' })
    ]);
    
    let totalFeeRevenue = 0;
    let totalFeePaid = 0;
    let totalFeePending = 0;
    
    let totalExpenseRevenue = 0;
    let totalExpensePaid = 0;
    let totalExpensePending = 0;
    
    let totalEventRevenue = 0;
    let totalEventPaid = 0;
    let totalEventPending = 0;
    
    studentFees.forEach(fee => {
      totalFeeRevenue += fee.totalPayableAmount || 0;
      totalFeePaid += fee.totalAmountPaid || 0;
      totalFeePending += fee.totalAmountDue || 0;
    });
    
    expenses.forEach(expense => {
      totalExpenseRevenue += expense.totalAmount || 0;
      totalExpensePaid += expense.amountPaid || 0;
      totalExpensePending += (expense.totalAmount - expense.amountPaid) || 0;
    });
    
    events.forEach(event => {
      const eventRevenue = event.amount * event.totalStudents;
      totalEventRevenue += eventRevenue;
      totalEventPaid += event.totalCollected || 0;
      totalEventPending += eventRevenue - (event.totalCollected || 0);
    });
    
    const overallStats = {
      totalRevenue: totalFeeRevenue + totalExpenseRevenue + totalEventRevenue,
      totalPaid: totalFeePaid + totalExpensePaid + totalEventPaid,
      totalPending: totalFeePending + totalExpensePending + totalEventPending,
      feeStats: {
        revenue: totalFeeRevenue,
        paid: totalFeePaid,
        pending: totalFeePending
      },
      expenseStats: {
        revenue: totalExpenseRevenue,
        paid: totalExpensePaid,
        pending: totalExpensePending
      },
      eventStats: {
        revenue: totalEventRevenue,
        paid: totalEventPaid,
        pending: totalEventPending
      }
    };
    
    const monthlyComparison = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthName = date.toLocaleString('default', { month: 'short' });
      
      const feeMonthly = Math.round(totalFeePaid / 6);
      const expenseMonthly = Math.round(totalExpensePaid / 6);
      const eventMonthly = Math.round(totalEventPaid / 6);
      
      monthlyComparison.push({
        month: monthName,
        fees: feeMonthly,
        expenses: expenseMonthly,
        events: eventMonthly
      });
    }
    
    res.json({
      success: true,
      data: {
        overall: overallStats,
        monthlyComparison: monthlyComparison,
        summary: {
          totalStudents: studentFees.length,
          totalExpenses: expenses.length,
          totalEvents: events.length,
          collectionRate: overallStats.totalRevenue > 0 ? 
            Math.round((overallStats.totalPaid / overallStats.totalRevenue) * 100) : 0
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching dashboard revenue stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
};