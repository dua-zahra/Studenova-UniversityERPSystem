import React from "react";
import { Outlet } from "react-router-dom";
import FacultySidebar from "./FacultySidebar";

const FacultyLayout = () => {
  return (
    <div className="flex">
      <FacultySidebar />
      <div className="flex-grow p-6 bg-gray-100 min-h-screen">
       
      </div>
    </div>
  );
};

export default FacultyLayout;
