import React from 'react';
import AddCourse from './AddCourse';
import AddDepartment from './AddDepartment';
import CourseList from './CourseList'
import AddBatch from './AddBatch';
const DepartmentCourseManagement = () => {
  return (
    <div>
      <AddCourse/>
      <AddDepartment/>
      <CourseList/>
      <AddBatch/>
    
    </div>
  );
};

export default DepartmentCourseManagement;
