import React from 'react';
import ManageStudent from './ManageStudent';
import ManageStudentlist from './ManageStudentlist';
import DropCourse from './DropCourse';
import EnrollCourse from './EnrollCourse';
import API_URL from '../../../config';

const StudentOperations = () => {
  return (
    <div>
      <ManageStudent />
      <ManageStudentlist />
      <DropCourse/>
      <EnrollCourse/>

    </div>
  );
};

export default StudentOperations;