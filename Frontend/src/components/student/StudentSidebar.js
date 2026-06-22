import { useState, useEffect } from "react";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTachometerAlt,
  faBook,
  faClipboardCheck,
  faCalendarAlt,
  faChartLine,
  faBell,
  faSignOutAlt,
  faBars,
  faTasks, 
} from "@fortawesome/free-solid-svg-icons";
import { Button } from "react-bootstrap";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import API_URL from '../../config';
import StudentDashboard from "./StudentDashboard";
import Attendance from "../../pages/Student/Attendance";
import TimeTable from "../../pages/Student/TimeTable";
import Result from "../../pages/Student/Result";
import Invoices from "../../pages/Student/Invoices";
import StudentTasks from "../../pages/Student/StudentTasks";



import MaleAvatar from "../../assets/Male-avatar.png";
import FemaleAvatar from "../../assets/Female-avatar.png";
import "../../assets/Facultystyle.css";

const StudentSidebar = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeModule, setActiveModule] = useState("Dashboard");

  const [faculty, setFaculty] = useState(null);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (storedUser?.role === "faculty") {
      setFaculty(storedUser);

      axios
        .get(`${API_URL}/api/faculty/email/${storedUser.universityEmail}`)
        .then((res) => setFaculty(res.data))
        .catch(() => {
        });
    }
  }, []);

  const imageBasePath = `${API_URL}/uploads/`;

 const profileImage = faculty?.profilePic
  ? `${imageBasePath}${faculty.profilePic}` 
  : faculty?.photo
  ? `${imageBasePath}${faculty.photo}`       
  : faculty?.gender?.toLowerCase() === "female"
  ? FemaleAvatar
  : MaleAvatar;

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setIsOpen(!mobile);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const menuItems = [
    { name: "Dashboard", icon: faTachometerAlt },
    { name: "Attendance", icon: faClipboardCheck },
    { name: "TimeTable", icon: faClipboardCheck },
    { name: "Result", icon: faClipboardCheck },
    { name: "Invoices", icon: faClipboardCheck },
    { name: "Tasks", icon: faClipboardCheck },





  ];

  return (
    <div className="d-flex admin-layout" style={{ height: "100vh", overflow: "hidden" }}>
      <ToastContainer position="top-right" autoClose={3000} />

      {!isOpen && (
        <button className="main-toggle-btn" onClick={() => setIsOpen(true)}>
          <FontAwesomeIcon icon={faBars} style={{ color: "#8a7aa8" }} />
        </button>
      )}

      <aside className={`sidebar custom-scrollbar p-3 d-flex flex-column ${isOpen ? "open" : "collapsed"}`}>
        <div className="d-flex justify-content-between align-items-center">
          <button className="sidebar-toggle-btn" onClick={() => setIsOpen(false)}>
            <FontAwesomeIcon icon={faBars} style={{ color: "#8a7aa8" }} />
          </button>
          <div style={{ width: "40px" }}></div>
        </div>

        <div className="mt-4 text-center position-relative">
          <div className="profile-container d-inline-block position-relative">
           <img
  src={profileImage}
  alt="Faculty"
  onError={(e) => {
    e.target.onerror = null;
    e.target.src = MaleAvatar;
  }}
  className="profile-img"
/>

          </div>
          <p className="small text-truncate fw-bold text-white">
            {faculty?.universityEmail || ""}
          </p>
        </div>

        <nav className="mt-4 flex-grow-1 menu-container">
          <ul className="list-unstyled menu-list">
            {menuItems.map((item, index) => (
              <li
                key={index}
                className={`menu-item text-white fw-bold ${activeModule === item.name ? "active-item" : ""}`}
                onClick={() => setActiveModule(item.name)}
              >
                <FontAwesomeIcon 
                  icon={item.icon} 
                  className="me-3" 
                  style={{ color: "#8a7aa8" }} 
                />
                <span>{item.name}</span>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto pt-3 text-center">
          <Button onClick={handleLogout} className="sidebar-logout-btn">
            <FontAwesomeIcon 
              icon={faSignOutAlt} 
              className="me-2" 
              style={{ color: "#8a7aa8" }} 
            />
            Logout
          </Button>
        </div>
      </aside>

      <div className={`main-content flex-grow-1 p-3  ${isOpen ? "" : "collapsed"}`}>
        {activeModule === "Dashboard" && <StudentDashboard />}
        {activeModule === "Attendance" && <Attendance />}
        {activeModule === "TimeTable" && <TimeTable />}
        {activeModule === "Result" && <Result />}
        {activeModule === "Invoices" && <Invoices />}
                {activeModule === "Tasks" && <StudentTasks />}
       {activeModule === "Freeze/UnFreeze" && <Freeze />}
   




      </div>
    </div>
  );
};

export default StudentSidebar;