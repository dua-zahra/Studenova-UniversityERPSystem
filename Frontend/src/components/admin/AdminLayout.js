import React from "react";
import AdminSidebar from "./AdminSidebar";

const AdminLayout = ({ children }) => {
  return (
    <div className="flex">
      <AdminSidebar />
      <div className="flex-grow p-6 bg-gray-100 min-h-screen">
        {children}
      </div>
    </div>
  );
};

export default AdminLayout;
