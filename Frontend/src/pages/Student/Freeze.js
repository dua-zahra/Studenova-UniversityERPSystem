import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Accordion,
  Table,
  Badge,
  Card,
  Alert,
  Button,
} from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import API_URL from '../../../config';

export default function SemesterFreezePage() {
  const [freezeData] = useState({
    studentId: "BSCS-F25-015",
    studentName: "Ayesha Rehman",
    degreeLevel: "Undergraduate",
    department: "Computer Science",
    currentSemester: 3,
    totalFreezeAllowed: 2,

    freezeHistory: [
      {
        freezeId: "FZ-2024-001",
        semester: 2,
        requestDate: "2024-06-10",
        approvedDate: "2024-06-15",
        reason: "Medical grounds - doctor recommended rest for 2 months.",
        status: "approved",
        processedBy: "Registrar Office",
      },
    ],

    pendingRequests: [
      {
        freezeId: "FZ-2025-003",
        semester: 3,
        requestDate: "2025-01-22",
        reason: "Family emergency - travel abroad.",
        status: "pending",
      },
    ],

    unfreezeHistory: [
      {
        unfreezeId: "UF-2024-001",
        requestDate: "2024-08-20",
        approvedDate: "2024-08-22",
        returnSemester: 3,
        status: "approved",
        processedBy: "Registrar Office",
      },
    ],
  });

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-GB");
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "approved":
        return <Badge bg="success">Approved</Badge>;
      case "pending":
        return <Badge bg="warning">Pending</Badge>;
      case "rejected":
        return <Badge bg="danger">Rejected</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };

  return (
    <Container className="my-4">
      <h2 className="mb-4 text-center" style={{ color: "#2c3e50" }}>
        Semester Freeze & Unfreeze Status
      </h2>

      <Card className="mb-4 shadow-sm">
        <Card.Body>
          <Row>
            <Col md={4}>
              <strong>Student Name:</strong> {freezeData.studentName}
            </Col>
            <Col md={4}>
              <strong>Student ID:</strong> {freezeData.studentId}
            </Col>
            <Col md={4}>
              <strong>Degree Level:</strong> {freezeData.degreeLevel}
            </Col>
            <Col md={4} className="mt-2">
              <strong>Department:</strong> {freezeData.department}
            </Col>
            <Col md={4} className="mt-2">
              <strong>Current Semester:</strong> {freezeData.currentSemester}
            </Col>
            <Col md={4} className="mt-2">
              <strong>Total Allowed Freezes:</strong>{" "}
              {freezeData.totalFreezeAllowed}
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {freezeData.pendingRequests.length > 0 && (
        <Alert variant="warning">
          You have {freezeData.pendingRequests.length} pending freeze request(s).
        </Alert>
      )}

      <Accordion alwaysOpen defaultActiveKey={["0", "1", "2"]}>
        {/* Freeze History */}
        <Accordion.Item eventKey="0">
          <Accordion.Header>
            <strong>Freeze History</strong>
          </Accordion.Header>
          <Accordion.Body>
            {freezeData.freezeHistory.length === 0 ? (
              <p>No freeze history available.</p>
            ) : (
              <Table striped bordered hover responsive>
                <thead className="table-dark">
                  <tr>
                    <th>Freeze ID</th>
                    <th>Semester</th>
                    <th>Request Date</th>
                    <th>Approved Date</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Processed By</th>
                  </tr>
                </thead>
                <tbody>
                  {freezeData.freezeHistory.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.freezeId}</td>
                      <td>{item.semester}</td>
                      <td>{formatDate(item.requestDate)}</td>
                      <td>{formatDate(item.approvedDate)}</td>
                      <td>{item.reason}</td>
                      <td>{getStatusBadge(item.status)}</td>
                      <td>{item.processedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Accordion.Body>
        </Accordion.Item>

        <Accordion.Item eventKey="1">
          <Accordion.Header>
            <strong>Pending Freeze Requests</strong>
          </Accordion.Header>
          <Accordion.Body>
            {freezeData.pendingRequests.length === 0 ? (
              <p>No pending requests.</p>
            ) : (
              <Table striped bordered hover responsive>
                <thead className="table-dark">
                  <tr>
                    <th>Freeze ID</th>
                    <th>Semester</th>
                    <th>Request Date</th>
                    <th>Reason</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {freezeData.pendingRequests.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.freezeId}</td>
                      <td>{item.semester}</td>
                      <td>{formatDate(item.requestDate)}</td>
                      <td>{item.reason}</td>
                      <td>{getStatusBadge(item.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}

            <Button variant="primary" disabled className="mt-3">
              Freeze Request is Under Review
            </Button>
          </Accordion.Body>
        </Accordion.Item>

        <Accordion.Item eventKey="2">
          <Accordion.Header>
            <strong>Unfreeze History</strong>
          </Accordion.Header>
          <Accordion.Body>
            {freezeData.unfreezeHistory.length === 0 ? (
              <p>No unfreeze history available.</p>
            ) : (
              <Table striped bordered hover responsive>
                <thead className="table-dark">
                  <tr>
                    <th>Unfreeze ID</th>
                    <th>Request Date</th>
                    <th>Approved Date</th>
                    <th>Return Semester</th>
                    <th>Status</th>
                    <th>Processed By</th>
                  </tr>
                </thead>
                <tbody>
                  {freezeData.unfreezeHistory.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.unfreezeId}</td>
                      <td>{formatDate(item.requestDate)}</td>
                      <td>{formatDate(item.approvedDate)}</td>
                      <td>{item.returnSemester}</td>
                      <td>{getStatusBadge(item.status)}</td>
                      <td>{item.processedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>
    </Container>
  );
}
