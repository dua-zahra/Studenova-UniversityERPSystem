import React from 'react';
import Addfee from './Addfee';
import CourseFee from './CourseFee';
import UniversityExpense from './UniversityExpense';
import Eventfee from './Eventfee';
import EventList from './EventList';
import EnrolledCourseFee from './EnrolledCourseFee';
import EnrolledCourseList from './EnrolledCourseList';
import UniversityExpenseList from './UniversityExpenseList';

import FeeInvoiceManagement from './FeeInvoiceManagement';
const FinanceMangement = () => {
  return (
    <div>
      <Addfee/>
      <FeeInvoiceManagement/>
      <CourseFee/>
      <EventList/>
      <Eventfee/>
      <UniversityExpense/>
      <UniversityExpenseList/>
      <EnrolledCourseFee/>
      <EnrolledCourseList/>
    </div>
  );
};

export default FinanceMangement;