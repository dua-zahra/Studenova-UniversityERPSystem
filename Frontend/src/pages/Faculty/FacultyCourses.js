import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import API_URL from '../../../config';

function FacultyCourses() {
  const [courses, setCourses] = useState([]);
  const [filteredCourses, setFilteredCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [facultyInfo, setFacultyInfo] = useState(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const facultyUser = JSON.parse(localStorage.getItem("user"));
        const facultyEmail = facultyUser?.universityEmail || facultyUser?.email;

        if (!facultyEmail) {
          toast.error("Logged-in faculty email not found");
          setLoading(false);
          return;
        }

        const response = await axios.get(
          `${API_URL}/api/faculty-courses/courses`,
          { params: { universityEmail: facultyEmail }, withCredentials: true, timeout: 10000 }
        );

        if (response.data.success) {
          const fetchedCourses = response.data.courses || [];
          setCourses(fetchedCourses);
          setFilteredCourses(fetchedCourses);
          setFacultyInfo(response.data.faculty);
          
          const summary = response.data.summary;
          
          toast.success(
            `Loaded ${summary.total} courses! (${summary.inProgress} active, ${summary.completed} completed, ${summary.removed} removed)`,
            { autoClose: 5000, position: "top-center" }
          );
        } else {
          toast.error(response.data.message || "Failed to load courses");
          setCourses([]);
        }
      } catch (err) {
        if (err.response?.data?.message) {
          toast.error(`${err.response.data.message}`);
        } else if (err.code === 'ECONNABORTED') {
          toast.error("Request timeout - server is taking too long to respond");
        } else {
          toast.error("Network error - please check your connection");
        }
        setCourses([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  // Filter courses
  useEffect(() => {
    let filtered = [];
    switch (filter) {
      case "all":
        filtered = courses;
        break;
      case "active":
        filtered = courses.filter(course => course.teachingStatus === "in-progress" && course.isActive);
        break;
      case "completed":
        filtered = courses.filter(course => course.teachingStatus === "completed");
        break;
      case "removed":
        filtered = courses.filter(course => course.teachingStatus === "removed");
        break;
      default:
        filtered = courses;
    }
    setFilteredCourses(filtered);
  }, [filter, courses]);

  const getStatusBadge = (teachingStatus) => {
    const statusConfig = {
      "in-progress": { color: "#28a745", text: "Active" },
      "completed": { color: "#6c5fa1", text: "Completed" },
      "removed": { color: "#d1a3b8", text: "Removed" } // light color for removed
    };
    const config = statusConfig[teachingStatus] || { color: "#6c757d", text: teachingStatus };
    return (
      <span
        style={{
          backgroundColor: config.color,
          color: "white",
          padding: "4px 8px",
          borderRadius: "12px",
          fontSize: "12px",
          fontWeight: "bold",
        }}
      >
        {config.text}
      </span>
    );
  };

  const getCardStyle = (teachingStatus) => {
    const baseStyle = {
      border: "1px solid #ddd",
      padding: "15px",
      borderRadius: "8px",
      boxShadow: "0px 2px 8px rgba(0,0,0,0.1)",
      transition: "all 0.3s ease",
      cursor: "pointer",
    };

    // Light background colors for completed/removed
    const statusStyles = {
      "in-progress": { borderLeft: "4px solid #28a745", backgroundColor: "#fff" },
      "completed": { borderLeft: "4px solid #6c5fa1", backgroundColor: "#f3e8ff" }, // very light purple
      "removed": { borderLeft: "4px solid #d1a3b8", backgroundColor: "#fff0f5" } // very light pink
    };

    return { ...baseStyle, ...statusStyles[teachingStatus] };
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Not specified";
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", backgroundColor: "#f8f9fa", borderRadius: "8px", margin: "20px" }}>
        <h3>Loading your courses...</h3>
        <p>Please wait while we fetch your teaching assignments</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <ToastContainer autoClose={5000} position="top-right" closeOnClick pauseOnHover theme="light" />

      {/* Header Section */}
      <div style={{ marginBottom: "30px" }}>
        <h1 style={{ color: "#2c3e50", marginBottom: "10px" }}>My Assigned Courses</h1>
        {facultyInfo && (
          <div style={{ backgroundColor: "#e8f4fd", padding: "15px", borderRadius: "8px", marginBottom: "20px", border: "1px solid #b3d9ff" }}>
            <h4 style={{ margin: "0 0 10px 0", color: "#2c3e50" }}>Faculty Profile</h4>
            <p><strong>Name:</strong> {facultyInfo.name}</p>
            <p><strong>Department:</strong> {facultyInfo.department}</p>
            <p><strong>Designation:</strong> {facultyInfo.designation}</p>
            <p><strong>Current Workload:</strong> {facultyInfo.currentWorkload} credit hours</p>
          </div>
        )}
      </div>

      {/* Filter Section */}
      <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "8px" }}>
        <label style={{ marginRight: "10px", fontWeight: "bold", fontSize: "16px" }}>Filter by Status:</label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: "8px 12px", borderRadius: "6px", border: "2px solid #dee2e6", fontSize: "14px", fontWeight: "bold" }}>
          <option value="all">All Courses ({courses.length})</option>
          <option value="active">Active ({courses.filter(c => c.teachingStatus === "in-progress" && c.isActive).length})</option>
          <option value="completed">Completed ({courses.filter(c => c.teachingStatus === "completed").length})</option>
          <option value="removed">Removed ({courses.filter(c => c.teachingStatus === "removed").length})</option>
        </select>
      </div>

      {/* Courses Grid */}
      {filteredCourses.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", backgroundColor: "#f8f9fa", borderRadius: "8px", border: "2px dashed #dee2e6" }}>
          <h3 style={{ color: "#6c757d", marginBottom: "10px" }}>No Courses Found</h3>
          <p style={{ fontSize: "16px", color: "#6c757d" }}>
            {filter === "all" ? "You don't have any assigned courses yet." : `No ${filter} courses found in your assignments.`}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
            {filteredCourses.map((course, index) => (
              <div key={`${course.courseCode}-${course.sectionName}-${index}`} style={getCardStyle(course.teachingStatus)}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0px 6px 16px rgba(0,0,0,0.15)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0px 2px 8px rgba(0,0,0,0.1)"; }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div>
                    <h4 style={{ margin: "0 0 5px 0", color: "#2c3e50", fontSize: "16px" }}>{course.courseCode}</h4>
                    <h3 style={{ margin: "0", color: "#34495e", fontSize: "18px" }}>{course.courseName}</h3>
                  </div>
                  {getStatusBadge(course.teachingStatus)}
                </div>

                <div style={{ lineHeight: "1.6" }}>
                  <p style={{ margin: "8px 0" }}><strong>Batch:</strong> {course.batchName}</p>
                  <p style={{ margin: "8px 0" }}><strong>Section:</strong> {course.sectionName} | <strong>Semester:</strong> {course.semester}</p>
                  <p style={{ margin: "8px 0" }}><strong>Credits:</strong> {course.creditHrs} hours</p>
                  <p style={{ margin: "8px 0" }}><strong>Department:</strong> {course.department}</p>

                  <div style={{ marginTop: "15px", paddingTop: "12px", borderTop: "1px solid #e9ecef", fontSize: "13px", color: "#6c757d" }}>
                    {course.completedAt && <p style={{ margin: "4px 0" }}><strong>Completed:</strong> {formatDate(course.completedAt)}</p>}
                    {course.removedAt && <p style={{ margin: "4px 0" }}><strong>Removed:</strong> {formatDate(course.removedAt)}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "30px", padding: "20px", backgroundColor: "#e8f5e8", borderRadius: "8px", textAlign: "center", border: "1px solid #c8e6c9" }}>
            <p style={{ margin: "0", fontWeight: "bold", fontSize: "16px", color: "#2e7d32" }}>
              Showing {filteredCourses.length} of {courses.length} total courses
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default FacultyCourses;
