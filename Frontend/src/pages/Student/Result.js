import React, { useState, useEffect } from "react";
import {
  Container,
  Accordion,
  Row,
  Col,
  ProgressBar,
  Table,
  Spinner,
  Alert,
  Card,
} from "react-bootstrap";
import API_URL from '../../config';

export default function Results() {
  const [resultsData, setResultsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/students/getstudentresults`, {
      method: "GET",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || "Failed to fetch results");
        }
        return res.json();
      })
      .then((data) => {
        setResultsData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const getVariant = (percentage) => {
    if (percentage >= 85) return "success";
    if (percentage >= 50) return "warning";
    return "danger";
  };

  const renderCourseTable = (courses) => {
    if (!courses || courses.length === 0) return <p>No courses available.</p>;

    return (
      <div className="table-responsive">
        <Table striped bordered hover>
          <thead className="table-dark">
            <tr>
              <th>Course Code</th>
              <th>Course Name</th>
              <th>Section / Batch</th>
              <th>Grade</th>
              <th>Grade Points</th>
              <th>Obtained Marks</th>
              <th>Total Marks</th>
              <th>Percentage</th>
              <th>Assessment</th>
              <th>Assessment Marks</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course, idx) => (
              <React.Fragment key={idx}>
                {(course.assessments || []).map((a, i) => (
                  <tr key={i}>
                    <td>{course.courseCode || "-"}</td>
                    <td>{course.courseName || "-"}</td>
                    <td>
                      {course.sectionName || "-"} / {course.batchName || "-"}
                    </td>
                    <td>{course.grade || "-"}</td>
                    <td>{course.gradePoints != null ? course.gradePoints.toFixed(2) : "0.00"}</td>
                    <td>{course.obtainedMarks != null ? course.obtainedMarks.toFixed(2) : "0.00"}</td>
                    <td>{course.totalMarks != null ? course.totalMarks.toFixed(2) : "0.00"}</td>
                    <td>
                      <ProgressBar
                        now={course.percentage ? parseFloat(course.percentage) : 0}
                        variant={getVariant(course.percentage || 0)}
                        label={`${course.percentage || 0}%`}
                      />
                    </td>
                    <td>{a.name || "-"}</td>
                    <td>
                      {a.obtainedMarks != null ? a.obtainedMarks.toFixed(2) : "0.00"} /{" "}
                      {a.totalMarks != null ? a.totalMarks.toFixed(2) : "0.00"}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </Table>
      </div>
    );
  };

  if (loading)
    return (
      <Container className="text-center my-5">
        <Spinner animation="border" />
        <p>Loading results...</p>
      </Container>
    );

  if (error)
    return (
      <Container className="my-5">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );

  return (
    <Container className="my-4">
      <Card className="shadow p-4">
        <h2 className="text-center text-primary mb-4">Academic Results</h2>

        <Row className="mb-3">
          <Col md={4}>
            <strong>Name:</strong> {resultsData.studentName || "-"}
          </Col>
          <Col md={4}>
            <strong>Student ID:</strong> {resultsData.studentId || "-"}
          </Col>
          <Col md={4}>
            <strong>Department:</strong> {resultsData.department || "-"}
          </Col>
        </Row>

        <Accordion defaultActiveKey="current" alwaysOpen>
          {resultsData.currentSemesterResult && (
            <Accordion.Item eventKey="current">
              <Accordion.Header>Current Semester Result</Accordion.Header>
              <Accordion.Body>
                {renderCourseTable([resultsData.currentSemesterResult])}
              </Accordion.Body>
            </Accordion.Item>
          )}

          {(resultsData.previousSemestersData || []).map((sem, idx) => (
            <Accordion.Item eventKey={`prev-${idx}`} key={idx}>
              <Accordion.Header>Semester {sem.semesterNumber}</Accordion.Header>
              <Accordion.Body>{renderCourseTable(sem.courses || [])}</Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>
      </Card>
    </Container>
  );
}
