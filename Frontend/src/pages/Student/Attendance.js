import React, { useEffect, useState } from "react";
import API_URL from '../../config';

import {
  Accordion,
  ProgressBar,
  Container,
  Row,
  Col,
  Spinner,
  Alert,
} from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";

export default function Attendance() {
  const [attendanceData, setAttendanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/students/getstudentattendance`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch attendance data");
        return res.json();
      })
      .then((data) => {
        setAttendanceData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const getProgressVariant = (percentage) => {
    if (percentage >= 90) return "success";
    if (percentage >= 70) return "warning";
    return "danger";
  };

  const calculateSummary = (records) => {
    const total = records.length;
    const present = records.filter((r) => r.status === "Present").length;
    const absent = records.filter((r) => r.status !== "Present").length;
    const percentage = total === 0 ? 0 : Math.round((present / total) * 100);
    return { total, present, absent, percentage };
  };

  if (loading)
    return (
      <Container className="text-center my-5">
        <Spinner animation="border" role="status" />
        <p className="mt-2">Loading attendance...</p>
      </Container>
    );

  if (error)
    return (
      <Container className="my-5">
        <Alert variant="danger">Error: {error}</Alert>
      </Container>
    );

  const allKeys = attendanceData.courses.map((_, index) => index.toString());

  return (
    <Container className="my-4">
      <h2 className="mb-4 text-center" style={{ color: "#2c3e50" }}>
        Attendance Record - Semester {attendanceData.currentSemester}
      </h2>

      <Accordion defaultActiveKey={allKeys} alwaysOpen>
        {attendanceData.courses.map((course, index) => {
          const summary = calculateSummary(course.attendanceRecords);

          return (
            <Accordion.Item eventKey={index.toString()} key={course.courseCode}>
              <Accordion.Header>
                <Row className="w-100 align-items-center">
                  <Col xs={12} md={6}>
                    <strong>{course.courseCode}</strong> - {course.courseName}
                  </Col>
                  <Col xs={12} md={6} className="mt-2 mt-md-0">
                    <ProgressBar
                      now={summary.percentage}
                      label={`${summary.percentage}%`}
                      variant={getProgressVariant(summary.percentage)}
                    />
                  </Col>
                </Row>
              </Accordion.Header>
              <Accordion.Body>
                <Row className="mb-3">
                  <Col xs={4}>
                    <strong>Total Classes:</strong> {summary.total}
                  </Col>
                  <Col xs={4}>
                    <strong>Present:</strong> {summary.present}
                  </Col>
                  <Col xs={4}>
                    <strong>Absent:</strong> {summary.absent}
                  </Col>
                </Row>

                {course.attendanceRecords.length === 0 ? (
                  <p>No attendance records available.</p>
                ) : (
                  <table className="table table-striped table-bordered">
                    <thead className="table-dark">
                      <tr>
                        <th>Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {course.attendanceRecords.map((record, idx) => (
                        <tr key={idx}>
                          <td>
                            {new Date(record.date).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                          <td>{record.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Accordion.Body>
            </Accordion.Item>
          );
        })}
      </Accordion>
    </Container>
  );
}
