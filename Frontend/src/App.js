import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from 'react-toastify';  
import 'react-toastify/dist/ReactToastify.css'; 
import "bootstrap/dist/css/bootstrap.min.css";
import DemoBanner from './components/DemoBanner';
import Login from "./components/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";

// Admin pages
import AdminDashboard from "./pages/Admin/AdminDashboard";
import UserManagementPage from './pages/Admin/UserManagement/UserManagementPage';
import AddProfessor from "./pages/Admin/UserManagement/AddProfessor";
import FacultyList from "./pages/Admin/UserManagement/FacultyList";
import EditProfessor from "./pages/Admin/UserManagement/EditProfessor";
import AddStudent from "./pages/Admin/UserManagement/AddStudent";
import ManageStudents from "./pages/Admin/StudentOperations/ManageStudents";
import ManageStudentslist from "./pages/Admin/StudentOperations/ManageStudentslist";
import DropCourse from "./pages/Admin/StudentOperations/DropCourse";
import EnrollCourse from "./pages/Admin/StudentOperations/EnrollCourse";
import DepartmentCourseManagement from "./pages/Admin/DepartmentCourseManagement/DepartmentCourseManagementPg";
import AddDepartment from "./pages/Admin/DepartmentCourseManagement/AddDepartment";
import AddCourse from "./pages/Admin/DepartmentCourseManagement/AddCourse";
import AddBatch from "./pages/Admin/DepartmentCourseManagement/AddBatch";
import CourseList from "./pages/Admin/DepartmentCourseManagement/CourseList";
import FinanceMangement from "./pages/Admin/FinanceManagement/FinanceManagementPg";
import Addfee from "./pages/Admin/FinanceManagement/Addfee"
import CourseFee from "./pages/Admin/FinanceManagement/CourseFee"
import Eventfee from "./pages/Admin/FinanceManagement/Eventfee"
import UniversityExpense from "./pages/Admin/FinanceManagement/CourseFee"
import SemesterTimetable from "./pages/Admin/FinanceManagement/UniversityExpense";
import EnrolledCourseFee from "./pages/Admin/FinanceManagement/EnrolledCourseFee";
import EnrolledCourseList from "./pages/Admin/FinanceManagement/EnrolledCourseList";
import ManageTimetable from './pages/Admin/SemesterTimetable/ManageTimetable'
import PublishedTimetable from './pages/Admin/SemesterTimetable/PublishedTimetable'
import AdminAttendance from "./pages/Admin/Attendance/AdminAttendance";
import AdminResults from "./pages/Admin/Results/AdminResults";
// Faculty Pages
import FacultyDashboard from "./pages/Faculty/FacultyDashboard";
console.log("FacultyDashboard is:", FacultyDashboard);

// Student Pages

import StudentDashboard from "./pages/Student/StudentDashboard";
import StudentLayout from "./components/student/StudentLayout";
import Attendance from "./pages/Student/Attendance";
import TimeTable from "./pages/Student/TimeTable";
import Result from "./pages/Student/Result";
import Invoices from "./pages/Student/Invoices";




const App = () => {
  const { userRole, setUserRole } = useAuth();

  useEffect(() => {
    const storedRole = localStorage.getItem("userRole");
    if (storedRole) {
      setUserRole(storedRole);
    }
  }, [setUserRole]);

  return (
    <>
      <DemoBanner/>
    <Router>
      <ToastContainer />
    <Routes>
  <Route path="/" element={<Login />} />

  {/* Admin protected routes */}
  <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
    <Route path="/admin/dashboard" element={<AdminDashboard />} />
    <Route path="/admin/usermanagement/addprofessor" element={<AddProfessor />} />
    <Route path="/admin/usermanagement/facultylist" element={<FacultyList />} />
    <Route path="/admin/usermanagement/editprofessor/:id" element={<EditProfessor />} />
    <Route path="/admin/usermanagement/addstudent/:id" element={<AddStudent />} />
    <Route path="/admin/studentoperations/ManageStudents" element={<ManageStudents />} />
    <Route path="/admin/studentoperations/ManageStudentslist" element={<ManageStudentslist />} />
    <Route path="/admin/studentoperations/DropCourse" element={<DropCourse />} />
    <Route path="/admin/studentoperations/EnrollCourse" element={<EnrollCourse />} />
    <Route path="/user-management" element={<UserManagementPage />} />
    <Route path="/admin/department-course-management" element={<DepartmentCourseManagement />} />
    <Route path="/admin/department-course-management/addcourse/:id" element={<AddCourse />} />
    <Route path="/admin/department-course-management/adddepartment/:id" element={<AddDepartment />} />
    <Route path="/admin/department-course-management/courselist" element={<CourseList />} />
    <Route path="/admin/department-course-management/addbatch" element={<AddBatch />} />
    <Route path="/admin/FinanceManagement/addfee" element={<Addfee/>} />
    <Route path="/admin/FinanceManagement/CourseFee" element={<CourseFee/>} />
    <Route path="/admin/FinanceManagement/Eventfee" element={<Eventfee/>} />
     <Route path="/admin/FinanceManagement/EnrolledCourseFee" element={<EnrolledCourseFee/>} />
      <Route path="/admin/FinanceManagement/EnrolledCourseList" element={<EnrolledCourseList/>} />
    <Route path="/admin/FinanceManagement/UniversityExpense" element={<UniversityExpense/>} />
    <Route path="/admin/SemesterTimetable/ManageTimetable" element={<ManageTimetable/>}/>
    <Route path="/admin/SemesterTimetable/PublishedTimetable" element={<PublishedTimetable/>}/>
  <Route path="/admin/attendance" element={<AdminAttendance />} />
    <Route path="/admin/results" element={<AdminResults />} />


  </Route>

  {/* Faculty protected routes */}
  <Route element={<ProtectedRoute allowedRoles={["faculty"]} />}>
    <Route path="/faculty/dashboard" element={<FacultyDashboard />} />
  </Route>


  <Route element={<ProtectedRoute allowedRoles={["student"]} />}>
  <Route path="/student" element={<StudentLayout />}>
      <Route path="dashboard" element={<StudentDashboard />} />
      <Route path="attendance" element={<Attendance />} />
      <Route path="timetable" element={<TimeTable />} />
      <Route path="result" element={<Result />} />
      <Route path="invoices" element={<Invoices />} />




      
      
  </Route>
</Route>

      <Route path="attendance" element={<Attendance />} />

   
  <Route path="*" element={<Navigate to="/" />} />
</Routes>


    </Router>
    </>
  );
};

export default App;
