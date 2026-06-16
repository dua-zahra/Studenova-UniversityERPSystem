import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ allowedRoles }) => {
  const { userRole } = useAuth();

  return allowedRoles.includes(userRole) ? <Outlet /> : <Navigate to="/" />;
};

export default ProtectedRoute;
