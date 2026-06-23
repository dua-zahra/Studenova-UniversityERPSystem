import { useState, useEffect, useRef } from "react";
import { Button, Spinner } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import API_URL from '../../config';
import { faSignOutAlt, faCamera, faBars } from "@fortawesome/free-solid-svg-icons";
import {
  faTachometerAlt,
  faUsers,
  faUserGraduate,
  faBook,
  faHistory,
  faChalkboardTeacher,
  faExchangeAlt,
  faCalendarAlt,
  faCalendarWeek,
  faMoneyBillWave,
  faClipboardCheck,
  faChartLine,
  faSnowflake,
  faWifi
} from "@fortawesome/free-solid-svg-icons";

import { useAuth } from "../../context/AuthContext";  
import { useNavigate } from "react-router-dom";

import AdminDashboard from "./AdminDashboard";
import AddProfessor from "../../pages/Admin/UserManagement/AddProfessor";
import FacultyList from "../../pages/Admin/UserManagement/FacultyList";
import AddStudent from "../../pages/Admin/UserManagement/AddStudent";
import ManageStudents from "../../pages/Admin/StudentOperations/ManageStudents";
import ManageStudentslist from "../../pages/Admin/StudentOperations/ManageStudentslist";
import DropCourse from "../../pages/Admin/StudentOperations/DropCourse";
import EnrollCourse from "../../pages/Admin/StudentOperations/EnrollCourse";
import AddCourse from "../../pages/Admin/DepartmentCourseManagement/AddCourse";
import AddDepartment from "../../pages/Admin/DepartmentCourseManagement/AddDepartment";
import CourseList from "../../pages/Admin/DepartmentCourseManagement/CourseList";
import AddBatch from "../../pages/Admin/DepartmentCourseManagement/AddBatch";
import AcademicCalender from "../../pages/Admin/AcademicCalender";
import Addfee from "../../pages/Admin/FinanceManagement/Addfee";
import FeeInvoiceManagement from "../../pages/Admin/FinanceManagement/FeeInvoiceManagement"
import CourseFee from "../../pages/Admin/FinanceManagement/CourseFee";
import Eventfee from "../../pages/Admin/FinanceManagement/Eventfee";
import EventList from "../../pages/Admin/FinanceManagement/EventList";
import UniversityExpense from "../../pages/Admin/FinanceManagement/UniversityExpense";
import UniversityExpenseList from "../../pages/Admin/FinanceManagement/UniversityExpenseList";
import EnrolledCourseFee from "../../pages/Admin/FinanceManagement/EnrolledCourseFee";
import EnrolledCourseList from "../../pages/Admin/FinanceManagement/EnrolledCourseList";
import FacultyAssignmentManagement from "../../pages/Admin/FacultyManagement/FacultyAssignmentManagement";
import FacultyAssignments from "../../pages/Admin/FacultyManagement/FacultyAssignments";
import ManageTimetable from "../../pages/Admin/SemesterTimetable/ManageTimetable";
import PublishedTimetable from '../../pages/Admin/SemesterTimetable/PublishedTimetable';
import AdminResults from "../../pages/Admin/Results/AdminResults"; 
import AdminAttendancePage from "../../pages/Admin/Attendance/AdminAttendance";
import "../../assets/style.css";

const AdminSidebar = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [isOpen, setIsOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [profilePic, setProfilePic] = useState(null);
  const [showOptions, setShowOptions] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isStudentOperationsOpen, setIsStudentOperationsOpen] = useState(false);
  const [isCourseManagementOpen, setIsCourseManagementOpen] = useState(false);
  const [isFacultyManagementOpen, setIsFacultyManagementOpen] = useState(false);
  const [isFinanceManagementOpen, setIsFinanceManagementOpen] = useState(false);
  const [isTimetableOpen, setIsTimetableOpen] = useState(false); 
  const [activeModule, setActiveModule] = useState("Dashboard");
  const [uploading, setUploading] = useState(false);

  const userRole = "Admin";

  const dropdownMenuItems = ["User Management", "Course & Department Management", "Faculty Management", "Finance Management","Student Operations", "Semester Timetable"];

  const menuItems = [
    { name: "Dashboard", icon: faTachometerAlt },
    { name: "User Management", icon: faUsers },
    { name: "Student Operations", icon: faChalkboardTeacher },
    { name: "Course & Department Management", icon: faBook },
    { name: "Faculty Management", icon: faUserGraduate },
    { name: "Academic Calender", icon: faCalendarAlt },
    { name: "Semester Timetable", icon: faCalendarWeek },
    { name: "Finance Management", icon: faMoneyBillWave },
    { name: "Attendance Management", icon: faClipboardCheck },
    { name: "Result Management", icon: faChartLine },
  ];

  useEffect(() => {
    fetchProfilePic();
    
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsOpen(false);
      } else {
        setIsOpen(true);
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); 
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchProfilePic = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/profile/profile-pic`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.profilePic) {
          setProfilePic(`${API_URL}${data.profilePic}?t=${Date.now()}`);
        } else {
          setProfilePic(null);
        }
      } else {
        console.log("Profile picture not found, using default avatar");
        setProfilePic(null);
      }
    } catch (error) {
      console.error("Error fetching profile picture:", error);
      setProfilePic(null);
    }
  };

  const handleProfilePicUpload = async (file) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size too large. Maximum 5MB allowed.");
      return;
    }

    
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload an image (JPEG, PNG, GIF, WebP).");
      return;
    }

    const formData = new FormData();
    formData.append('profilePic', file);

    try {
      setUploading(true);
      setShowOptions(false);

      const response = await fetch(`${API_URL}/admin/profile/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success("Profile picture updated successfully!");
        if (data.profilePic) {
          setProfilePic(`${API_URL}${data.profilePic}?t=${Date.now()}`);
        }
      } else {
        throw new Error(data.message || "Upload failed");
      }
    } catch (err) {
      console.error("Error uploading profile picture:", err);
      toast.error(err.message || "Failed to upload profile picture");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeProfilePic = async () => {
    try {
      setShowOptions(false);
      
      const response = await fetch(`${API_URL}/admin/profile/delete`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setProfilePic(null);
        toast.success("Profile picture removed successfully");
      } else {
        throw new Error(data.message || "Failed to remove profile picture");
      }
    } catch (error) {
      console.error("Error removing profile picture:", error);
      toast.error("Error removing profile picture. Please try again.");
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleProfilePicUpload(file);
    }
  };

  const toggleUserManagement = () => {
    setIsUserManagementOpen(!isUserManagementOpen);
  };
  const toggleStudentOperations = () => {
    setIsStudentOperationsOpen(!isStudentOperationsOpen);
  };

  const toggleCourseManagement = () => {
    setIsCourseManagementOpen(!isCourseManagementOpen);
  };

  const toggleFacultyManagement = () => {
    setIsFacultyManagementOpen(!isFacultyManagementOpen);
  };

  const toggleFinanceManagement = () => {
    setIsFinanceManagementOpen(!isFinanceManagementOpen);
  };

  const toggleTimetable = () => {
    setIsTimetableOpen(!isTimetableOpen);
  };

  const handleModuleClick = (moduleName) => {
    if (!dropdownMenuItems.includes(moduleName)) {
      setActiveModule(moduleName);
    }
    
    if (isMobile) {
      setIsOpen(false); 
    }
  };

  const handleParentMenuClick = (itemName) => {
    if (itemName === "User Management") {
      toggleUserManagement();
    } else if (itemName === "Student Operations") {
      toggleStudentOperations();
    } else if (itemName === "Course & Department Management") {
      toggleCourseManagement();
    } else if (itemName === "Finance Management") {
      toggleFinanceManagement();
    } else if (itemName === "Faculty Management") {
      toggleFacultyManagement();
    } else if (itemName === "Semester Timetable") {
      toggleTimetable();
    } 
  };

  const handleMenuItemClick = (itemName) => {
    if (dropdownMenuItems.includes(itemName)) {
      handleParentMenuClick(itemName);
    } else {
      handleModuleClick(itemName);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const renderContent = () => {
    switch (activeModule) {
      case "Dashboard":
        return <AdminDashboard />;
      case "AddProfessor":
        return <AddProfessor />;
      case "FacultyList":
        return <FacultyList />;
      case "AddStudent":
        return <AddStudent />;
      case "ManageStudents":
        return <ManageStudents />;
      case "EnrollCourse":
        return <EnrollCourse />;
      case "DropCourse":
        return <DropCourse />;
      case "ManageStudentslist":
        return <ManageStudentslist />;
      case "AddCourse":
        return <AddCourse />;
      case "AddDepartment":
        return <AddDepartment />;
      case "CourseList":
        return <CourseList />;
      case "AddBatch":
        return <AddBatch />;
      case "Academic Calender":
        return <AcademicCalender />;
      case "Addfee":
        return <Addfee />;
      case "FeeInvoiceManagement":
        return <FeeInvoiceManagement />;
      case "CourseFee":
        return <CourseFee />;
      case "Eventfee":
        return <Eventfee />;
      case "EventList":
        return <EventList />;
      case "UniversityExpense":
        return <UniversityExpense />;
      case "UniversityExpenseList":
        return <UniversityExpenseList />;
      case "EnrolledCourseFee":
        return <EnrolledCourseFee />;
      case "EnrolledCourseList":
        return <EnrolledCourseList />;
      case "FacultyAssignmentManagement":
        return <FacultyAssignmentManagement />;
      case "FacultyAssignments":
        return <FacultyAssignments />;
      case "Timetable":
        return <ManageTimetable />;
      case "PublishTimetable":
        return <PublishedTimetable />;
      case "Attendance Management":
        return <AdminAttendancePage />;
      case "Result Management":
        return <AdminResults/>;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <div className="d-flex admin-layout" style={{ height: "100vh", overflow: "hidden" }}>
      <ToastContainer position="top-right" autoClose={3000} />
      
      {!isOpen && (
        <button className="main-toggle-btn" onClick={toggleSidebar}>
          <FontAwesomeIcon icon={faBars} />
        </button>
      )}
      
      <aside className={`sidebar custom-scrollbar p-3 d-flex flex-column ${isOpen ? "open" : "collapsed"}`}>
        <div className="d-flex justify-content-between align-items-center">
          <button className="sidebar-toggle-btn" onClick={toggleSidebar}>
            <FontAwesomeIcon icon={faBars} />
          </button>
          <div style={{width: '40px'}}></div> 
        </div>

        <div className="mt-4 text-center position-relative">
          <div className="profile-container d-inline-block position-relative">
            {uploading ? (
              <div className="profile-img-placeholder d-flex justify-content-center align-items-center rounded-circle bg-secondary text-white" style={{width: '100px', height: '100px'}}>
                <Spinner animation="border" variant="light" />
              </div>
            ) : (
              <img
                src={profilePic || "/default-avatar.png"}
                alt="Profile"
                className="profile-img shadow-sm rounded-circle border border-secondary"
                style={{width: '100px', height: '100px', objectFit: 'cover'}}
                onError={(e) => {
                  e.target.src = "/default-avatar.png";
                }}
              />
            )}
            <button
              className="edit-button btn btn-primary rounded-circle position-absolute bottom-0 end-0"
              style={{width: '30px', height: '30px', padding: 0}}
              onClick={() => setShowOptions(!showOptions)}
              disabled={uploading}
            >
              <FontAwesomeIcon icon={faCamera} size="xs" />
            </button>
          </div>

          {showOptions && (
            <div className="edit-options bg-dark text-white p-2 rounded mt-2">
              <input
                type="file"
                ref={fileInputRef}
                className="d-none"
                id="uploadProfilePic"
                onChange={handleFileChange}
                accept="image/*"
                disabled={uploading}
              />
              <label 
                htmlFor="uploadProfilePic" 
                className="d-block text-center cursor-pointer mb-1 btn btn-sm btn-outline-light w-100"
                style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </label>
              <button 
                className="btn btn-sm btn-danger w-100 mt-1" 
                onClick={removeProfilePic}
                disabled={uploading || !profilePic}
                style={{ cursor: (uploading || !profilePic) ? 'not-allowed' : 'pointer' }}
              >
                Remove
              </button>
            </div>
          )}

          <p className="mt-2 fw-bold role-text">{userRole}</p>
          <p className="small text-truncate email-text">{user?.email || "email"}</p>
        </div>

        <nav className="mt-4 flex-grow-1 menu-container">
          <ul className="list-unstyled menu-list">
            {menuItems.map((item, index) => (
              <li
                key={index}
                className={`menu-item ${activeModule === item.name ? "active-item" : ""} ${
                  dropdownMenuItems.includes(item.name) ? "has-dropdown" : ""
                }`}
                onClick={() => handleMenuItemClick(item.name)}
              >
                <div className="menu-title">
                  <FontAwesomeIcon icon={item.icon} className="me-3" />
                  <span>{item.name}</span>
                </div>

                {item.name === "User Management" && isUserManagementOpen && (
                  <div className="submenu-container">
                    <button
                      className={`submenu-item ${activeModule === "AddProfessor" ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleModuleClick("AddProfessor");
                      }}
                    >
                      Add Professor
                    </button>
                    <button
                      className={`submenu-item ${activeModule === "FacultyList" ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleModuleClick("FacultyList");
                      }}
                    >
                      Faculty List
                    </button>
                    <button
                      className={`submenu-item ${activeModule === "AddStudent" ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleModuleClick("AddStudent");
                      }}
                    >
                      Add Student
                    </button>
                  </div>
                )}
                
                {item.name === "Student Operations" && isStudentOperationsOpen && (
                  <div className="submenu-container">
                    <button
                      className={`submenu-item ${activeModule === "ManageStudents" ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleModuleClick("ManageStudents");
                      }}
                    >
                      Freeze/Unfreeze Semester
                    </button>
                    <button
                      className={`submenu-item ${activeModule === "DropCourse" ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleModuleClick("DropCourse");
                      }}
                    >
                      Drop Course
                    </button>
                    <button
                      className={`submenu-item ${activeModule === "EnrollCourse" ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleModuleClick("EnrollCourse");
                      }}
                    >
                      Enroll Course
                    </button>
                    <button
                      className={`submenu-item ${activeModule === "ManageStudentslist" ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleModuleClick("ManageStudentslist");
                      }}
                    >
                      Student Academic View
                    </button>
                  </div>
                )}
                {item.name === "Course & Department Management" && isCourseManagementOpen && (
                  <div className="submenu-container">
                    <button
                      className={`submenu-item ${activeModule === "AddDepartment" ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleModuleClick("AddDepartment");
                      }}
                    >
                      Add Department
                    </button>
                    <button
                      className={`submenu-item ${activeModule === "AddCourse" ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleModuleClick("AddCourse");
                      }}
                    >
                      Add Course
                    </button>
                    <button
                      className={`submenu-item ${activeModule === "CourseList" ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleModuleClick("CourseList");
                      }}
                    >
                      Courses List
                    </button>
                    <button
                      className={`submenu-item ${activeModule === "AddBatch" ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleModuleClick("AddBatch");
                      }}
                    >
                      Create Batch
                    </button>
                  </div>
                )}

                {item.name === "Faculty Management" && isFacultyManagementOpen && (
                  <div className="submenu-container">
                    <button 
                      className={`submenu-item ${activeModule === "FacultyAssignmentManagement" ? "active" : ""}`} 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleModuleClick("FacultyAssignmentManagement"); 
                      }}
                    >
                      Faculty Course Assignment
                    </button>
                    <button 
                      className={`submenu-item ${activeModule === "FacultyAssignments" ? "active" : ""}`} 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleModuleClick("FacultyAssignments"); 
                      }}
                    >
                      Faculty Assignments
                    </button>
                  </div>
                )}

                {item.name === "Finance Management" && isFinanceManagementOpen && (
                  <div className="submenu-container">
                    <button 
                      className={`submenu-item ${activeModule === "CourseFee" ? "active" : ""}`} 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleModuleClick("CourseFee"); 
                      }}
                    >
                      Course Fee
                    </button>
                     <button 
                      className={`submenu-item ${activeModule === "Addfee" ? "active" : ""}`} 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleModuleClick("Addfee"); 
                      }}
                    >
                      Add Fee
                    </button>
                    <button 
                      className={`submenu-item ${activeModule === "FeeInvoiceManagement" ? "active" : ""}`} 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleModuleClick("FeeInvoiceManagement"); 
                      }}
                    >
                      Generate Fee Invoices
                    </button>
                     <button 
                      className={`submenu-item ${activeModule === "Eventfee" ? "active" : ""}`} 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleModuleClick("Eventfee"); 
                      }}
                    >
                      Event Fee
                    </button>
                     <button 
                      className={`submenu-item ${activeModule === "EventList" ? "active" : ""}`} 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleModuleClick("EventList"); 
                      }}
                    >
                      Event List
                    </button>
                    
                     <button 
                      className={`submenu-item ${activeModule === "UniversityExpense" ? "active" : ""}`} 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleModuleClick("UniversityExpense"); 
                      }}
                    >
                      University Student Expense 
                    </button>
                    <button 
                      className={`submenu-item ${activeModule === "UniversityExpenseList" ? "active" : ""}`} 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleModuleClick("UniversityExpenseList"); 
                      }}
                    >
                      Student Expense List
                    </button>
                     <button 
                      className={`submenu-item ${activeModule === "EnrolledCourseFee" ? "active" : ""}`} 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleModuleClick("EnrolledCourseFee"); 
                      }}
                    >
                      Repeat/Fresh Course Fee 
                    </button>
                    <button 
                      className={`submenu-item ${activeModule === "EnrolledCourseList" ? "active" : ""}`} 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleModuleClick("EnrolledCourseList"); 
                      }}
                    >
                      Repeat/Fresh Course List 
                    </button>
                  </div>
                )}

                {item.name === "Semester Timetable" && isTimetableOpen && (
                  <div className="submenu-container">
                    <button 
                      className={`submenu-item ${activeModule === "Timetable" ? "active" : ""}`} 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleModuleClick("Timetable"); 
                      }}
                    >
                      Manage Timetable
                    </button>
                    <button 
                      className={`submenu-item ${activeModule === "PublishTimetable" ? "active" : ""}`} 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleModuleClick("PublishTimetable"); 
                      }}
                    >
                      Published Timetable
                    </button>
                  </div>
                )}

              </li>
            ))}
            
          </ul>
        </nav>
        
        <div className="mt-auto pt-3 text-center">
          <Button onClick={handleLogout} className="sidebar-logout-btn">
            <FontAwesomeIcon icon={faSignOutAlt} className="me-2" />
            Logout
          </Button>
        </div>
      </aside>

      <div className={`main-content flex-grow-1 p-3 ${isOpen ? "" : "collapsed"}`}>
        {renderContent()}
      </div>
    </div>
  );
};

export default AdminSidebar;