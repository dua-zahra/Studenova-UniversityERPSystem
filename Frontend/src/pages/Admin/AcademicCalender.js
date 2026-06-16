import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import "../../assets/style.css";

const localizer = momentLocalizer(moment);

const apiService = {
  fetchDegreeLevels: async () => {
    const response = await axios.get('http://localhost:65000/api/degree-levels');
    return response.data;
  },
  fetchDepartments: async (degreeLevel) => {
    const response = await axios.get('http://localhost:65000/api/departments/by-degree', {
      params: { degreeLevel }
    });
    return response.data.departments || [];
  },
  fetchBatches: async (degreeLevel, department) => {
    const response = await axios.get('http://localhost:65000/api/batches', {
      params: { department, degreeLevel }
    });
    return response.data.data || [];
  },
  fetchCalendar: async (batchId) => {
    const response = await axios.get(`http://localhost:65000/api/batches/${batchId}/calendar`);
    return response.data;
  }
};

const EVENT_TYPES = {
  SEMESTER: {
    title: (name) => `${name} Semester`,
    color: '#122b53'
  },
  EXAM: {
    title: (type) => `${type} Exams`,
    color: '#800909'
  },
  BREAK: {
    title: (name) => name,
    color: '#054e36'
  }
};

// Default empty calendar data structure
const DEFAULT_CALENDAR_EVENTS = [
  {
    title: 'Academic Year 2024',
    start: new Date(2024, 0, 1),
    end: new Date(2024, 11, 31),
    allDay: true,
    color: '#f0f0f0',
    type: 'placeholder',
    isPlaceholder: true
  }
];

const AcademicCalendar = () => {
  const [formData, setFormData] = useState({
    degreeLevel: '',
    department: '',
    batch: ''
  });
  const [data, setData] = useState({
    degreeLevels: [],
    departments: [],
    batches: [],
    calendarEvents: DEFAULT_CALENDAR_EVENTS // Initialize with default events
  });
  const [batchInfo, setBatchInfo] = useState(null);
  const [loading, setLoading] = useState({
    degreeLevels: false,
    departments: false,
    batches: false,
    calendar: false
  });
  const [error, setError] = useState(null);
  const [showCalendar, setShowCalendar] = useState(true); // Always show calendar by default
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchDegreeLevels = async () => {
      try {
        setLoading(prev => ({ ...prev, degreeLevels: true }));
        const levels = await apiService.fetchDegreeLevels();
        setData(prev => ({ ...prev, degreeLevels: levels }));
      } catch (err) {
        setError('Failed to load degree levels');
        console.error('Error fetching degree levels:', err);
      } finally {
        setLoading(prev => ({ ...prev, degreeLevels: false }));
      }
    };
    fetchDegreeLevels();
  }, []);

  useEffect(() => {
    const fetchDepartments = async () => {
      if (!formData.degreeLevel) {
        setData(prev => ({ ...prev, departments: [], batches: [] }));
        setFormData(prev => ({ ...prev, department: '', batch: '' }));
        // Don't hide calendar, just reset to default
        setData(prev => ({ ...prev, calendarEvents: DEFAULT_CALENDAR_EVENTS }));
        setBatchInfo(null);
        return;
      }

      try {
        setLoading(prev => ({ ...prev, departments: true }));
        const departments = await apiService.fetchDepartments(formData.degreeLevel);
        setData(prev => ({ ...prev, departments, batches: [] }));
      } catch (err) {
        setError('Failed to load departments');
        console.error('Error fetching departments:', err);
        setData(prev => ({ ...prev, departments: [] }));
      } finally {
        setLoading(prev => ({ ...prev, departments: false }));
      }
    };
    fetchDepartments();
  }, [formData.degreeLevel]);

  useEffect(() => {
    const fetchBatches = async () => {
      if (!formData.department) {
        setData(prev => ({ ...prev, batches: [] }));
        setFormData(prev => ({ ...prev, batch: '' }));
        // Don't hide calendar, just reset to default
        setData(prev => ({ ...prev, calendarEvents: DEFAULT_CALENDAR_EVENTS }));
        setBatchInfo(null);
        return;
      }

      try {
        setLoading(prev => ({ ...prev, batches: true }));
        const batches = await apiService.fetchBatches(formData.degreeLevel, formData.department);
        setData(prev => ({ ...prev, batches }));
      } catch (err) {
        setError('Failed to load batches');
        console.error('Error fetching batches:', err);
        setData(prev => ({ ...prev, batches: [] }));
      } finally {
        setLoading(prev => ({ ...prev, batches: false }));
      }
    };
    fetchBatches();
  }, [formData.department]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Don't hide calendar on change, just reset to default events
    setData(prev => ({ ...prev, calendarEvents: DEFAULT_CALENDAR_EVENTS }));
    setBatchInfo(null);
    setError(null);
  };

  const transformCalendarData = (academicCalendar) => {
    return academicCalendar.flatMap(semester => {
      const semesterEvents = [];
      
      // Semester period
      semesterEvents.push({
        title: EVENT_TYPES.SEMESTER.title(semester.name),
        start: new Date(semester.startDate),
        end: new Date(semester.endDate),
        allDay: true,
        color: EVENT_TYPES.SEMESTER.color,
        semester: semester.semester,
        type: 'semester'
      });
      
      // Midterm exams
      if (semester.midtermStart && semester.midtermEnd) {
        semesterEvents.push({
          title: EVENT_TYPES.EXAM.title('Midterm'),
          start: new Date(semester.midtermStart),
          end: new Date(semester.midtermEnd),
          allDay: true,
          color: EVENT_TYPES.EXAM.color,
          semester: semester.semester,
          type: 'exam'
        });
      }
      
      // Final exams
      if (semester.finalStart && semester.finalEnd) {
        semesterEvents.push({
          title: EVENT_TYPES.EXAM.title('Final'),
          start: new Date(semester.finalStart),
          end: new Date(semester.finalEnd),
          allDay: true,
          color: EVENT_TYPES.EXAM.color,
          semester: semester.semester,
          type: 'exam'
        });
      }
      
      // Breaks
      if (semester.breaks?.length > 0) {
        semester.breaks.forEach(brk => {
          semesterEvents.push({
            title: EVENT_TYPES.BREAK.title(brk.name),
            start: new Date(brk.startDate),
            end: new Date(brk.endDate),
            allDay: true,
            color: EVENT_TYPES.BREAK.color,
            semester: semester.semester,
            type: 'break'
          });
        });
      }
      
      return semesterEvents;
    });
  };

  const handleShowCalendar = async () => {
    if (!formData.batch) {
      // If no batch selected, show default calendar
      setData(prev => ({ ...prev, calendarEvents: DEFAULT_CALENDAR_EVENTS }));
      setBatchInfo(null);
      setShowCalendar(true);
      return;
    }
    
    try {
      setLoading(prev => ({ ...prev, calendar: true }));
      setError(null);
      
      const calendarData = await apiService.fetchCalendar(formData.batch);
      const batchData = data.batches.find(b => b._id === formData.batch);
      
      setBatchInfo(batchData);
      setData(prev => ({
        ...prev,
        calendarEvents: transformCalendarData(calendarData.academicCalendar)
      }));
      setShowCalendar(true);
    } catch (err) {
      setError('Failed to load calendar data');
      console.error('Error fetching calendar:', err);
      // On error, show default calendar instead of empty
      setData(prev => ({ ...prev, calendarEvents: DEFAULT_CALENDAR_EVENTS }));
      setShowCalendar(true);
    } finally {
      setLoading(prev => ({ ...prev, calendar: false }));
    }
  };

  const eventStyleGetter = (event) => {
    const isPlaceholder = event.isPlaceholder;
    return {
      style: {
        backgroundColor: isPlaceholder ? '#f8f9fa' : event.color,
        borderRadius: '4px',
        opacity: isPlaceholder ? 0.6 : 0.8,
        color: isPlaceholder ? '#6c757d' : 'white',
        border: isPlaceholder ? '1px dashed #dee2e6' : '0px',
        display: 'block',
        fontStyle: isPlaceholder ? 'italic' : 'normal'
      }
    };
  };

  const formatDate = (date) => {
    return date ? moment(date).format('MMM D, YYYY') : 'Not scheduled';
  };

  const renderBatchInfoTable = () => {
    if (!batchInfo) {
      return (
        <div className="batch-info">
          <h2 className="batch-info-title">Academic Calendar Overview</h2>
          <div className="batch-info-table-responsive">
            <table className="batch-info-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Field</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="semester-info-row">
                  <td rowSpan={2}>Information</td>
                  <td>Status</td>
                  <td>Select a batch to view detailed calendar</td>
                </tr>
                <tr>
                  <td>Default View</td>
                  <td>Current Academic Year</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return (
      <div className="batch-info">
        <h2 className="batch-info-title">
          {batchInfo?.batchName || 'N/A'}
        </h2>

        <div className="batch-info-table-responsive">
          <table className="batch-info-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Field</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr className="semester-info-row">
                <td rowSpan={3}>Semester Information</td>
                <td>Semester Type</td>
                <td>{batchInfo?.semesterStart === 'fall' ? 'Fall' : 'Spring'}</td>
              </tr>
              <tr>
                <td>Total Semesters</td>
                <td>{batchInfo?.totalSemesters || 'N/A'}</td>
              </tr>
              <tr>
                <td>Current Semester</td>
                <td>{batchInfo?.currentSemester || 'N/A'}</td>
              </tr>

              <tr className="exam-info-row">
                <td rowSpan={2}>Exam Dates</td>
                <td>Midterm Exams</td>
                <td>
                  {formatDate(batchInfo?.academicCalendar?.[0]?.midtermStart)} -{' '}
                  {formatDate(batchInfo?.academicCalendar?.[0]?.midtermEnd)}
                </td>
              </tr>
              <tr>
                <td>Final Exams</td>
                <td>
                  {formatDate(batchInfo?.academicCalendar?.[0]?.finalStart)} -{' '}
                  {formatDate(batchInfo?.academicCalendar?.[0]?.finalEnd)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCalendarLegend = () => (
    <div className="calendar-legend">
      <div className="legend-item">
        <div className="legend-color semester"></div>
        <span>Semester Period</span>
      </div>
      <div className="legend-item">
        <div className="legend-color exam"></div>
        <span>Examination Period</span>
      </div>
      <div className="legend-item">
        <div className="legend-color break"></div>
        <span>Break/Vacation</span>
      </div>
      <div className="legend-item">
        <div className="legend-color placeholder"></div>
        <span>Default Calendar View</span>
      </div>
    </div>
  );

  return (
    <div className="academic-calendar container mt-5">
      <h2 className="academic-calendar-title">Academic Calendar</h2>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="degreeLevel">Degree Level</label>
          <select
            id="degreeLevel"
            name="degreeLevel"
            value={formData.degreeLevel}
            onChange={handleChange}
            disabled={loading.degreeLevels}
          >
            <option value="">Select Degree Level</option>
            {data.degreeLevels.map(level => (
              <option key={level} value={level}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="department">Department</label>
          <select
            id="department"
            name="department"
            value={formData.department}
            onChange={handleChange}
            disabled={!formData.degreeLevel || loading.departments}
          >
            <option value="">Select Department</option>
            {data.departments.map(dept => (
              <option key={dept._id} value={dept._id}>
                {isMobile ? dept.departmentCode : `${dept.departmentName} (${dept.departmentCode})`}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="batch">Batch</label>
          <select
            id="batch"
            name="batch"
            value={formData.batch}
            onChange={handleChange}
            disabled={!formData.department || loading.batches}
          >
            <option value="">Select Batch</option>
            {data.batches.map(batch => (
              <option key={batch._id} value={batch._id}>
                {isMobile ? `${batch.enrollmentYear}-${batch.graduationYear}` : 
                  `${batch.batchName} (${batch.enrollmentYear}-${batch.graduationYear})`}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group form-group-button">
          <button
            onClick={handleShowCalendar}
            disabled={loading.calendar} 
            className="submit-button"
          >
            {loading.calendar ? 'Loading...' : formData.batch ? 'Show Calendar' : 'View Default Calendar'}
          </button>
        </div>
      </div>

      {loading.calendar ? (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Loading calendar data...</p>
        </div>
      ) : showCalendar && (
        <>
          {renderBatchInfoTable()}
          
          <div className="calendar-container">
            <h2 className="calendar-title">
              {batchInfo ? 'CALENDAR VIEW' : 'DEFAULT ACADEMIC CALENDAR VIEW'}
            </h2>
            <div className="calendar-wrapper">
              <Calendar
                localizer={localizer}
                events={data.calendarEvents}
                startAccessor="start"
                endAccessor="end"
                eventPropGetter={eventStyleGetter}
                views={['month', 'week', 'day', 'agenda']}
                defaultView="month"
                toolbar={!isMobile}
                messages={{
                  noEventsInRange: batchInfo 
                    ? 'No events scheduled for this period' 
                    : 'Select a batch to view specific academic events'
                }}
              />
            </div>
            {renderCalendarLegend()}
          </div>
        </>
      )}
    </div>
  );
};

export default AcademicCalendar;