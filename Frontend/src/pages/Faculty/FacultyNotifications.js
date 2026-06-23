import React, { useEffect, useState } from "react";
import { Card, message, Spin } from "antd";
import { BellOutlined } from "@ant-design/icons";
import axiosInstance  from '../../axiosConfig';
import API_URL from '../../config';

function NotificationsPage() {
  const [todayClasses, setTodayClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTodayClasses = async () => {
      try {
        const facultyUser = JSON.parse(localStorage.getItem("user") || "{}");
        const facultyEmail = facultyUser?.email || facultyUser?.universityEmail;
        if (!facultyEmail) return;

        const resCourses = await axiosInstance.get(
          `${API_URL}/api/faculty-courses/courses`,
          { params: { universityEmail: facultyEmail } }
        );

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
            const resSlots = await axiosInstance.get(
              `${API_URL}/api/faculty-timetable/course-slots`,
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
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                  room: slot.room,
                });
              }
            });
          } catch (err) {
            console.error("Failed to fetch slots for", course.courseCode);
          }
        }

        setTodayClasses(todayClassesArr);
      } catch (err) {
        console.error(err);
        message.error("Failed to fetch today's classes");
      } finally {
        setLoading(false);
      }
    };

    fetchTodayClasses();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      {/* Heading with black bell icon */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 20,
          gap: 10,
        }}
      >
        <BellOutlined style={{ fontSize: 28, color: "#000" }} />
        <h2 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
          Today's Class Notifications
        </h2>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", marginTop: 100 }}>
          <Spin size="large" />
        </div>
      ) : todayClasses.length === 0 ? (
        <p>No classes scheduled for today.</p>
      ) : (
        todayClasses.map((cls, index) => (
          <Card
            key={index}
            style={{
              marginBottom: 12,
              borderLeft: "4px solid #51cf66",
              backgroundColor: "#f0f9f0",
            }}
            title={`${cls.courseCode} (${cls.sectionName})`}
          >
            <p>
              <strong>Time:</strong> {cls.startTime} - {cls.endTime}
            </p>
            <p>
              <strong>Room:</strong> {cls.room}
            </p>
          </Card>
        ))
      )}
    </div>
  );
}

export default NotificationsPage;
