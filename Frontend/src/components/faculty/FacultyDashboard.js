import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Card, Row, Col, Progress, List, Spin, Badge, Typography, Dropdown, Tag, Tooltip
} from "antd";
import {
  BellOutlined, UserOutlined, BookOutlined, CalendarOutlined,
  TrophyOutlined, TeamOutlined, CheckCircleOutlined, ClockCircleOutlined
} from "@ant-design/icons";
import { Bar } from "react-chartjs-2";
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from "chart.js";
import moment from "moment";
import "antd/dist/reset.css";
import "../../assets/Facultystyle.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, Legend);

const { Text, Title: AntTitle } = Typography;
const localizer = momentLocalizer(moment);

const FacultyDashboard = () => {
  const [facultyInfo, setFacultyInfo] = useState(null);
  const [courses, setCourses] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [todayClasses, setTodayClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bellVisible, setBellVisible] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [upcomingExams, setUpcomingExams] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const facultyUser = JSON.parse(localStorage.getItem("user") || "{}");
        const email = facultyUser?.universityEmail || facultyUser?.email;
        if (!email) return;

        // Fetch Courses
        const resCourses = await axios.get(
          "http://localhost:65000/api/faculty-courses/courses",
          { params: { universityEmail: email } }
        );
        if (resCourses.data.success) {
          setCourses(resCourses.data.courses || []);
          setFacultyInfo(resCourses.data.faculty);
        }

        // Fetch Today's Classes for Notifications
        const activeCourses = (resCourses.data.courses || []).filter(
          (c) => c.teachingStatus === "in-progress" && c.isActive
        );

        const today = new Date();
        const dayMap = {
          Sunday: 0,
          Monday: 1,
          Tuesday: 2,
          Wednesday: 3,
          Thursday: 4,
          Friday: 5,
          Saturday: 6,
        };

        const todayClassesArr = [];

        for (const course of activeCourses) {
          try {
            const resSlots = await axios.get(
              "http://localhost:65000/api/faculty-timetable/course-slots",
              {
                params: {
                  facultyId: facultyUser?._id,
                  courseCode: course.courseCode,
                  batchId: course.batchId,
                  sectionName: course.sectionName,
                },
              }
            );

            const timeSlots = resSlots.data.timeSlots || [];

            timeSlots.forEach((slot) => {
              const slotDayNum =
                dayMap[slot.day.charAt(0).toUpperCase() + slot.day.slice(1)];
              const currentDayNum = today.getDay();

              if (slotDayNum === currentDayNum) {
                todayClassesArr.push({
                  courseCode: course.courseCode,
                  courseName: course.courseName,
                  sectionName: course.sectionName,
                  batchName: course.batchName,
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                  room: slot.room,
                  day: slot.day,
                });
              }
            });
          } catch (err) {
            console.error("Failed to fetch slots for", course.courseCode);
          }
        }

        setTodayClasses(todayClassesArr);
        setNotifications(todayClassesArr); // Set notifications as today's classes

        // Fetch Exam Dates from Academic Calendar
        let allExams = [];

        for (const course of activeCourses) {
          try {
            const resCalendar = await axios.get(
              `http://localhost:65000/api/batches/${course.batchId}/calendar`
            );

            const academicCalendar = resCalendar.data.academicCalendar || [];
            
            academicCalendar.forEach((semester) => {
              // Add Midterm Exam if dates exist
              if (semester.midtermStart && semester.midtermEnd) {
                const midtermStart = new Date(semester.midtermStart);
                const midtermEnd = new Date(semester.midtermEnd);
                
                // Only show upcoming or current exams
                if (midtermEnd >= new Date()) {
                  allExams.push({
                    title: `Midterm Exam`,
                    start: midtermStart,
                    end: midtermEnd,
                    type: "midterm",
                    batchName: course.batchName,
                    sectionName: course.sectionName
                  });
                }
              }

              // Add Final Exam if dates exist
              if (semester.finalStart && semester.finalEnd) {
                const finalStart = new Date(semester.finalStart);
                const finalEnd = new Date(semester.finalEnd);
                
                // Only show upcoming or current exams
                if (finalEnd >= new Date()) {
                  allExams.push({
                    title: `Final Exam`,
                    start: finalStart,
                    end: finalEnd,
                    type: "final",
                    batchName: course.batchName,
                    sectionName: course.sectionName
                  });
                }
              }
            });
          } catch (err) {
            console.error("Failed to fetch calendar for course", course.courseCode, err);
          }
        }

        // Sort exams by start date (closest first)
        allExams.sort((a, b) => new Date(a.start) - new Date(b.start));
        
        // Take only the next 5 upcoming exams for Recent Activities
        setUpcomingExams(allExams.slice(0, 5));

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        setCalendarLoading(false);
      }
    };

    fetchData();
  }, []);

  const activeCourses = courses.filter((c) => c.teachingStatus === "in-progress" && c.isActive);
  const completedCourses = courses.filter((c) => c.teachingStatus === "completed");

  const capitalizeName = (name) => {
    if (!name) return "";
    return name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const getCourseCompletion = (course) => {
    if (course.teachingStatus === "completed") return 100;
    if (course.teachingStatus === "in-progress") return Math.floor(Math.random() * 40) + 60;
    return 0;
  };

  const getProgressColor = (percent) => {
    if (percent >= 90) return "#8a7aa8"; // darker purple
    if (percent >= 70) return "#9a8ab8"; // medium dark purple
    if (percent >= 50) return "#b2a4c2"; // base purple
    return "#c8bcd4"; // lighter purple
  };

  const getProgressStatus = (percent) => {
    if (percent >= 90) return "Excellent";
    if (percent >= 70) return "Good";
    if (percent >= 50) return "Average";
    return "Needs Attention";
  };

  const graphData = {
    labels: courses.map((c) => c.courseCode),
    datasets: [
      {
        label: "Completed",
        data: courses.map((c) => (c.teachingStatus === "completed" ? 100 : 0)),
        backgroundColor: "#8a7aa8",
        borderRadius: 6,
      },
      {
        label: "Active",
        data: courses.map((c) => (c.teachingStatus === "in-progress" ? 60 : 0)),
        backgroundColor: "#b2a4c2",
        borderRadius: 6,
      },
      {
        label: "Removed",
        data: courses.map((c) => (c.teachingStatus === "removed" ? 100 : 0)),
        backgroundColor: "#c8bcd4",
        borderRadius: 6,
      },
    ],
  };

  const graphOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
      tooltip: {
        callbacks: {
          label: (tooltipItem) => `${tooltipItem.dataset.label}: ${tooltipItem.raw}%`,
        },
      },
      title: { display: true, text: "Courses Overview", font: { size: 18 } },
    },
    scales: {
      y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + "%" } },
    },
  };

  const getExamTagColor = (examType) => {
    switch (examType) {
      case "midterm":
        return "#ffa940"; // orange for midterm
      case "final":
        return "#ff4d4f"; // red for final
      default:
        return "#8a7aa8";
    }
  };

  const getExamTagText = (examType) => {
    switch (examType) {
      case "midterm":
        return "Midterm";
      case "final":
        return "Final";
      default:
        return "Exam";
    }
  };

  if (loading)
    return <Spin size="large" style={{ display: "block", margin: "50px auto" }} />;

  return (
    <div style={{ padding: 25, background: "#f8f9fa", minHeight: "100vh" }}>
      {/* Header & Bell */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Text style={{ fontSize: 24, fontWeight: "bold", color: "#8a7aa8" }}>
            Faculty Dashboard
          </Text>
        </Col>
        <Col>
          <Dropdown
            overlay={
              <Card
                title={
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <BellOutlined style={{ color: "#8a7aa8" }} />
                    <span>Today's Classes</span>
                  </div>
                }
                style={{ width: 400, maxHeight: 500, overflow: "auto", background: "#ffffff" }}
                extra={<Badge count={notifications.length} style={{ backgroundColor: "#8a7aa8" }} />}
              >
                {notifications.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px", color: "#8c8c8c" }}>
                    <BellOutlined style={{ fontSize: 32, marginBottom: 8, color: "#d9d9d9" }} />
                    <div>No classes scheduled for today</div>
                  </div>
                ) : (
                  <List
                    dataSource={notifications}
                    renderItem={(item, index) => (
                      <List.Item 
                        style={{ 
                          borderBottom: "1px solid #f0f0f0", 
                          padding: "12px 0",
                          borderLeft: "4px solid #51cf66",
                          backgroundColor: "#f8f9fa",
                          marginBottom: 8,
                          borderRadius: 4
                        }}
                      >
                        <List.Item.Meta
                          title={
                            <Text strong style={{ color: "#595959", fontSize: 14 }}>
                              {item.courseCode} - {item.courseName}
                            </Text>
                          }
                          description={
                            <div>
                              <div style={{ marginBottom: 4 }}>
                                <Text style={{ color: "#8c8c8c", fontSize: 12 }}>
                                  <strong>Section:</strong> {item.sectionName} | <strong>Batch:</strong> {item.batchName}
                                </Text>
                              </div>
                              <div style={{ marginBottom: 4 }}>
                                <Text style={{ color: "#8c8c8c", fontSize: 12 }}>
                                  <strong>Time:</strong> {item.startTime} - {item.endTime}
                                </Text>
                              </div>
                              <div>
                                <Text style={{ color: "#8c8c8c", fontSize: 12 }}>
                                  <strong>Room:</strong> {item.room}
                                </Text>
                              </div>
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            }
            visible={bellVisible}
            onVisibleChange={(flag) => setBellVisible(flag)}
            placement="bottomRight"
            trigger={["click"]}
          >
            <Badge count={notifications.length} style={{ cursor: "pointer", backgroundColor: "#8a7aa8" }} size="small">
              <div
                style={{
                  padding: "12px",
                  backgroundColor: "#f0eaf5",
                  borderRadius: "50%",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(138, 122, 168, 0.3)",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#e6dcf0";
                  e.currentTarget.style.transform = "scale(1.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#f0eaf5";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <BellOutlined style={{ fontSize: 20, color: "#8a7aa8" }} />
              </div>
            </Badge>
          </Dropdown>
        </Col>
      </Row>

      {/* Welcome Card */}
      <Row justify="center" style={{ marginBottom: 20 }}>
        <Col xs={24}>
          <Card
            style={{
              borderRadius: 20,
              background: "linear-gradient(135deg, #9a8ab8 0%, #8a7aa8 100%)",
              color: "#fff",
              position: "relative",
              minHeight: 180,
              overflow: 'hidden',
              boxShadow: '0 8px 25px rgba(138, 122, 168, 0.4)',
              border: 'none',
            }}
            bodyStyle={{ padding: '30px' }}
          >
            <div 
              style={{
                position: 'absolute',
                top: -50,
                right: -50,
                width: 200,
                height: 200,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)'
              }}
            />
            <div 
              style={{
                position: 'absolute',
                bottom: -30,
                left: -30,
                width: 150,
                height: 150,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)'
              }}
            />
            
            <Row align="middle" justify="space-between" style={{ position: 'relative', zIndex: 1 }}>
              <Col xs={18}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                  <div 
                    style={{
                      padding: '16px',
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      borderRadius: '50%',
                      marginRight: 20,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  >
                    <UserOutlined style={{ fontSize: 28, color: "#fff" }} />
                  </div>
                  <div>
                    <h2 style={{ 
                      fontSize: 32, 
                      color: '#fff', 
                      margin: 0, 
                      fontWeight: '700',
                      textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                      Welcome back, {capitalizeName(facultyInfo?.name)}!
                    </h2>
                    <Text style={{ 
                      fontSize: 18, 
                      display: 'block', 
                      color: 'rgba(255,255,255,0.9)',
                      marginTop: 8
                    }}>
                      {facultyInfo?.designation}
                    </Text>
                  </div>
                </div>
                
                <Row gutter={[24, 16]} style={{ marginTop: 20 }}>
                  <Col>
                    <Tooltip title="Active Courses">
                      <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <BookOutlined style={{ fontSize: 20, marginRight: 12, color: 'rgba(255,255,255,0.9)' }} />
                        <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '500' }}>
                          {activeCourses.length} Active Courses
                        </Text>
                      </div>
                    </Tooltip>
                  </Col>
                  <Col>
                    <Tooltip title="Today's Date">
                      <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <CalendarOutlined style={{ fontSize: 20, marginRight: 12, color: 'rgba(255,255,255,0.9)' }} />
                        <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '500' }}>
                          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </Text>
                      </div>
                    </Tooltip>
                  </Col>
                  <Col>
                    <Tooltip title="Department">
                      <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <TrophyOutlined style={{ fontSize: 20, marginRight: 12, color: 'rgba(255,255,255,0.9)' }} />
                        <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '500' }}>
                          {facultyInfo?.department || 'Faculty Member'}
                        </Text>
                      </div>
                    </Tooltip>
                  </Col>
                </Row>
              </Col>
              
              <Col xs={6} style={{ textAlign: 'center' }}>
                <div 
                  style={{
                    padding: '20px',
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    borderRadius: '16px',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.2)'
                  }}
                >
                  <Tooltip title="Current Workload">
                    <TeamOutlined style={{ fontSize: 24, color: 'rgba(255,255,255,0.9)', marginBottom: 8 }} />
                  </Tooltip>
                  <Text style={{ 
                    fontSize: 14, 
                    color: 'rgba(255,255,255,0.9)',
                    display: 'block',
                    marginBottom: 8,
                    fontWeight: '500'
                  }}>
                    Workload
                  </Text>
                  <div style={{ 
                    fontSize: 32, 
                    fontWeight: 'bold', 
                    color: '#fff',
                    textShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}>
                    {facultyInfo?.currentWorkload || 0}
                  </div>
                  <Text style={{ 
                    fontSize: 12, 
                    color: 'rgba(255,255,255,0.8)'
                  }}>
                    Credits
                  </Text>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card
            style={{
              borderRadius: 12,
              textAlign: "center",
              background: "linear-gradient(135deg, #9a8ab8, #8a7aa8)",
              color: "white",
              boxShadow: "0 4px 12px rgba(138, 122, 168, 0.3)",
              border: "none",
            }}
          >
            <BookOutlined style={{ fontSize: 24, marginBottom: 8 }} />
            <Text style={{ color: "white", fontSize: 14, display: "block" }}>Active Courses</Text>
            <div style={{ fontSize: 28, fontWeight: "bold", margin: "8px 0" }}>
              {activeCourses.length}
            </div>
            <Text style={{ color: "white", fontSize: 12 }}>In Progress</Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            style={{
              borderRadius: 12,
              textAlign: "center",
              background: "linear-gradient(135deg, #b2a4c2, #9a8ab8)",
              color: "white",
              boxShadow: "0 4px 12px rgba(154, 138, 184, 0.3)",
              border: "none",
            }}
          >
            <CheckCircleOutlined style={{ fontSize: 24, marginBottom: 8 }} />
            <Text style={{ color: "white", fontSize: 14, display: "block" }}>Completion</Text>
            <div style={{ fontSize: 28, fontWeight: "bold", margin: "8px 0" }}>
              {activeCourses.length > 0
                ? Math.round(
                    activeCourses.reduce((sum, course) => sum + getCourseCompletion(course), 0) /
                      activeCourses.length
                  )
                : 0}
              %
            </div>
            <Text style={{ color: "white", fontSize: 12 }}>Average</Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            style={{
              borderRadius: 12,
              textAlign: "center",
              background: "linear-gradient(135deg, #8a7aa8, #7a6a98)",
              color: "white",
              boxShadow: "0 4px 12px rgba(122, 106, 152, 0.3)",
              border: "none",
            }}
          >
            <TeamOutlined style={{ fontSize: 24, marginBottom: 8 }} />
            <Text style={{ color: "white", fontSize: 14, display: "block" }}>Total Courses</Text>
            <div style={{ fontSize: 28, fontWeight: "bold", margin: "8px 0" }}>
              {courses.length}
            </div>
            <Text style={{ color: "white", fontSize: 12 }}>All Time</Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            style={{
              borderRadius: 12,
              textAlign: "center",
              background: "linear-gradient(135deg, #c8bcd4, #b2a4c2)",
              color: "#8a7aa8",
              boxShadow: "0 4px 12px rgba(178, 164, 194, 0.3)",
              border: "none",
            }}
          >
            <BellOutlined style={{ fontSize: 24, marginBottom: 8, color: "#8a7aa8" }} />
            <Text style={{ color: "#8a7aa8", fontSize: 14, display: "block" }}>Today's Classes</Text>
            <div style={{ fontSize: 28, fontWeight: "bold", margin: "8px 0", color: "#8a7aa8" }}>
              {notifications.length}
            </div>
            <Text style={{ color: "#8a7aa8", fontSize: 12 }}>Scheduled</Text>
          </Card>
        </Col>
      </Row>

      {/* Main Row */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          {/* Class Completion */}
          <Card
            title={
              <div style={{ display: "flex", alignItems: "center" }}>
                <ClockCircleOutlined style={{ fontSize: 20, color: "#8a7aa8", marginRight: 12 }} />
                <span style={{ color: "#8a7aa8", fontWeight: "600" }}>Class Completion Progress</span>
              </div>
            }
            bordered={false}
            style={{ 
              borderRadius: 16, 
              boxShadow: "0 4px 12px rgba(138, 122, 168, 0.15)", 
              marginBottom: 16,
              background: "#ffffff",
              border: "1px solid #f0f0f0"
            }}
          >
            {activeCourses.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <BookOutlined style={{ fontSize: 48, color: "#d9d9d9", marginBottom: 16 }} />
                <Text type="secondary" style={{ fontSize: 16 }}>
                  No active courses available
                </Text>
              </div>
            ) : (
              <Row gutter={[16, 16]}>
                {activeCourses.map((course, idx) => {
                  const completion = getCourseCompletion(course);
                  return (
                    <Col xs={24} sm={12} md={8} lg={6} key={idx}>
                      <Card
                        style={{
                          borderRadius: 12,
                          padding: 16,
                          textAlign: "center",
                          boxShadow: "0 4px 12px rgba(138, 122, 168, 0.1)",
                          background: "linear-gradient(135deg, #f8f9fa 0%, #e8e8e8 100%)",
                          border: "1px solid #e8e8e8",
                          height: "100%",
                          transition: "all 0.3s ease",
                          cursor: "pointer",
                        }}
                        bodyStyle={{ padding: "16px" }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-4px)";
                          e.currentTarget.style.boxShadow = "0 6px 16px rgba(138, 122, 168, 0.2)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "0 4px 12px rgba(138, 122, 168, 0.1)";
                        }}
                      >
                        <Text strong style={{ fontSize: 14, display: "block", marginBottom: 4, color: "#595959" }}>
                          {course.courseName}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12, display: "block", color: "#8c8c8c", marginBottom: 4 }}>
                          {course.courseCode}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11, display: "block", color: "#8a7aa8", marginBottom: 8 }}>
                          Batch: {course.batchName} | Section: {course.sectionName}
                        </Text>
                        <Progress
                          percent={completion}
                          strokeColor={getProgressColor(completion)}
                          format={() => `${completion}%`}
                          strokeWidth={12}
                          trailColor="#f0f0f0"
                          style={{ marginTop: 12 }}
                        />
                        <Text type="secondary" style={{ fontSize: 12, color: "#8c8c8c" }}>
                          {getProgressStatus(completion)}
                        </Text>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            )}
          </Card>

          {/* Course Overview */}
          <Card
            title={
              <div style={{ display: "flex", alignItems: "center" }}>
                <TrophyOutlined style={{ fontSize: 20, color: "#8a7aa8", marginRight: 12 }} />
                <span style={{ color: "#8a7aa8", fontWeight: "600" }}>Course Overview</span>
              </div>
            }
            bordered={false}
            style={{ 
              borderRadius: 16, 
              boxShadow: "0 4px 12px rgba(138, 122, 168, 0.15)", 
              marginBottom: 16,
              background: "#ffffff",
              border: "1px solid #f0f0f0"
            }}
          >
            <Bar data={graphData} options={graphOptions} />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          {/* Recent Activities - Now showing only Exam Dates */}
          <Card
            title={
              <div style={{ display: "flex", alignItems: "center" }}>
                <CalendarOutlined style={{ fontSize: 20, color: "#8a7aa8", marginRight: 12 }} />
                <span style={{ color: "#8a7aa8", fontWeight: "600" }}>Upcoming Exams</span>
              </div>
            }
            bordered={false}
            style={{ 
              borderRadius: 16, 
              boxShadow: "0 4px 12px rgba(138, 122, 168, 0.15)", 
              marginBottom: 16,
              background: "#ffffff",
              border: "1px solid #f0f0f0"
            }}
          >
            {upcomingExams.length === 0 ? (
              <Text type="secondary" style={{ color: "#8c8c8c" }}>No upcoming exams scheduled.</Text>
            ) : (
              <List
                itemLayout="horizontal"
                dataSource={upcomingExams}
                renderItem={(exam) => (
                  <List.Item style={{ borderBottom: "1px solid #f0f0f0", padding: "12px 0" }}>
                    <List.Item.Meta
                      title={
                        <Text strong style={{ color: "#595959", fontSize: 14 }}>
                          {exam.title}
                        </Text>
                      }
                      description={
                        <div>
                          <div style={{ marginBottom: 4 }}>
                            <Text style={{ color: "#8c8c8c", fontSize: 12 }}>
                              <strong>Batch:</strong> {exam.batchName} | <strong>Section:</strong> {exam.sectionName}
                            </Text>
                          </div>
                          <div>
                            <Text style={{ color: "#8c8c8c", fontSize: 12 }}>
                              <strong>Date:</strong> {moment(exam.start).format("MMM D, YYYY")} - {moment(exam.end).format("MMM D, YYYY")}
                            </Text>
                          </div>
                        </div>
                      }
                    />
                    <Tag color={getExamTagColor(exam.type)} style={{ color: "white", fontWeight: "500" }}>
                      {getExamTagText(exam.type)}
                    </Tag>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default FacultyDashboard;