import React from "react";
import StudentSidebar from "../../components/student/StudentDashboard";
import API_URL from '../../config';

const StudentDashboard = () => {
  return (
    <div className="flex">
      <StudentSidebar />
      
    </div>
  );
};

export default StudentDashboard;