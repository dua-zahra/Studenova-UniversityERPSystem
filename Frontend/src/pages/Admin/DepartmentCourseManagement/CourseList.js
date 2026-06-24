import React, { useState, useEffect } from 'react';
import axiosInstance from '../../../axiosConfig';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import "../../../assets/style.css";
import API_URL from '../../../config';
const CourseList = () => {
  const [degreeLevel, setDegreeLevel] = useState('');
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState([]);
  const [degreeLevels, setDegreeLevels] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [courseData, setCourseData] = useState(null);
  
  useEffect(() => {
    const fetchDegreeLevels = async () => {
      try {
        const res = await axiosInstance.get(`${API_URL}/api/degree-levels`);
        setDegreeLevels(res.data);
      } catch (err) {
        console.error('Error fetching degree levels:', err);
        toast.error('Failed to load degree levels');
      }
    };

    fetchDegreeLevels();
  }, []);

  useEffect(() => {
    const fetchDepartments = async () => {
      if (!degreeLevel) {
        setDepartments([]);
        setDepartment('');
        return;
      }

      try {
        setIsLoading(true);
        const res = await axiosInstance.get(`${API_URL}/api/departments/by-degree`, {
          params: { degreeLevel }
        });
        setDepartments(res.data.departments || []);
      } catch (err) {
        console.error('Error fetching departments:', err);
        toast.error('Failed to fetch departments');
        setDepartments([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDepartments();
  }, [degreeLevel]);

  const handleDegreeChange = (e) => {
    setDegreeLevel(e.target.value);
    setDepartment('');
    setCourseData(null);
  };

  const handleDepartmentChange = (e) => {
    setDepartment(e.target.value);
  };

  const fetchCourses = async () => {
    if (!degreeLevel || !department) return;

    try {
      setIsLoading(true);
      const res = await axiosInstance.get(`${API_URL}/api/course-entries`, {
        params: { 
          degreeLevel, 
          department: department.trim() 
        }
      });

      if (res.data) {
        const sortedSemesters = res.data.semesters?.sort((a, b) => a.semesterNumber - b.semesterNumber) || [];
        setCourseData({
          ...res.data,
          semesters: sortedSemesters
        });
      } else {
        setCourseData(null);
        toast.error('No course data found');
      }
    } catch (err) {
      console.error('Error fetching courses:', err);
      toast.error(err.response?.data?.message || 'Failed to fetch courses');
      setCourseData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchCourses();
  };

  return (
    <div className="course-list container mt-5">
      <h2 className="course-list-title">Course List</h2>
      
      <form onSubmit={handleSubmit} className="course-list-form">
        <div className="form-row">
          <div className="form-group">
            <label>Degree Level</label>
            <select 
              value={degreeLevel} 
              onChange={handleDegreeChange} 
              required
            >
              <option value="">Select Degree Level</option>
              {degreeLevels.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Department</label>
            <select 
              value={department} 
              onChange={handleDepartmentChange} 
              required
              disabled={!degreeLevel || isLoading}
            >
              <option value="">{departments.length ? 'Select Department' : 'Select degree level first'}</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept.departmentName}>
                  {dept.departmentName}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <button type="submit"  className="submit-btn">
            Show Courses
            </button>
          </div>
        </div>
      </form>

      {courseData && courseData.semesters && courseData.semesters.length > 0 && (
        <div className="semester-tables">
          {courseData.semesters.map((semester) => (
            <div key={semester.semesterNumber} className="semester-table-container">
              <h3>Semester {semester.semesterNumber}</h3>
              <div className="table-responsive">
                <table className="course-table">
                  <thead>
                    <tr>
                      <th>Degree Level</th>
                      <th>Department Name</th>
                      <th>Dept Code</th>
                      <th>Course Name</th>
                      <th>Course Code</th>
                      <th>Credit Hrs</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {semester.courses.map((course, index) => (
                      <tr key={index}>
                        <td>{courseData.degreeLevel}</td>
                        <td>{courseData.department}</td>
                        <td>{courseData.departmentCode || 'N/A'}</td>
                        <td>{course.courseName}</td>
                        <td>{course.courseCode}</td>
                        <td>{course.creditHrs}</td>
                        <td>{course.type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {courseData && courseData.semesters && courseData.semesters.length === 0 && (
        <p className="no-courses-message">No courses found for the selected department.</p>
      )}

      <ToastContainer />
    </div>
  );
};

export default CourseList;