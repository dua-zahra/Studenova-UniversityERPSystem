import React, { useEffect, useState } from "react";
import axios from "axios";
import { Spin, message, Card, Select, Button, Popover, Badge } from "antd";
import { ToastContainer } from "react-toastify";
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-toastify/dist/ReactToastify.css';
import "../../assets/style.css";
import API_URL from '../../config';

import { 
  CalendarOutlined, 
  FilterOutlined, 
  DownloadOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  MoreOutlined
} from '@ant-design/icons';

const { Option } = Select;
const localizer = momentLocalizer(moment);

function FacultySchedulePage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [selectedView, setSelectedView] = useState('agenda'); 
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [currentDate, setCurrentDate] = useState(new Date());

  const facultyUser = JSON.parse(localStorage.getItem("user") || "{}");
  const facultyId = facultyUser?._id;

  const getCourseColor = (courseCode) => {
    const colorMap = {
      'CSE': '#1890ff',
      'EEE': '#52c41a',
      'ECE': '#722ed1',
      'ME': '#fa8c16',
      'CE': '#f5222d',
      'MAT': '#13c2c2',
      'PHY': '#eb2f96',
      'CHE': '#faad14',
      'BIO': '#a0d911',
      'ENG': '#2f54eb',
      'COM': '#eb2f96',
      'BUS': '#722ed1'
    };
    
    const prefix = courseCode.substring(0, 3).toUpperCase();
    return colorMap[prefix] || '#8c8c8c';
  };

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const facultyEmail = facultyUser?.email || facultyUser?.universityEmail;
        if (!facultyEmail) {
          setCourses([]);
          setLoading(false);
          return;
        }

        const resCourses = await axios.get(
          `${API_URL}/api/faculty-courses/courses`,
          { params: { universityEmail: facultyEmail } }
        );

        const activeCourses = (resCourses.data.courses || []).filter(
          (c) => c.teachingStatus === "in-progress" && c.isActive
        );

        // Fetch course slots
        for (const course of activeCourses) {
          try {
            const resSlots = await axios.get(
              `${API_URL}/api/faculty-timetable/course-slots`,
              {
                params: {
                  facultyId,
                  courseCode: course.courseCode,
                  batchId: course.batchId,
                  sectionName: course.sectionName,
                },
              }
            );
            course.timeSlots = resSlots.data.timeSlots || [];
          } catch {
            course.timeSlots = [];
          }
        }

        setCourses(activeCourses);
      } catch (err) {
        console.error(err);
        message.error("Failed to load courses");
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [facultyId]);

  useEffect(() => {
    if (!courses.length) return;

    const generatedEvents = [];
    const dayMap = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };

    courses.forEach((course) => {
      if (!course.timeSlots || !course.semesterStartDate || !course.semesterEndDate)
        return;

      course.timeSlots.forEach((slot) => {
        const dayName = slot.day.charAt(0).toUpperCase() + slot.day.slice(1);
        const dayNum = dayMap[dayName];
        if (typeof dayNum !== 'number') return;

        const startDate = new Date(course.semesterStartDate);
        const endDate = new Date(course.semesterEndDate);
        let currentDate = new Date(startDate);

        while (currentDate.getDay() !== dayNum && currentDate <= endDate) {
          currentDate.setDate(currentDate.getDate() + 1);
        }

        while (currentDate <= endDate) {
          const eventDate = new Date(currentDate);
          
          const [startHour, startMinute] = slot.startTime.split(':').map(Number);
          const [endHour, endMinute] = slot.endTime.split(':').map(Number);
          
          const eventStart = new Date(eventDate);
          eventStart.setHours(startHour, startMinute, 0);
          
          const eventEnd = new Date(eventDate);
          eventEnd.setHours(endHour, endMinute, 0);

          const eventColor = getCourseColor(course.courseCode);

          generatedEvents.push({
            id: `${course.courseCode}-${slot.day}-${eventDate.toISOString()}`,
            title: `${course.courseCode}`,
            start: eventStart,
            end: eventEnd,
            courseCode: course.courseCode,
            courseName: course.courseName,
            sectionName: course.sectionName,
            room: slot.room,
            timeSlot: `${slot.startTime} - ${slot.endTime}`,
            allDay: false,
            color: eventColor,
            type: 'class'
          });

          currentDate.setDate(currentDate.getDate() + 7);
        }
      });
    });

    setEvents(generatedEvents);
  }, [courses]);

  const filteredEvents = selectedCourse === 'all' 
    ? events 
    : events.filter(event => event.courseCode === selectedCourse);

  const EventComponent = ({ event }) => {
    return (
      <div className="rbc-event-content" style={{
        padding: '2px 4px',
        height: '100%',
        overflow: 'hidden',
        fontSize: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: event.color,
          flexShrink: 0
        }} />
        <div style={{
          fontWeight: '500',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: '#333'
        }}>
          {event.courseCode}
        </div>
      </div>
    );
  };

  const MonthEventWrapper = ({ event, children }) => {
    const popoverContent = (
      <div className="event-popover-content">
        <div className="event-popover-header" style={{ 
          color: event.color,
          fontWeight: '600',
          marginBottom: '8px',
          fontSize: '14px'
        }}>
          {event.courseCode} - {event.sectionName}
        </div>
        <div className="event-popover-details">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <ClockCircleOutlined style={{ fontSize: '12px' }} />
            <span style={{ fontSize: '12px' }}>{event.timeSlot}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <EnvironmentOutlined style={{ fontSize: '12px' }} />
            <span style={{ fontSize: '12px' }}>Room: {event.room}</span>
          </div>
          <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
            {event.courseName}
          </div>
        </div>
      </div>
    );

    return (
      <Popover content={popoverContent} title={null} trigger="hover" placement="top">
        {children}
      </Popover>
    );
  };

  const DetailedEventComponent = ({ event }) => {
    return (
      <div className="rbc-event-content" style={{
        padding: '8px',
        height: '100%',
        overflow: 'hidden',
        borderLeft: `4px solid ${event.color}`,
        backgroundColor: `${event.color}15`,
        borderRadius: '4px'
      }}>
        <div style={{
          fontWeight: '600',
          fontSize: '12px',
          marginBottom: '4px',
          color: '#333'
        }}>
          {event.courseCode} ({event.sectionName})
        </div>
        <div style={{
          fontSize: '11px',
          color: '#666',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          marginBottom: '2px'
        }}>
          <ClockCircleOutlined style={{ fontSize: '10px' }} />
          {event.timeSlot}
        </div>
        <div style={{
          fontSize: '11px',
          color: '#666',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <EnvironmentOutlined style={{ fontSize: '10px' }} />
          {event.room}
        </div>
      </div>
    );
  };

  const SlotWrapper = ({ children, value }) => {
    const dateStr = moment(value).format('YYYY-MM-DD');
    const dayEvents = filteredEvents.filter(event => 
      moment(event.start).format('YYYY-MM-DD') === dateStr
    );
    
    const visibleEvents = dayEvents.slice(0, 2); 
    const overflowCount = dayEvents.length - 2;

    return (
      <div style={{ height: '100%', position: 'relative' }}>
        <div className="rbc-date-cell">
          <Badge 
            count={dayEvents.length} 
            size="small" 
            style={{ 
              backgroundColor: dayEvents.length > 0 ? '#1890ff' : '#d9d9d9',
              position: 'absolute',
              top: '4px',
              right: '4px'
            }}
          />
          {moment(value).date()}
        </div>
        <div style={{ 
          padding: '4px 2px',
          maxHeight: '70px',
          overflow: 'hidden'
        }}>
          {children}
          {overflowCount > 0 && (
            <div style={{
              fontSize: '10px',
              color: '#1890ff',
              textAlign: 'center',
              padding: '2px',
              cursor: 'pointer',
              backgroundColor: '#e6f7ff',
              borderRadius: '2px',
              marginTop: '2px'
            }}>
              <MoreOutlined /> +{overflowCount} more
            </div>
          )}
        </div>
      </div>
    );
  };

  const CustomToolbar = (toolbar) => {
    const goToToday = () => {
      toolbar.onNavigate('TODAY');
      setCurrentDate(new Date());
    };

    const goToBack = () => {
      toolbar.onNavigate('PREV');
      setCurrentDate(moment(currentDate).subtract(1, toolbar.view === 'month' ? 'month' : 'week').toDate());
    };

    const goToNext = () => {
      toolbar.onNavigate('NEXT');
      setCurrentDate(moment(currentDate).add(1, toolbar.view === 'month' ? 'month' : 'week').toDate());
    };

    return (
      <div className="rbc-toolbar">
        <div className="rbc-btn-group">
          <Button type="primary" onClick={goToToday} size="small">
            Today
          </Button>
          <Button onClick={goToBack} size="small">
            ‹
          </Button>
          <Button onClick={goToNext} size="small">
            ›
          </Button>
        </div>
        
        <span className="rbc-toolbar-label">
          {toolbar.label}
        </span>
        
        <div className="rbc-btn-group">
          <Button 
            type={toolbar.view === 'month' ? 'primary' : 'default'} 
            onClick={() => toolbar.onView('month')}
            size="small"
          >
            Month
          </Button>
          <Button 
            type={toolbar.view === 'week' ? 'primary' : 'default'} 
            onClick={() => toolbar.onView('week')}
            size="small"
          >
            Week
          </Button>
          <Button 
            type={toolbar.view === 'day' ? 'primary' : 'default'} 
            onClick={() => toolbar.onView('day')}
            size="small"
          >
            Day
          </Button>
          <Button 
            type={toolbar.view === 'agenda' ? 'primary' : 'default'} 
            onClick={() => toolbar.onView('agenda')}
            size="small"
          >
            Agenda
          </Button>
        </div>
      </div>
    );
  };

  const components = {
    toolbar: CustomToolbar,
    month: {
      event: (props) => (
        <MonthEventWrapper event={props.event}>
          <EventComponent {...props} />
        </MonthEventWrapper>
      ),
      dateCellWrapper: SlotWrapper
    },
    week: {
      event: DetailedEventComponent
    },
    day: {
      event: DetailedEventComponent
    },
    agenda: {
      event: DetailedEventComponent
    }
  };

  const exportSchedule = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Course Code,Course Name,Section,Date,Time,Room\n"
      + filteredEvents.map(e => 
          `"${e.courseCode}","${e.courseName}","${e.sectionName}","${moment(e.start).format('YYYY-MM-DD')}","${e.timeSlot}","${e.room}"`
        ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `schedule_${moment().format('YYYY-MM-DD')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    message.success('Schedule exported successfully!');
  };

  const uniqueCourseCodes = Array.from(new Set(courses.map(c => c.courseCode)));

  return (
    <div className="add-batch container mt-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center">
          <h2 className="add-batch-title mb-0">
            Faculty Class Schedule
          </h2>
        </div>
        <div className="d-flex align-items-center gap-2">
          <Button 
            type="primary" 
            icon={<DownloadOutlined />} 
            onClick={exportSchedule}
            size="small"
          >
            Export
          </Button>
        </div>
      </div>
      
      {/* Filters */}
      <Card className="mb-3 filter-card">
        <div className="row align-items-center">
          <div className="col-md-6">
            <div className="d-flex align-items-center">
              <FilterOutlined style={{ marginRight: '8px', color: '#666' }} />
              <span className="filter-label">Filter by Course:</span>
              <Select
                value={selectedCourse}
                onChange={setSelectedCourse}
                style={{ width: 200, marginLeft: '12px' }}
                size="small"
                allowClear
              >
                <Option value="all">All Courses</Option>
                {uniqueCourseCodes.map(code => (
                  <Option key={code} value={code}>{code}</Option>
                ))}
              </Select>
            </div>
          </div>
          <div className="col-md-6 text-md-end">
            <div className="legend d-flex justify-content-md-end gap-3">
              {uniqueCourseCodes.slice(0, 4).map(course => (
                <div key={course} className="d-flex align-items-center">
                  <div 
                    className="legend-color" 
                    style={{ backgroundColor: getCourseColor(course) }}
                  />
                  <span className="legend-text">{course}</span>
                </div>
              ))}
              {uniqueCourseCodes.length > 4 && (
                <div className="d-flex align-items-center">
                  <span className="legend-text">+{uniqueCourseCodes.length - 4} more</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
       {/* Stats Card */}
      <div className="row mt-4">
        <div className="col-md-3">
          <Card className="stats-card">
            <div className="stats-content">
              <div className="stats-number">{courses.length}</div>
              <div className="stats-label">Total Courses</div>
            </div>
          </Card>
        </div>
        <div className="col-md-3">
          <Card className="stats-card">
            <div className="stats-content">
              <div className="stats-number">{events.length}</div>
              <div className="stats-label">Total Classes</div>
            </div>
          </Card>
        </div>
        <div className="col-md-3">
          <Card className="stats-card">
            <div className="stats-content">
              <div className="stats-number">
                {events.filter(e => moment(e.start).isSame(new Date(), 'day')).length}
              </div>
              <div className="stats-label">Today's Classes</div>
            </div>
          </Card>
        </div>
        <div className="col-md-3">
          <Card className="stats-card">
            <div className="stats-content">
              <div className="stats-number">
                {events.filter(e => moment(e.start).isAfter(new Date())).length}
              </div>
              <div className="stats-label">Upcoming Classes</div>
            </div>
          </Card>
        </div>
      </div>
      {/* Calendar */}
      <Card className="calendar-card">
        {loading ? (
          <div className="text-center py-5">
            <Spin size="large" />
            <p className="mt-3">Loading schedule...</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-5">
            <p>No active courses found for this semester.</p>
          </div>
        ) : (
          <div className="calendar-container" style={{ minHeight: '600px' }}>
            <Calendar
              localizer={localizer}
              events={filteredEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: selectedView === 'month' ? '650px' : '600px' }}
              views={['month', 'week', 'day', 'agenda']}
              view={selectedView}
              onView={setSelectedView}
              date={currentDate}
              onNavigate={setCurrentDate}
              components={components}
              eventPropGetter={(event) => ({
                style: {
                  backgroundColor: `${event.color}20`,
                  border: `1px solid ${event.color}`,
                  borderRadius: '3px',
                  padding: '0',
                  margin: '1px 2px'
                }
              })}
              messages={{
                today: 'Today',
                previous: 'Previous',
                next: 'Next',
                month: 'Month',
                week: 'Week',
                day: 'Day',
                agenda: 'Agenda',
                showMore: total => `+${total} more classes`
              }}
              popup
              onSelectSlot={(slotInfo) => {
                console.log('Selected slot:', slotInfo);
              }}
              onSelectEvent={(event) => {
                message.info(`${event.courseCode} - ${event.sectionName} at ${event.timeSlot}`);
              }}
            />
          </div>
        )}
      </Card>

     

      <ToastContainer position="top-right" />
      
      <style jsx>{`
        .calendar-card {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          border: 1px solid #e8e8e8;
        }
        
        .filter-card {
          background: #fafafa;
          border: 1px solid #e8e8e8;
        }
        
        .filter-label {
          font-weight: 500;
          color: #333;
        }
        
        .calendar-container {
          padding: 10px;
        }
        
        .legend {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }
        
        .legend-color {
          width: 12px;
          height: 12px;
          border-radius: 2px;
          margin-right: 6px;
        }
        
        .legend-text {
          font-size: 11px;
          color: #666;
        }
        
        .stats-card {
          text-align: center;
          border-radius: 8px;
          transition: transform 0.2s;
          height: 100%;
        }
        
        .stats-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .stats-content {
          padding: 16px;
        }
        
        .stats-number {
          font-size: 28px;
          font-weight: 700;
          color: #1890ff;
          margin-bottom: 8px;
        }
        
        .stats-label {
          font-size: 14px;
          color: #666;
        }
        
        .event-popover-content {
          min-width: 200px;
        }
        
        .event-popover-header {
          padding-bottom: 4px;
          border-bottom: 1px solid #f0f0f0;
        }
        
        .event-popover-details {
          padding-top: 4px;
        }
        
        @media (max-width: 768px) {
          .legend {
            justify-content: flex-start;
            margin-top: 12px;
          }
          
          .stats-card {
            margin-bottom: 12px;
          }
          
          .rbc-toolbar {
            flex-direction: column;
            gap: 12px;
          }
        }
      `}</style>
    </div>
  );
}

export default FacultySchedulePage;