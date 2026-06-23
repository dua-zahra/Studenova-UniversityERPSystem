import React, { useState, useEffect } from "react";
import API_URL from '../../config';

import {
  Container,
  Accordion,
  Row,
  Col,
  Table,
  Spinner,
  Alert,
  Card,
  Badge,
} from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";

export default function TimeTable() {
  const [timetableData, setTimetableData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTimeTable = async () => {
      try {
        const res = await fetch(`${API_URL}/api/students/gettimetable`, {
          credentials: "include",
        });

        if (!res.ok) throw new Error("Failed to fetch timetable");

        const data = await res.json();
        setTimetableData(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchTimeTable();
  }, []);

  if (loading)
    return (
      <Container className="text-center my-5">
        <Spinner animation="border" />
        <p>Loading timetable...</p>
      </Container>
    );

  if (error)
    return (
      <Container className="my-5">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday"];
  const timetableByDay = {};

  days.forEach((day) => {
    timetableByDay[day] = timetableData.timeSlots.filter((slot) => slot.day === day);
  });

  return (
    <Container className="my-4">
      {/* Timetable Header Information */}
      <Card className="mb-4 shadow-sm">
        <Card.Body>
          <h3 className="text-center mb-3" style={{ color: "#2c3e50", fontWeight: 700 }}>
            Timetable – Semester {timetableData.semester}
          </h3>

          <Row>
            <Col md={6}>
              <p><strong>Student:</strong> {timetableData.studentName}</p>
              <p><strong>Department:</strong> {timetableData.department}</p>
              <p><strong>Degree Level:</strong> {timetableData.degreeLevel}</p>
            </Col>
            <Col md={6}>
              <p><strong>Timetable Name:</strong> {timetableData.meta.timetableName}</p>
              <p><strong>Academic Year:</strong> {timetableData.meta.academicYear}</p>
              <p><strong>Description:</strong> {timetableData.meta.description}</p>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Accordion Days */}
      <Accordion alwaysOpen>
        {days.map((day, index) => {
          const slots = timetableByDay[day];

          return (
            <Accordion.Item eventKey={index.toString()} key={day}>
              <Accordion.Header>
                <strong style={{ textTransform: "capitalize" }}>{day}</strong>
                <Badge bg="primary" className="ms-3">
                  {slots.length} Classes
                </Badge>
              </Accordion.Header>

              <Accordion.Body>
                {slots.length === 0 ? (
                  <p className="text-muted">No classes scheduled.</p>
                ) : (
                  <div className="table-responsive">
                    <Table bordered hover>
                      <thead className="table-dark">
                        <tr>
                          <th>Time</th>
                          <th>Course</th>
                          <th>Section</th>
                          <th>Class Type</th>
                          <th>Faculty</th>
                          <th>Room</th>
                          <th>Last Sync</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slots.map((slot, idx) => (
                          <tr key={idx}>
                            <td>
                              {slot.startTime} – {slot.endTime}
                            </td>
                            <td>
                              <strong>{slot.courseCode}</strong> <br /> {slot.courseName}
                            </td>
                            <td>{slot.sectionName}</td>
                            <td>
                              <Badge bg="info">{slot.classType}</Badge>
                            </td>
                            <td>{slot.facultyName}</td>
                            <td>{slot.room}</td>
                            <td>{new Date(slot.lastFacultySync).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Accordion.Body>
            </Accordion.Item>
          );
        })}
      </Accordion>
    </Container>
  );
}
