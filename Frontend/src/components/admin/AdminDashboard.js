import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-toastify/dist/ReactToastify.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import dashboardImg from '../../assets/dashboard.jpg';
import studentImg from '../../assets/student.webp';
import facultyImg from '../../assets/faculty.webp';
import departmentImg from '../../assets/departments.jpg';
import batchImg from '../../assets/batches.png';
import "../../assets/style.css";
import API_URL from '../../config';
const localizer = momentLocalizer(moment);

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    newStudents: 0,
    totalCourses: 0,
    totalDepartments: 0,
    totalBatches: 0,
    totalFaculty: 0
  });
  const [loading, setLoading] = useState(true);
  const [enrollmentData, setEnrollmentData] = useState([]);
  const [courseDistributionData, setCourseDistributionData] = useState([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [distributionLoading, setDistributionLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState([]);
  const [userRole, setUserRole] = useState('Admin');
  const [selectedDegree, setSelectedDegree] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [activeIndex, setActiveIndex] = useState(null);
  const [calendarData, setCalendarData] = useState({
    degreeLevels: [],
    departments: [],
    batches: [],
    selectedDegree: '',
    selectedDepartment: '',
    selectedBatch: '',
    calendarEvents: [],
    showCalendar: false
  });
  const [calendarLoading, setCalendarLoading] = useState(false);

  const COLORS = ['#E5BEB5', '#896C6C', '#D6A99D', '#715A5A', '#D8B4BA', '#B2A4A1'];

  useEffect(() => {
    fetchDashboardStats();
    fetchEnrollmentTrend();
    fetchCourseDistribution();
    fetchRecentActivities();
    fetchDegreeLevels();
  }, []);

  useEffect(() => {
    processChartData();
  }, [courseDistributionData, selectedDegree, selectedDepartment]);

  useEffect(() => {
    if (calendarData.selectedDegree) {
      fetchDepartments(calendarData.selectedDegree);
    }
  }, [calendarData.selectedDegree]);

  useEffect(() => {
    if (calendarData.selectedDepartment) {
      fetchBatches(calendarData.selectedDepartment);
    }
  }, [calendarData.selectedDepartment]);

  const processChartData = () => {
    if (!courseDistributionData.length) {
      setChartData([]);
      return;
    }

    if (selectedDepartment) {
      const deptData = courseDistributionData.find(
        item => item.degreeLevel === selectedDegree && item.department === selectedDepartment
      );
      
      if (deptData && deptData.semesterCounts) {
        const semesterData = Object.entries(deptData.semesterCounts)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .map(([semester, count]) => ({
            name: `Semester ${semester}`,
            value: count,
            fullName: `${deptData.department} - Semester ${semester}`
          }));
        setChartData(semesterData);
      }
    } else if (selectedDegree) {
      const degreeData = courseDistributionData.filter(item => item.degreeLevel === selectedDegree);
      const deptData = degreeData.map(item => ({
        name: item.department,
        value: item.totalCourses,
        fullName: `${item.department} (${item.degreeLevel})`,
        semesterCounts: item.semesterCounts
      }));
      setChartData(deptData);
    } else {
      const degreeLevels = {};
      courseDistributionData.forEach(item => {
        if (!degreeLevels[item.degreeLevel]) {
          degreeLevels[item.degreeLevel] = 0;
        }
        degreeLevels[item.degreeLevel] += item.totalCourses;
      });

      const degreeData = Object.entries(degreeLevels).map(([degree, count]) => ({
        name: degree,
        value: count,
        fullName: degree
      }));
      setChartData(degreeData);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      
      const [
        studentsRes, 
        coursesRes, 
        departmentsRes, 
        batchesRes, 
        facultyRes
      ] = await Promise.allSettled([
        axios.get(`${API_URL}/api/students/count`),
        axios.get(`${API_URL}/api/courses/count`),
        axios.get(`${API_URL}/api/departments/count`),
        axios.get(`${API_URL}/api/batches/count`),
        axios.get(`${API_URL}/api/faculty/count`)
      ]);

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentStudentsRes = await axios.get(`${API_URL}/api/students/recent/count`, {
        params: { enrolledAfter: thirtyDaysAgo.toISOString() }
      });

      const getCountFromResponse = (response) => {
        if (response.status === 'rejected') {
          console.error('API error:', response.reason);
          return 0;
        }
        
        const data = response.value.data;
        
        if (typeof data === 'number') {
          return data;
        } else if (typeof data === 'object' && data !== null) {
          if (typeof data.count === 'number') {
            return data.count;
          }
          const countKeys = ['total', 'totalCount', 'number', 'value'];
          for (const key of countKeys) {
            if (typeof data[key] === 'number') {
              return data[key];
            }
          }
        }
        
        return 0;
      };

      const statsData = {
        totalStudents: getCountFromResponse(studentsRes),
        newStudents: recentStudentsRes.data?.count || recentStudentsRes.data || 0,
        totalCourses: getCountFromResponse(coursesRes),
        totalDepartments: getCountFromResponse(departmentsRes),
        totalBatches: getCountFromResponse(batchesRes),
        totalFaculty: getCountFromResponse(facultyRes)
      };

      setStats(statsData);

    } catch (error) {
      console.error('Error in fetchDashboardStats:', error);
      toast.error('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchEnrollmentTrend = async () => {
    try {
      setTrendLoading(true);
      
      const response = await axios.get(`${API_URL}/api/students/enrollment-trend`);
      
      if (response.data.success) {
        setEnrollmentData(response.data.data);
      } else {
        throw new Error(response.data.message || 'Failed to fetch enrollment data');
      }
      
    } catch (error) {
      console.error('Error fetching enrollment trend:', error);
      toast.error('Failed to load enrollment trend data');
      setEnrollmentData([]);
    } finally {
      setTrendLoading(false);
    }
  };

  const fetchCourseDistribution = async () => {
    try {
      setDistributionLoading(true);
      
      const response = await axios.get(`${API_URL}/api/counts`);
      
      if (response.data.success) {
        setCourseDistributionData(response.data.data);
      } else {
        throw new Error(response.data.message || 'Failed to fetch course distribution data');
      }
      
    } catch (error) {
      console.error('Error fetching course distribution:', error);
      toast.error('Failed to load course distribution data');
      setCourseDistributionData([]);
    } finally {
      setDistributionLoading(false);
    }
  };

  const fetchRecentActivities = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/activities/recent`);
      
      if (response.data.success) {
        setRecentActivities(response.data.data);
      } else {
        throw new Error(response.data.message || 'Failed to fetch recent activities');
      }
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      setRecentActivities([]);
    }
  };

  const fetchDegreeLevels = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/degree-levels`);
      setCalendarData(prev => ({
        ...prev,
        degreeLevels: response.data
      }));
    } catch (error) {
      console.error('Error fetching degree levels:', error);
      toast.error('Failed to load degree levels');
    }
  };

  const fetchDepartments = async (degreeLevel) => {
    try {
      const response = await axios.get(`${API_URL}/api/departments/by-degree`, {
        params: { degreeLevel }
      });
      setCalendarData(prev => ({
        ...prev,
        departments: response.data.departments || [],
        batches: [],
        selectedBatch: '',
        calendarEvents: [],
        showCalendar: false
      }));
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Failed to load departments');
    }
  };

  const fetchBatches = async (departmentId) => {
    try {
      const degreeLevel = calendarData.selectedDegree;
      const response = await axios.get(`${API_URL}/api/batches`, {
        params: { department: departmentId, degreeLevel }
      });
      setCalendarData(prev => ({
        ...prev,
        batches: response.data.data || [],
        selectedBatch: '',
        calendarEvents: [],
        showCalendar: false
      }));
    } catch (error) {
      console.error('Error fetching batches:', error);
      toast.error('Failed to load batches');
    }
  };

  const fetchCalendar = async (batchId) => {
    try {
      setCalendarLoading(true);
      const response = await axios.get(`${API_URL}/api/batches/${batchId}/calendar`);
      
      const transformCalendarData = (academicCalendar) => {
        return academicCalendar.flatMap(semester => {
          const semesterEvents = [];
          
          semesterEvents.push({
            title: `${semester.name} Semester`,
            start: new Date(semester.startDate),
            end: new Date(semester.endDate),
            allDay: true,
            color: '#122b53',
            semester: semester.semester,
            type: 'semester'
          });
          
          if (semester.midtermStart && semester.midtermEnd) {
            semesterEvents.push({
              title: 'Midterm Exams',
              start: new Date(semester.midtermStart),
              end: new Date(semester.midtermEnd),
              allDay: true,
              color: '#800909',
              semester: semester.semester,
              type: 'exam'
            });
          }
          
          if (semester.finalStart && semester.finalEnd) {
            semesterEvents.push({
              title: 'Final Exams',
              start: new Date(semester.finalStart),
              end: new Date(semester.finalEnd),
              allDay: true,
              color: '#800909',
              semester: semester.semester,
              type: 'exam'
            });
          }
          
          // Breaks
          if (semester.breaks?.length > 0) {
            semester.breaks.forEach(brk => {
              semesterEvents.push({
                title: brk.name,
                start: new Date(brk.startDate),
                end: new Date(brk.endDate),
                allDay: true,
                color: '#054e36',
                semester: semester.semester,
                type: 'break'
              });
            });
          }
          
          return semesterEvents;
        });
      };

      const events = transformCalendarData(response.data.academicCalendar);
      
      setCalendarData(prev => ({
        ...prev,
        calendarEvents: events,
        showCalendar: true
      }));
    } catch (error) {
      console.error('Error fetching calendar:', error);
      toast.error('Failed to load calendar data');
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleCalendarChange = (field, value) => {
    setCalendarData(prev => ({
      ...prev,
      [field]: value,
      showCalendar: false,
      calendarEvents: []
    }));
  };

  const handleShowCalendar = () => {
    if (calendarData.selectedBatch) {
      fetchCalendar(calendarData.selectedBatch);
    }
  };

  const eventStyleGetter = (event) => {
    return {
      style: {
        backgroundColor: event.color,
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  const handleChartClick = (data, index) => {
    setActiveIndex(index);
    
    if (!selectedDegree) {
      setSelectedDegree(data.name);
      setSelectedDepartment(null);
    } else if (!selectedDepartment) {
      setSelectedDepartment(data.name);
    }
  };

  const handleBackButton = () => {
    if (selectedDepartment) {
      setSelectedDepartment(null);
    } else if (selectedDegree) {
      setSelectedDegree(null);
    }
  };

  const formatNumber = (num) => {
    return num ? num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "0";
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard container mt-5">
        <div className="dashboard-header">
          <h2 className="dashboard-title mb-0">DASHBOARD</h2>
          <div className="header-actions">
            <button className="btn-refresh" onClick={() => {
              setLoading(true);
              setTrendLoading(true);
              setDistributionLoading(true);
              fetchDashboardStats();
              fetchEnrollmentTrend();
              fetchCourseDistribution();
              fetchRecentActivities();
              setSelectedDegree(null);
              setSelectedDepartment(null);
            }}>
              Refresh Page
            </button>
          </div>
        </div>

        <div className="dashboard-content">
          <div className="top-section">
            <div className="welcome-chart-container">
              <div className="welcome-section">
                <div className="welcome-text">
                  <h2>Welcome, {userRole}</h2>
                  <p>Here's what's happening with your institution today.</p>
                </div>
                <div className="user-avatar">
                  <img src={dashboardImg} alt="Admin Avatar" />
                </div>
              </div>

              <div className="chart-container">
                <div className="chart-header">
                  <h3>Student Trend</h3>
                  {trendLoading && <div className="trend-spinner"></div>}
                </div>
                
                {enrollmentData.length > 0 ? (
                  <div className="line-chart-wrapper">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={enrollmentData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis />
                        <Tooltip />
                        <Line 
                          type="monotone" 
                          dataKey="count" 
                          stroke="url(#lineGradient)" 
                          strokeWidth={2}
                          activeDot={{ r: 8, fill: '#715A5A' }} 
                        />
                        <defs>
                          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#896C6C" />
                            <stop offset="100%" stopColor="#715A5A" />
                          </linearGradient>
                        </defs>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="no-data-message">
                    {trendLoading ? (
                      <p>Loading enrollment data...</p>
                    ) : (
                      <div>
                        <p>No enrollment data available</p>
                        <button 
                          className="btn-retry"
                          onClick={fetchEnrollmentTrend}
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="stats-cards">
              <div className="stats-row">
                <div className="stat-card">
                  <div className="stat-icon">
                    <img src={studentImg} alt="Students" className="stat-image" />
                  </div>
                  <div className="stat-content">
                    <h3>{formatNumber(stats.totalStudents)}</h3>
                    <p>Total Students</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">
                    <img src={facultyImg} alt="Faculty" className="stat-image" />
                  </div>
                  <div className="stat-content">
                    <h3>{formatNumber(stats.totalFaculty)}</h3>
                    <p>Total Faculty</p>
                  </div>
                </div>
              </div>

              <div className="stats-row">
                <div className="stat-card">
                  <div className="stat-icon">
                    <img src={departmentImg} alt="Departments" className="stat-image" />
                  </div>
                  <div className="stat-content">
                    <h3>{formatNumber(stats.totalDepartments)}</h3>
                    <p>Total Dept.</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">
                    <img src={batchImg} alt="Batches" className="stat-image" />
                  </div>
                  <div className="stat-content">
                    <h3>{formatNumber(stats.totalBatches)}</h3>
                    <p>Total Batches</p>
                  </div>
                </div>
              </div>

              <div className="stats-row">
                <div className="stat-card activity-card">
                  
                  <div className="stat-content">
                    <h3>Recent Activity</h3>
                    <div className="activity-preview">
                      {recentActivities.length > 0 ? (
                        <ul className="activity-preview-list">
                          {recentActivities.slice(0, 3).map((activity, index) => (
                            <li key={index} className="activity-preview-item">
                              <p>{activity.action}</p>
                              <span className="activity-time">{activity.time}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="no-activity">No recent activity</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bottom-section">
            <div className="academic-calendar-container">
              <div className="panel academic-calendar">
                <div className="panel-header">
                  <h3>Academic Calendar</h3>
                </div>
                <div className="panel-content">
                  <div className="calendar-controls">
                    <div className="calendar-selectors">
                      <select
                        value={calendarData.selectedDegree}
                        onChange={(e) => handleCalendarChange('selectedDegree', e.target.value)}
                        className="calendar-select"
                      >
                        <option value="">Select Degree</option>
                        {calendarData.degreeLevels.map(level => (
                          <option key={level} value={level}>
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </option>
                        ))}
                      </select>
                      
                      <select
                        value={calendarData.selectedDepartment}
                        onChange={(e) => handleCalendarChange('selectedDepartment', e.target.value)}
                        disabled={!calendarData.selectedDegree}
                        className="calendar-select"
                      >
                        <option value="">Select Department</option>
                        {calendarData.departments.map(dept => (
                          <option key={dept._id} value={dept._id}>
                            {dept.departmentName}
                          </option>
                        ))}
                      </select>
                      
                      <select
                        value={calendarData.selectedBatch}
                        onChange={(e) => handleCalendarChange('selectedBatch', e.target.value)}
                        disabled={!calendarData.selectedDepartment}
                        className="calendar-select"
                      >
                        <option value="">Select Batch</option>
                        {calendarData.batches.map(batch => (
                          <option key={batch._id} value={batch._id}>
                            {batch.batchName}
                          </option>
                        ))}
                      </select>
                      
                      <button
                        onClick={handleShowCalendar}
                        disabled={!calendarData.selectedBatch || calendarLoading}
                        className="calendar-view-btn"
                      >
                        {calendarLoading ? 'Loading...' : 'View Calendar'}
                      </button>
                    </div>
                  </div>
                  
                  {calendarData.showCalendar && calendarData.calendarEvents.length > 0 && (
                    <div className="mini-calendar-wrapper">
                      <Calendar
                        localizer={localizer}
                        events={calendarData.calendarEvents}
                        startAccessor="start"
                        endAccessor="end"
                        eventPropGetter={eventStyleGetter}
                        views={['month']}
                        defaultView="month"
                        style={{ height: 300 }}
                        toolbar={false}
                      />
                      <div className="calendar-legend">
                        <div className="legend-item">
                          <div className="legend-color" style={{backgroundColor: '#122b53'}}></div>
                          <span>Semester</span>
                        </div>
                        <div className="legend-item">
                          <div className="legend-color" style={{backgroundColor: '#800909'}}></div>
                          <span>Exams</span>
                        </div>
                        <div className="legend-item">
                          <div className="legend-color" style={{backgroundColor: '#054e36'}}></div>
                          <span>Break</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="course-distribution-container">
              <div className="panel course-distribution">
                <div className="panel-header">
                  <h3>Course Distribution</h3>
                  {(selectedDegree || selectedDepartment) && (
                    <button className="btn-back" onClick={handleBackButton}>
                      ← Back
                    </button>
                  )}
                  {distributionLoading && <div className="trend-spinner"></div>}
                </div>
                <div className="panel-content">
                  {chartData.length > 0 ? (
                    <div className="pie-chart-wrapper">
                      <ResponsiveContainer width="100%" height={400}>
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            onClick={handleChartClick}
                            activeIndex={activeIndex}
                            activeShape={{ 
                              fill: 'url(#activeGradient)',
                              filter: 'drop-shadow(0px 0px 5px rgba(0,0,0,0.3))'
                            }}
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value, name, props) => {
                              const fullName = props.payload.fullName || name;
                              return [`${value} courses`, fullName];
                            }}
                          />
                          <Legend />
                          <defs>
                            <linearGradient id="activeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#896C6C" />
                              <stop offset="100%" stopColor="#715A5A" />
                            </linearGradient>
                          </defs>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="chart-info">
                        {selectedDegree && !selectedDepartment && (
                          <p>Showing {selectedDegree} course distribution.<br></br>
                             Click to see semester breakdown.</p>
                        )}
                        {selectedDepartment && (
                          <p>Showing {selectedDepartment} course distribution in semsters for ({selectedDegree}).</p>
                        )}
                        {!selectedDegree && !selectedDepartment && (
                          <p>*Click on a degree to get details</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="no-data-message">
                      {distributionLoading ? (
                        <p>Loading course distribution data...</p>
                      ) : (
                        <div>
                          <p>No course data available</p>
                          <button 
                            className="btn-retry"
                            onClick={fetchCourseDistribution}
                          >
                            Retry
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default AdminDashboard;