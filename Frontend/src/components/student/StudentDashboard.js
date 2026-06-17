import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import API_URL from '../../config';
const api = axios.create({
  baseURL: `${API_URL}`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

const StudentDashboard = () => {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllSemesters, setShowAllSemesters] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/students/getStudentDashboard');
      setPayload(res.data);
      
      if (res.data.student) {
        const studentData = {
          _id: res.data.student._id,
          studentId: res.data.student.studentId || res.data.student.username,
          fullName: res.data.student.name?.fullName || 
                   res.data.student.fullName || 
                   `${res.data.student.firstName || ''} ${res.data.student.lastName || ''}`.trim(),
          universityEmail: res.data.student.universityEmail || res.data.student.email,
          role: 'student',
          profilePic: res.data.student.photoPath || null,
          department: res.data.student.department,
          section: res.data.student.section,
          currentSemester: res.data.student.currentSemester
        };
        
        localStorage.setItem('userInfo', JSON.stringify(studentData));
        
        if (studentData.studentId) {
          localStorage.setItem('studentId', studentData.studentId);
          sessionStorage.setItem('studentId', studentData.studentId);
        }
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loader-container">
        <Loader2 className="loader-icon" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-box">
        <h3>Error Loading Dashboard</h3>
        <p>{error}</p>
        <button onClick={loadDashboard}>Retry</button>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="no-data">
        <p>No data available. The server returned an empty response.</p>
        <button onClick={loadDashboard}>Retry Loading</button>
      </div>
    );
  }

  const { student, academicProgress } = payload;
  const current = academicProgress.currentSemesterDetails || {};
  const percentProgress = Math.min(
    100,
    Math.round((academicProgress.totalCreditsEarned / Math.max(1, academicProgress.totalCreditsRequired)) * 100)
  );

  const getPhotoUrl = () => {
    if (!student.photoPath) return null;
    if (student.photoPath.startsWith('http')) {
      return student.photoPath;
    }
    const cleanPath = student.photoPath.startsWith('/') ? student.photoPath.substring(1) : student.photoPath;
    return `http://localhost:65000/${cleanPath}`;
  };

  const photoUrl = getPhotoUrl();

  const handleImageError = (e) => {
    e.target.style.display = 'none';
    const initialElement = e.target.parentElement.querySelector('.initial');
    if (initialElement) {
      initialElement.style.display = 'flex';
    }
  };

  return (
    <div className="dashboard-root">
      {/* Dashboard Content - NO CHATBOT HERE */}
      <header className="top-header">
        <div className="student-left">
          <div className="avatar">
            {photoUrl ? (
              <img 
                src={photoUrl} 
                alt={student.name?.fullName || 'Student'} 
                onError={handleImageError} 
              />
            ) : null}
            <div className="initial" style={photoUrl ? { display: 'none' } : {}}>
              {student.name?.fullName ? student.name.fullName.charAt(0).toUpperCase() : 'S'}
            </div>
          </div>
          <div className="student-info">
            <h1>{student.name?.fullName || 'Student'}</h1>
            <div className="sub">
              <span className="student-id">{student.studentId}</span> • 
              <span className="dept">{student.departmentCode} {student.department}</span>
            </div>
            <div className="sub small">
              <span className="email">{student.universityEmail}</span> • 
              <span className="phone">{student.contactNumber}</span>
            </div>
            <div className="badge-container">
              <span className="badge">{student.degreeLevel}</span>
              <span className="badge">{student.section}</span>
              {student.scholarship?.isApplicant && (
                <span className="badge scholarship">Scholarship: {student.scholarship.percentage}%</span>
              )}
            </div>
          </div>
        </div>

        <div className="right-stats">
          <div className="stat">
            <div className="label">Cumulative GPA</div>
            <div className="value">{academicProgress.cumulativeGPA || '-'}</div>
          </div>
          <div className="stat">
            <div className="label">Total Credits</div>
            <div className="value">{academicProgress.totalCreditsEarned}/{academicProgress.totalCreditsRequired}</div>
          </div>
          <div className="stat">
            <div className="label">Progress</div>
            <div className="value">{academicProgress.completionPercentage || percentProgress}%</div>
          </div>
        </div>
      </header>

      <section className="summary-cards">
        <div className="card">
          <h3>Degree Progress</h3>
          <div className="progress-container">
            <div className="progress-line">
              <div className="fill" style={{ width: `${percentProgress}%` }} />
            </div>
            <div className="progress-text">
              <span>Completed {academicProgress.totalCreditsEarned} of {academicProgress.totalCreditsRequired} credits</span>
              <span className="progress-percent">{percentProgress}%</span>
            </div>
          </div>
          <div className="progress-details">
            <div className="detail-item">
              <span className="detail-label">Current CGPA:</span>
              <span className="detail-value">{academicProgress.cumulativeGPA || 'N/A'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Current Semester:</span>
              <span className="detail-value">#{academicProgress.currentSemester}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Current Semester (#{academicProgress.currentSemester})</h3>
          <div className="metric-row">
            <div className="metric">
              <div className="metric-label">Semester GPA</div>
              <div className="metric-value">{current.semesterGPA || '-'}</div>
            </div>
            <div className="metric">
              <div className="metric-label">Credits Attempted</div>
              <div className="metric-value">{current.creditsAttempted || 0}</div>
            </div>
            <div className="metric">
              <div className="metric-label">Credits Earned</div>
              <div className="metric-value">{current.creditsEarned || 0}</div>
            </div>
            <div className="metric">
              <div className="metric-label">Quality Points</div>
              <div className="metric-value">{current.qualityPoints || 0}</div>
            </div>
          </div>
          {current.startDate && (
            <div className="semester-period">
              <span className="period-label">Period:</span>
              <span className="period-value">
                {new Date(current.startDate).toLocaleDateString()} - {new Date(current.endDate).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        <div className="card quick-actions-card">
          <h3>Quick Actions</h3>
          <div className="action-buttons">
            <button onClick={() => setShowAllSemesters(s => !s)} className="btn toggle-btn">
              {showAllSemesters ? 'Hide' : 'Show'} All Semesters
            </button>
            <button onClick={loadDashboard} className="btn refresh-btn">
              Refresh Dashboard
            </button>
            <button 
              onClick={() => window.location.reload()} 
              className="btn reload-btn"
            >
              Reload Page
            </button>
          </div>
        </div>
      </section>

      <section className="courses-section">
        <div className="section-header">
          <h2>Enrolled Courses - Current Semester</h2>
          <span className="course-count">({(current.courses || []).length} courses)</span>
        </div>

        <div className="courses-grid">
          {(current.courses || []).length === 0 ? (
            <div className="no-courses">No courses enrolled for current semester.</div>
          ) : (
            (current.courses || []).map((c, idx) => (
              <div key={idx} className="course-card">
                <div className="course-top">
                  <div className="course-info">
                    <div className="course-code">{c.courseCode || '—'}</div>
                    <div className="course-name">{c.courseName || 'Untitled Course'}</div>
                    <div className="course-instructor">{c.instructor || 'Instructor not assigned'}</div>
                  </div>
                  <div className="course-meta">
                    <div className={`status ${(c.status || '').toLowerCase() || 'unknown'}`}>
                      {c.status || 'N/A'}
                    </div>
                    <div className="grade-display">
                      <span className="grade-label">Grade:</span>
                      <span className="grade-value">{c.grade || '-'}</span>
                    </div>
                  </div>
                </div>

                <div className="course-body">
                  <div className="course-details">
                    <div className="detail">
                      <span className="detail-label">Credits:</span>
                      <span className="detail-value">{c.creditsEarned || 0}</span>
                    </div>
                    <div className="detail">
                      <span className="detail-label">Credit Hours:</span>
                      <span className="detail-value">{c.creditHours || 'N/A'}</span>
                    </div>
                    <div className="detail">
                      <span className="detail-label">Section:</span>
                      <span className="detail-value">{c.section || 'N/A'}</span>
                    </div>
                  </div>
                  
                  {c.attendancePercentage !== undefined && (
                    <div className="attendance-container">
                      <div className="attendance-header">
                        <span>Attendance</span>
                        <span className="attendance-percent">{c.attendancePercentage}%</span>
                      </div>
                      <div className="attendance-bar">
                        <div 
                          className="att-fill" 
                          style={{ width: `${Math.min(100, c.attendancePercentage)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {showAllSemesters && academicProgress.allSemesters && academicProgress.allSemesters.length > 0 && (
        <section className="semesters-section">
          <h2>All Semesters</h2>
          <div className="sem-table">
            <div className="row header">
              <div>Semester</div>
              <div>Status</div>
              <div>GPA</div>
              <div>Credits</div>
              <div>Period</div>
              <div>Courses</div>
            </div>
            {academicProgress.allSemesters.map((s, i) => (
              <div key={i} className="row">
                <div className="sem-number">{s.semesterNumber}</div>
                <div className={`sem-status ${(s.status || '').toLowerCase()}`}>{s.status}</div>
                <div className="sem-gpa">{s.semesterGPA || '-'}</div>
                <div className="sem-credits">{s.creditsEarned || 0}/{s.creditsAttempted || 0}</div>
                <div className="sem-period">
                  {s.startDate ? (
                    <>
                      <div>{new Date(s.startDate).toLocaleDateString()}</div>
                      <div>to {new Date(s.endDate).toLocaleDateString()}</div>
                    </>
                  ) : '-'}
                </div>
                <div className="sem-courses">
                  {(s.courses || []).map((cc, idx) => (
                    <div key={idx} className="mini-course">
                      <strong>{cc.courseCode || 'N/A'}</strong> • {cc.courseName || 'Unnamed'} • {cc.grade || '-'}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <style>{`
        .dashboard-root { 
          padding: 28px; 
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif; 
          background: linear-gradient(135deg, #f3f6fb 0%, #eef2ff 100%); 
          color: #0f172a; 
          min-height: 100vh;
          animation: fadeIn 0.5s ease-out;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        /* Header styles */
        .top-header { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          gap: 20px; 
          margin-bottom: 30px;
          background: rgba(255, 255, 255, 0.9);
          padding: 20px;
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(15, 23, 42, 0.08);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .student-left { 
          display: flex; 
          gap: 20px; 
          align-items: center; 
          flex: 1;
        }
        
        .avatar { 
          width: 100px; 
          height: 100px; 
          border-radius: 16px; 
          overflow: hidden; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
          position: relative;
        }
        
        .avatar img { 
          width: 100%; 
          height: 100%; 
          object-fit: cover; 
        }
        
        .initial { 
          font-size: 42px; 
          font-weight: 700; 
          color: white; 
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
        }
        
        .student-info h1 { 
          margin: 0 0 8px 0; 
          font-size: 24px; 
          font-weight: 700;
          color: #1e293b;
        }
        
        .sub { 
          color: #475569; 
          margin-bottom: 6px;
          display: flex;
          gap: 8px;
          align-items: center;
        }
        
        .sub.small { 
          font-size: 13px; 
          color: #64748b; 
          margin-bottom: 12px;
        }
        
        .student-id {
          background: #eef2ff;
          padding: 4px 8px;
          border-radius: 6px;
          font-weight: 600;
          color: #3730a3;
        }
        
        .badge-container {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 8px;
        }
        
        .badge { 
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); 
          color: white; 
          padding: 6px 12px; 
          border-radius: 8px; 
          font-weight: 600; 
          font-size: 13px; 
          border: none;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
        }
        
        .badge.scholarship {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }
        
        /* Right stats */
        .right-stats { 
          display: flex; 
          gap: 16px; 
          align-items: center; 
        }
        
        .stat { 
          background: white; 
          padding: 16px 20px; 
          border-radius: 12px; 
          box-shadow: 0 6px 20px rgba(2, 6, 23, 0.08); 
          text-align: center; 
          min-width: 130px;
          border: 1px solid #e2e8f0;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .stat:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(2, 6, 23, 0.12);
        }
        
        .stat .label { 
          font-size: 12px; 
          color: #64748b; 
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        
        .stat .value { 
          font-weight: 700; 
          font-size: 24px; 
          color: #0f172a;
        }
        
        /* Summary cards */
        .summary-cards { 
          display: grid; 
          grid-template-columns: 1fr 1fr 320px; 
          gap: 20px; 
          margin-bottom: 30px; 
        }
        
        .card { 
          background: white; 
          padding: 20px; 
          border-radius: 16px; 
          box-shadow: 0 8px 32px rgba(2, 6, 23, 0.08); 
          border: 1px solid #e2e8f0;
          transition: transform 0.2s ease;
        }
        
        .card:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(2, 6, 23, 0.12);
        }
        
        .card h3 { 
          margin: 0 0 16px 0; 
          font-size: 18px;
          color: #1e293b;
        }
        
        .progress-container {
          margin-bottom: 16px;
        }
        
        .progress-line { 
          width: 100%; 
          height: 12px; 
          background: #f1f5f9; 
          border-radius: 999px; 
          overflow: hidden; 
          margin-bottom: 8px;
        }
        
        .progress-line .fill { 
          height: 100%; 
          background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%); 
          transition: width 1s ease-in-out; 
          border-radius: 999px; 
        }
        
        .progress-text {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
          color: #64748b;
        }
        
        .progress-percent {
          font-weight: 700;
          color: #3b82f6;
          font-size: 16px;
        }
        
        .progress-details {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
        }
        
        .detail-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        
        .detail-label {
          color: #64748b;
        }
        
        .detail-value {
          font-weight: 600;
          color: #0f172a;
        }
        
        /* Metric row */
        .metric-row { 
          display: grid; 
          grid-template-columns: repeat(2, 1fr); 
          gap: 16px; 
          margin-bottom: 16px; 
        }
        
        .metric { 
          text-align: center;
          padding: 12px;
          background: #f8fafc;
          border-radius: 10px;
        }
        
        .metric-label { 
          color: #64748b; 
          font-size: 12px; 
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .metric-value { 
          font-weight: 700; 
          font-size: 20px; 
          color: #0f172a;
        }
        
        .semester-period {
          display: flex;
          gap: 8px;
          align-items: center;
          font-size: 13px;
          color: #64748b;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
        }
        
        /* Quick actions */
        .quick-actions-card .action-buttons {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 16px;
        }
        
        .btn { 
          padding: 12px 16px; 
          border-radius: 10px; 
          border: none; 
          cursor: pointer; 
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .toggle-btn { 
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); 
          color: white; 
        }
        
        .refresh-btn { 
          background: #10b981; 
          color: white; 
        }
        
        .reload-btn { 
          background: #f59e0b; 
          color: white; 
        }
        
        /* Courses section */
        .courses-section {
          margin-bottom: 30px;
        }
        
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .section-header h2 { 
          margin: 0; 
          font-size: 20px;
          color: #1e293b;
        }
        
        .course-count {
          background: #eef2ff;
          color: #4f46e5;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
        }
        
        .courses-grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
          gap: 16px; 
        }
        
        .course-card { 
          background: white; 
          padding: 16px; 
          border-radius: 12px; 
          border: 1px solid #e2e8f0; 
          box-shadow: 0 4px 16px rgba(2, 6, 23, 0.04);
          transition: all 0.3s ease;
        }
        
        .course-card:hover {
          border-color: #3b82f6;
          box-shadow: 0 8px 24px rgba(59, 130, 246, 0.15);
          transform: translateY(-2px);
        }
        
        .course-top { 
          display: flex; 
          justify-content: space-between; 
          align-items: flex-start; 
          margin-bottom: 12px; 
        }
        
        .course-code { 
          font-weight: 700; 
          color: #0f172a; 
          font-size: 16px;
          margin-bottom: 4px;
        }
        
        .course-name { 
          color: #475569; 
          font-size: 14px;
          margin-bottom: 4px;
        }
        
        .course-instructor {
          color: #64748b;
          font-size: 12px;
        }
        
        .course-meta { 
          text-align: right; 
        }
        
        .status { 
          padding: 6px 10px; 
          border-radius: 8px; 
          font-size: 11px; 
          font-weight: 700; 
          display: inline-block;
          margin-bottom: 8px;
        }
        
        .status.completed { 
          background: #d1fae5; 
          color: #065f46; 
        }
        
        .status.enrolled { 
          background: #e0e7ff; 
          color: #3730a3; 
        }
        
        .status.dropped { 
          background: #fee2e2; 
          color: #991b1b; 
        }
        
        .status.withdrawn { 
          background: #fef3c7; 
          color: #92400e; 
        }
        
        .status.unknown { 
          background: #f1f5f9; 
          color: #475569; 
        }
        
        .grade-display {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }
        
        .grade-label {
          font-size: 11px;
          color: #64748b;
          margin-bottom: 2px;
        }
        
        .grade-value {
          font-weight: 800; 
          font-size: 18px;
          color: #0f172a;
        }
        
        .course-body {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
        }
        
        .course-details {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 12px;
        }
        
        .detail {
          display: flex;
          flex-direction: column;
        }
        
        .detail-label {
          font-size: 11px;
          color: #64748b;
          margin-bottom: 2px;
        }
        
        .detail-value {
          font-weight: 600;
          font-size: 14px;
          color: #0f172a;
        }
        
        .attendance-container {
          margin-top: 12px;
        }
        
        .attendance-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 12px;
          color: #475569;
        }
        
        .attendance-percent {
          font-weight: 700;
          color: #3b82f6;
        }
        
        .attendance-bar { 
          height: 8px; 
          background: #f1f5f9; 
          border-radius: 999px; 
          overflow: hidden; 
        }
        
        .att-fill { 
          height: 100%; 
          background: linear-gradient(90deg, #10b981 0%, #34d399 100%); 
          transition: width 0.9s ease;
          border-radius: 999px;
        }
        
        /* Semesters section */
        .semesters-section {
          margin-bottom: 30px;
          animation: slideUp 0.3s ease-out;
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .sem-table { 
          background: white; 
          padding: 16px; 
          border-radius: 12px; 
          margin-top: 12px; 
          box-shadow: 0 4px 16px rgba(2, 6, 23, 0.04);
          overflow: auto;
        }
        
        .row { 
          display: grid; 
          grid-template-columns: 80px 100px 80px 100px 200px 1fr; 
          gap: 12px; 
          padding: 12px; 
          align-items: center; 
          border-bottom: 1px solid #f1f5f9; 
        }
        
        .row:last-child {
          border-bottom: none;
        }
        
        .row.header { 
          font-weight: 700; 
          color: #0f172a; 
          background: #f8fafc; 
          border-bottom: 2px solid #e2e8f0; 
        }
        
        .sem-number, .sem-status, .sem-gpa, .sem-credits, .sem-period {
          font-size: 13px;
        }
        
        .sem-status.completed {
          color: #065f46;
          font-weight: 600;
        }
        
        .sem-status.enrolled {
          color: #3730a3;
          font-weight: 600;
        }
        
        .sem-period {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        .mini-course { 
          font-size: 12px; 
          color: #475569; 
          margin-bottom: 6px; 
          padding: 4px 8px;
          background: #f8fafc;
          border-radius: 6px;
        }
        
        /* No courses message */
        .no-courses {
          grid-column: 1 / -1;
          text-align: center;
          padding: 40px;
          background: white;
          border-radius: 12px;
          color: #64748b;
          font-size: 14px;
        }
        
        /* Loader */
        .loader-container { 
          height: 100vh; 
          display: flex; 
          flex-direction: column;
          align-items: center; 
          justify-content: center; 
          gap: 16px;
        }
        
        .loader-icon { 
          width: 56px; 
          height: 56px; 
          color: #2563eb; 
          animation: spin 1s linear infinite; 
        }
        
        @keyframes spin { 
          from { transform: rotate(0); } 
          to { transform: rotate(360deg); } 
        }
        
        /* Error box */
        .error-box { 
          padding: 30px; 
          border-radius: 16px; 
          background: white; 
          color: #991b1b;
          margin: 20px;
          text-align: center;
          box-shadow: 0 8px 32px rgba(153, 27, 27, 0.1);
          border: 1px solid #fecaca;
        }
        
        .error-box h3 {
          margin: 0 0 12px 0;
          color: #dc2626;
        }
        
        .error-box button {
          margin-top: 16px;
          padding: 10px 20px;
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }
        
        /* No data */
        .no-data {
          text-align: center;
          padding: 40px;
          color: #64748b;
        }
        
        .no-data button {
          margin-top: 16px;
          padding: 10px 20px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }
        
        /* Debug section */
        .debug-section {
          margin-top: 20px;
        }
        
        .debug-section details {
          background: #1e293b;
          color: #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
        }
        
        .debug-section summary {
          padding: 12px 16px;
          background: #334155;
          cursor: pointer;
          font-weight: 600;
        }
        
        .debug-section .raw { 
          max-height: 300px; 
          overflow: auto; 
          padding: 16px; 
          font-size: 12px;
          line-height: 1.5;
        }
        
        /* Responsive design */
        @media (max-width: 1200px) {
          .summary-cards {
            grid-template-columns: 1fr;
          }
          
          .metric-row {
            grid-template-columns: repeat(4, 1fr);
          }
        }
        
        @media (max-width: 768px) {
          .dashboard-root {
            padding: 16px;
          }
          
          .top-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }
          
          .right-stats {
            width: 100%;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
          }
          
          .stat {
            min-width: auto;
          }
          
          .courses-grid {
            grid-template-columns: 1fr;
          }
          
          .row {
            grid-template-columns: 1fr;
            gap: 8px;
          }
          
          .row > div {
            padding: 4px 0;
          }
        }
        
        @media (max-width: 480px) {
          .student-left {
            flex-direction: column;
            text-align: center;
            gap: 16px;
          }
          
          .avatar {
            width: 80px;
            height: 80px;
          }
          
          .badge-container {
            justify-content: center;
          }
          
          .right-stats {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          
          .summary-cards {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default StudentDashboard;