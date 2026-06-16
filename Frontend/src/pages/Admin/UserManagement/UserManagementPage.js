import React from 'react';
import AddProfessor from './AddProfessor';
import FacultyList from './FacultyList';
import AddStudent from './AddStudent';
const UserManagementPage = () => {
  return (
    <div>
      <AddProfessor />
      <FacultyList />
      <AddStudent/>
      

    </div>
  );
};

export default UserManagementPage;
