import React from "react";
import StudentSidebar from "./StudentSidebar";
import AIChatbot from "../ERPChatBot/ERPChatBot";
import API_URL from '../config';
const StudentLayout = ({ children }) => {
  return (
    <>
      <div className="flex">
        <StudentSidebar />
        <div className="flex-grow p-6 bg-gray-100 min-h-screen overflow-y-auto">
          {children}
        </div>
      </div>
      
      <AIChatbot />
    </>
  );
};

export default StudentLayout;