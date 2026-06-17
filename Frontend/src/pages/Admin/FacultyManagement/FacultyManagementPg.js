import React from 'react';
import API_URL from '../../../config';
import FacultyAssignmentManagement from './FacultyAssignmentManagement'; 
import FacultyAssignments from './FacultyAssignments'
const FacultyManagementPg = () => {
  return (
    <div>
      <FacultyAssignmentManagement/>
      <FacultyAssignments/>
    
    </div>
  );
};

export default FacultyManagementPg;
