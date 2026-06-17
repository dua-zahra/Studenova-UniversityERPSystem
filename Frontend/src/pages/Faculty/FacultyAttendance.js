import React, { useEffect, useState } from "react";
import axios from "axios";
import { Table, Button, Spin, message, Select, Card, Row, Col, Tag, Modal, Statistic } from "antd";
import "antd/dist/reset.css";
import { format, addDays } from "date-fns";
import { 
  TeamOutlined, 
  CalendarOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  SaveOutlined,
  BookOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined
} from "@ant-design/icons";
import API_URL from '../../../config';

const { Option } = Select;

function FacultyAttendancePage() {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [students, setStudents] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [stats, setStats] = useState({ present: 0, absent: 0, total: 0, percentage: 0 });
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);

  const facultyUser = JSON.parse(localStorage.getItem("user") || "{}");
  const facultyId = facultyUser?._id;

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const facultyEmail = facultyUser?.email || facultyUser?.universityEmail;
        if (!facultyEmail) {
          setCourses([]);
          setLoadingCourses(false);
          return;
        }

        const resCourses = await axios.get(
          `${API_URL}/api/faculty-courses/courses`,
          { params: { universityEmail: facultyEmail } }
        );

        const activeCourses = (resCourses.data.courses || []).filter(
          (c) => c.teachingStatus === "in-progress" && c.isActive
        );

        for (const course of activeCourses) {
          try {
            const resStudents = await axios.get(
              `${API_URL}/api/students/by-course/${encodeURIComponent(
                course.courseCode
              )}`,
              {
                params: {
                  section: course.sectionName,
                  batchId: course.batchId || "",
                  batchName: course.batchName || "",
                },
              }
            );
            course.totalStudents = resStudents.data.students?.length || 0;
          } catch {
            course.totalStudents = 0;
          }

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
        setLoadingCourses(false);
      }
    };

    fetchCourses();
  }, [facultyId]);

  const generateClassDates = (course) => {
    const dates = [];
    const dayMap = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };

    if (!course.timeSlots || !course.semesterStartDate || !course.semesterEndDate)
      return dates;

    course.timeSlots.forEach((slot) => {
      const dayName = slot.day.charAt(0).toUpperCase() + slot.day.slice(1);
      const dayNum = dayMap[dayName];
      if (typeof dayNum !== "number") return;

      let current = new Date(course.semesterStartDate);
      const end = new Date(course.semesterEndDate);

      while (current <= end) {
        if (current.getDay() === dayNum) dates.push(new Date(current));
        current = addDays(current, 1);
      }
    });

    const uniq = Array.from(new Set(dates.map((d) => d.toISOString()))).map(
      (s) => new Date(s)
    );
    uniq.sort((a, b) => a - b);
    return uniq;
  };

  const calculateStats = (studentsList) => {
    const present = studentsList.filter(s => s.attendance === "Present").length;
    const total = studentsList.length;
    const absent = total - present;
    const percentage = total > 0 ? (present / total) * 100 : 0;
    
    setStats({ present, absent, total, percentage: Math.round(percentage) });
  };

  const fetchStudents = async (course, date = null) => {
    try {
      console.log("Fetching students for:", course.courseCode);
      setSelectedCourse(course);
      setLoadingStudents(true);

      const classDates = generateClassDates(course);
      setAvailableDates(classDates);

      const selectedClassDate = date || classDates[0] || null;
      setSelectedDate(selectedClassDate);

      const res = await axios.get(
        `${API_URL}/api/students/by-course/${encodeURIComponent(
          course.courseCode
        )}`,
        {
          params: {
            section: course.sectionName,
            batchId: course.batchId || "",
            batchName: course.batchName || "",
          },
        }
      );

      let studentsWithAttendance = (res.data.students || []).map((s) => ({
        ...s,
        fullName: s.fullName || `${s.firstName || ""} ${s.lastName || ""}`.trim(),
        attendance: "Absent",
        percentage: s.percentage || 0,
      }));

      console.log("Students fetched:", studentsWithAttendance.length);

      if (selectedClassDate) {
        try {
          const resAttendance = await axios.get(
            `${API_URL}/api/attendance/by-date`,
            {
              params: {
                courseCode: course.courseCode,
                batchId: course.batchId || "",
                batchName: course.batchName || "",
                sectionName: course.sectionName,
                semester: course.semester,
                date: format(selectedClassDate, "yyyy-MM-dd"),
              },
            }
          );

          console.log(" Attendance API Response:", resAttendance.data);

          let existingAttendance = [];
          if (resAttendance?.data) {
            if (Array.isArray(resAttendance.data.students)) {
              existingAttendance = resAttendance.data.students;
            } else if (Array.isArray(resAttendance.data.data?.students)) {
              existingAttendance = resAttendance.data.data.students;
            }
          }

          console.log("✅ Attendance students length:", existingAttendance.length);

          studentsWithAttendance = studentsWithAttendance.map((s) => {
            const att =
              existingAttendance.find(
                (a) =>
                  a.studentId === s.studentId ||
                  a._id === s.studentId ||
                  a.student?._id === s.studentId
              ) || {};
            return {
              ...s,
              attendance: att.attendance || att.status || s.attendance,
              percentage: att.percentage || s.percentage,
            };
          });
        } catch (err) {
          console.error("Attendance fetch error:", err?.message || err);
        }
      }

      setStudents(studentsWithAttendance);
      calculateStats(studentsWithAttendance);
    } catch (err) {
      console.error(err);
      setStudents([]);
      message.error("Failed to load students for this course");
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleDateChange = (dateStr) => {
    const d = new Date(dateStr);
    setSelectedDate(d);
    if (selectedCourse) fetchStudents(selectedCourse, d);
  };

  const toggleAttendance = (studentId) => {
    setStudents((prev) => {
      const updatedStudents = prev.map((s) =>
        s.studentId === studentId
          ? { ...s, attendance: s.attendance === "Present" ? "Absent" : "Present" }
          : s
      );
      calculateStats(updatedStudents);
      return updatedStudents;
    });
  };

  const markAllPresent = () => {
    setStudents((prev) => {
      const updatedStudents = prev.map(s => ({ ...s, attendance: "Present" }));
      calculateStats(updatedStudents);
      return updatedStudents;
    });
  };

  const markAllAbsent = () => {
    setStudents((prev) => {
      const updatedStudents = prev.map(s => ({ ...s, attendance: "Absent" }));
      calculateStats(updatedStudents);
      return updatedStudents;
    });
  };

  const saveAttendance = async () => {
    if (!selectedDate) return message.error("Please select a date");
    if (!selectedCourse) return message.error("No course selected");

    try {
      const payload = {
        courseCode: selectedCourse.courseCode,
        courseName: selectedCourse.courseName,
        batchId: selectedCourse.batchId || "",
        batchName: selectedCourse.batchName || "",
        sectionName: selectedCourse.sectionName,
        semester: selectedCourse.semester,
        date: format(selectedDate, "yyyy-MM-dd"),
        students: students.map((s) => ({
          studentId: s.studentId,
          studentName: s.fullName,
          attendance: s.attendance,
        })),
      };

      const res = await axios.post(
        `${API_URL}/api/attendance/save`,
        payload
      );

      message.success(" Attendance saved successfully");
      fetchStudents(selectedCourse, selectedDate);
    } catch (err) {
      console.error("Save attendance error:", err?.response?.data || err.message || err);
      message.error("Failed to save attendance");
    }
  };

  const getCardStyle = (course) => {
    const baseStyle = {
      border: "none",
      padding: "20px",
      borderRadius: "16px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      cursor: "pointer",
      position: "relative",
      overflow: "hidden",
      height: '100%'
    };

    const isSelected = selectedCourse?.courseCode === course.courseCode && 
                      selectedCourse?.sectionName === course.sectionName;

    if (isSelected) {
      return {
        ...baseStyle,
        background: "linear-gradient(135deg, #f0eaf5 0%, #e6dcf0 100%)",
        border: "2px solid #8a7aa8",
        transform: "translateY(-3px)",
        boxShadow: "0 8px 25px rgba(138, 122, 168, 0.3)"
      };
    }

    return {
      ...baseStyle,
      background: "linear-gradient(135deg, #ffffff, #f8f9fa)",
      borderLeft: "5px solid #8a7aa8"
    };
  };

  const attendanceColumns = [
    { 
      title: "Student ID", 
      dataIndex: "studentId", 
      key: "studentId",
      fixed: 'left',
      width: 120,
      render: (text) => <span style={{ fontWeight: '600' }}>{text}</span>
    },
    { 
      title: "Full Name", 
      dataIndex: "fullName", 
      key: "fullName",
      fixed: 'left',
      width: 150,
      render: (text) => <span style={{ fontWeight: '500' }}>{text}</span>
    },
    {
      title: "Attendance Status",
      key: "attendance",
      width: 150,
      render: (_, record) => (
        <Button
          onClick={() => toggleAttendance(record.studentId)}
          style={{
            backgroundColor: record.attendance === "Present" ? "#52c41a" : "#ff4d4f",
            color: "#fff",
            border: 'none',
            borderRadius: '6px',
            fontWeight: '600',
            width: '100px',
            height: '32px'
          }}
          icon={record.attendance === "Present" ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
        >
          {record.attendance}
        </Button>
      ),
    },
    {
      title: "Overall Percentage",
      dataIndex: "percentage",
      key: "percentage",
      width: 120,
      render: (value) => (
        <Tag color={value >= 75 ? "success" : value >= 65 ? "warning" : "error"}>
          {value}%
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: "#f8f9fa", minHeight: "100vh" }}>
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <TeamOutlined style={{ fontSize: 24, color: "#000000" }} />
            <span style={{ fontSize: 24, fontWeight: 'bold', color: "#000000" }}>
              Faculty Attendance Management
            </span>
          </div>
        }
        style={{ borderRadius: 16, boxShadow: "0 6px 15px rgba(0,0,0,0.1)" }}
      >
        {loadingCourses ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : courses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ fontSize: 16, color: '#8c8c8c' }}>No active courses assigned.</p>
          </div>
        ) : (
          <>
            {/* Course Cards Grid */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ color: "#2c3e50", marginBottom: 16, fontSize: "20px", fontWeight: "600" }}>Your Active Courses</h3>
              <Row gutter={[16, 16]}>
                {courses.map((course, idx) => (
                  <Col xs={24} sm={12} md={8} lg={6} key={idx}>
                    <div
                      style={getCardStyle(course)}
                      onClick={() => fetchStudents(course)}
                      onMouseEnter={(e) => {
                        if (!(selectedCourse?.courseCode === course.courseCode && selectedCourse?.sectionName === course.sectionName)) {
                          e.currentTarget.style.transform = "translateY(-5px)";
                          e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!(selectedCourse?.courseCode === course.courseCode && selectedCourse?.sectionName === course.sectionName)) {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                        }
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: "0 0 6px 0", color: "#2c3e50", fontSize: "14px", fontWeight: "600", opacity: 0.8 }}>
                            {course.courseCode}
                          </h4>
                          <h3 style={{ margin: "0", color: "#34495e", fontSize: "16px", fontWeight: "700", lineHeight: "1.3" }}>
                            {course.courseName}
                          </h3>
                        </div>
                        <Tag color="blue" style={{ margin: 0, fontWeight: '600' }}>
                          {course.totalStudents || 0} Students
                        </Tag>
                      </div>

                      <div style={{ lineHeight: "1.6" }}>
                        <div style={{ display: "grid", gap: "8px", marginBottom: "16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "12px", opacity: 0.7 }}></span>
                            <span style={{ fontSize: "13px" }}><strong>Batch:</strong> {course.batchName}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "12px", opacity: 0.7 }}></span>
                            <span style={{ fontSize: "13px" }}><strong>Section:</strong> {course.sectionName} | <strong>Semester:</strong> {course.semester}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "12px", opacity: 0.7 }}></span>
                            <span style={{ fontSize: "13px" }}><strong>Credits:</strong> {course.creditHrs} hours</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "12px", opacity: 0.7 }}></span>
                            <span style={{ fontSize: "13px" }}><strong>Department:</strong> {course.department}</span>
                          </div>
                        </div>

                        {course.timeSlots?.length > 0 && (
                          <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #e9ecef", fontSize: "12px", color: "#6c757d" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                              <ClockCircleOutlined style={{ fontSize: "12px" }} />
                              <span style={{ fontWeight: "600" }}>Schedule</span>
                            </div>
                            {course.timeSlots.slice(0, 2).map((slot, i) => (
                              <div key={i} style={{ marginBottom: "4px" }}>
                                {slot.day.charAt(0).toUpperCase() + slot.day.slice(1)}: {slot.startTime} - {slot.endTime}
                              </div>
                            ))}
                            {course.timeSlots.length > 2 && (
                              <div style={{ color: '#8a7aa8', fontWeight: '600', marginTop: '4px' }}>
                                +{course.timeSlots.length - 2} more slots
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </Col>
                ))}
              </Row>
            </div>

            {/* Attendance Section */}
            {selectedCourse && (
              <div style={{ marginTop: 24 }}>
                <Card
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CalendarOutlined style={{ color: "#8a7aa8" }} />
                      <span style={{ color: "#8a7aa8", fontWeight: '600' }}>
                        Mark Attendance - {selectedCourse.courseName}
                      </span>
                    </div>
                  }
                  style={{ borderRadius: 12 }}
                  extra={
                    <Button 
                      type="primary"
                      style={{ 
                        backgroundColor: "#8a7aa8", 
                        borderColor: "#8a7aa8",
                        borderRadius: 8
                      }}
                      onClick={() => setSummaryModalVisible(true)}
                    >
                      View Summary
                    </Button>
                  }
                >
                  {availableDates.length > 0 && (
                    <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <CalendarOutlined style={{ color: '#8a7aa8' }} />
                      <Select
                        value={selectedDate ? format(selectedDate, "yyyy-MM-dd") : ""}
                        onChange={handleDateChange}
                        style={{ width: 200 }}
                        placeholder="Select date"
                      >
                        {availableDates.map((d, i) => (
                          <Option key={i} value={format(d, "yyyy-MM-dd")}>
                            {format(d, "EEEE, MMMM do, yyyy")}
                          </Option>
                        ))}
                      </Select>
                      <Tag color="blue">
                        {availableDates.length} class dates available
                      </Tag>
                    </div>
                  )}

                  {/* Statistics Row */}
                  <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                    <Col xs={12} sm={6}>
                      <Card size="small" style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #e6f7ff 100%)' }}>
                        <Statistic
                          title="Total Students"
                          value={stats.total}
                          prefix={<TeamOutlined />}
                          valueStyle={{ color: '#1890ff' }}
                        />
                      </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Card size="small" style={{ background: 'linear-gradient(135deg, #f6ffed 0%, #f0ffe6 100%)' }}>
                        <Statistic
                          title="Present"
                          value={stats.present}
                          prefix={<CheckCircleOutlined />}
                          valueStyle={{ color: '#52c41a' }}
                        />
                      </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Card size="small" style={{ background: 'linear-gradient(135deg, #fff2f0 0%, #ffe6e6 100%)' }}>
                        <Statistic
                          title="Absent"
                          value={stats.absent}
                          prefix={<CloseCircleOutlined />}
                          valueStyle={{ color: '#ff4d4f' }}
                        />
                      </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Card size="small" style={{ background: 'linear-gradient(135deg, #f0f5ff 0%, #e6eeff 100%)' }}>
                        <Statistic
                          title="Attendance %"
                          value={stats.percentage}
                          suffix="%"
                          valueStyle={{ color: '#8a7aa8' }}
                        />
                      </Card>
                    </Col>
                  </Row>

                  {loadingStudents ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                      <Spin size="large" />
                    </div>
                  ) : students.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#8c8c8c' }}>
                      <TeamOutlined style={{ fontSize: 48, marginBottom: 16, color: '#d9d9d9' }} />
                      <div>No students found for this course.</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
                        <Button 
                          onClick={markAllPresent}
                          style={{ 
                            backgroundColor: '#52c41a', 
                            borderColor: '#52c41a',
                            color: '#fff'
                          }}
                        >
                          Mark All Present
                        </Button>
                        <Button 
                          onClick={markAllAbsent}
                          style={{ 
                            backgroundColor: '#ff4d4f', 
                            borderColor: '#ff4d4f',
                            color: '#fff'
                          }}
                        >
                          Mark All Absent
                        </Button>
                      </div>

                      <Table
                        dataSource={students}
                        columns={attendanceColumns}
                        rowKey="studentId"
                        scroll={{ x: 'max-content' }}
                        bordered
                        pagination={{ 
                          pageSize: 10, 
                          showSizeChanger: true,
                          showQuickJumper: true 
                        }}
                      />

                      <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
                        <Button
                          type="primary"
                          icon={<SaveOutlined />}
                          onClick={saveAttendance}
                          style={{ 
                            backgroundColor: "#8a7aa8", 
                            borderColor: "#8a7aa8",
                            borderRadius: 8,
                            fontWeight: 600
                          }}
                          size="large"
                        >
                          Save Attendance
                        </Button>
                        <Button
                          onClick={() => setSelectedCourse(null)}
                          style={{ borderRadius: 8 }}
                          size="large"
                        >
                          Back to Courses
                        </Button>
                      </div>
                    </>
                  )}
                </Card>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Summary Modal */}
      <Modal
        title="Attendance Summary"
        open={summaryModalVisible}
        onCancel={() => setSummaryModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setSummaryModalVisible(false)}>
            Close
          </Button>
        ]}
      >
        {selectedCourse && (
          <div>
            <p><strong>Course:</strong> {selectedCourse.courseName} ({selectedCourse.courseCode})</p>
            <p><strong>Date:</strong> {selectedDate ? format(selectedDate, "PPPP") : 'Not selected'}</p>
            <p><strong>Total Students:</strong> {stats.total}</p>
            <p><strong>Present:</strong> {stats.present}</p>
            <p><strong>Absent:</strong> {stats.absent}</p>
            <p><strong>Attendance Rate:</strong> {stats.percentage}%</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default FacultyAttendancePage;
