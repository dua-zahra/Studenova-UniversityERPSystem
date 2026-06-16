import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaTimes } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Button } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import "../../../assets/style.css";

const initialFormState = {
  firstName: '',
  lastName: '',
  fatherFirstName: '',
  fatherLastName: '',
  gender: '',
  cnic: '',
  birthDate: '',
  bloodGroup: 'A+',
  maritalStatus: 'Single',
  religion: 'Islam',
  personalEmail: '',
  contactNumber: '',
  emergencyContact: '',
  address: '',
  city: '',
  province: 'Punjab',
  country: 'Pakistan',
  postalCode: '',
  status: 'active',
  degreeLevel: '',
  department: '',
  currentSemester: 1,
  batch: '',
  admissionType: 'Regular',
  studyMode: 'FullTime',
  domicileProvince: 'Punjab',
  isScholarshipApplicant: false,
  scholarshipPercentage: '',
  matricQualification: {
    institution: '',
    year: '',
    totalMarks: '',
    obtainedMarks: '',
    boardUniversity: '',
    document: null
  },
  intermediateQualification: {
    institution: '',
    year: '',
    totalMarks: '',
    obtainedMarks: '',
    boardUniversity: '',
    document: null
  },
  photo: null,
  domicile: null
};

const provinces = ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan'];
const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const religions = ['Islam', 'Christianity', 'Hinduism', 'Other'];
const admissionTypes = ['Regular', 'SelfFinance', 'Overseas', 'Scholarship'];
const studyModes = ['FullTime', 'PartTime'];

// Validation utility functions
const validationUtils = {
  isValidText: (text) => {
    return /^[a-zA-Z\s\-'.]*$/.test(text);
  },
  isValidInstitution: (text) => {
    return /^[a-zA-Z0-9\s\-'.,&()/]*$/.test(text);
  },
  isValidAddress: (text) => {
    return /^[a-zA-Z0-9\s\-'.,#&()/]*$/.test(text);
  },
  isValidNumber: (number) => {
    return /^\d*$/.test(number);
  },
  isValidEmail: (email) => {
    return /^\S+@\S+\.\S+$/.test(email);
  },
  isValidCNIC: (cnic) => {
    return /^\d{5}-\d{7}-\d$/.test(cnic);
  },
  isValidPhone: (phone) => {
    return /^\d{11}$/.test(phone);
  },
  isValidPostalCode: (postalCode) => {
    return /^\d{5}$/.test(postalCode);
  },
  isValidYear: (year) => {
    const currentYear = new Date().getFullYear();
    return /^\d{4}$/.test(year) && year >= 1900 && year <= currentYear;
  },
  isValidMarks: (marks) => {
    return /^\d*$/.test(marks) && (marks === '' || parseInt(marks) >= 0);
  }
};

const StudentEnrollmentPage = ({ onClose }) => {
  const [formData, setFormData] = useState(initialFormState);
  const [degreeLevels, setDegreeLevels] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingDegreeLevels, setLoadingDegreeLevels] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [availableSemesters, setAvailableSemesters] = useState([1]);

  // Fetch degree levels
  useEffect(() => {
    const fetchDegreeLevels = async () => {
      try {
        setLoadingDegreeLevels(true);
        const response = await axios.get('http://localhost:65000/api/degree-levels');
        setDegreeLevels(response.data);
      } catch (error) {
        toast.error('Failed to load degree levels');
        console.error('Error:', error);
      } finally {
        setLoadingDegreeLevels(false);
      }
    };
    fetchDegreeLevels();
  }, []);

  // Fetch departments when degree level changes
  useEffect(() => {
    if (!formData.degreeLevel) {
      setDepartments([]);
      setFormData(prev => ({ ...prev, department: '', batch: '' }));
      return;
    }
    const fetchDepartments = async () => {
      try {
        setLoadingDepartments(true);
        const response = await axios.get('http://localhost:65000/api/departments/by-degree', {
          params: { degreeLevel: formData.degreeLevel }
        });
        setDepartments(response.data.departments || []);
      } catch {
        toast.error('Failed to load departments');
        setDepartments([]);
      } finally {
        setLoadingDepartments(false);
      }
    };
    fetchDepartments();
  }, [formData.degreeLevel]);

  // Fetch batches when department changes - CORRECTED VERSION
  useEffect(() => {
    if (!formData.degreeLevel || !formData.department) {
      setBatches([]);
      setFormData(prev => ({ ...prev, batch: '', currentSemester: 1 }));
      setAvailableSemesters([1]);
      return;
    }

    const fetchBatches = async () => {
      try {
        setLoadingBatches(true);
        console.log('Fetching batches for:', {
          department: formData.department,
          degreeLevel: formData.degreeLevel
        });

        const response = await axios.get('http://localhost:65000/api/batches/open/enrollment', {
          params: {
            department: formData.department,
            degreeLevel: formData.degreeLevel
          }
        });

        console.log('Batches API Response:', response.data);

        const validBatches = response.data.data || [];
        setBatches(validBatches);

        if (validBatches.length > 0) {
          const maxSemesters = validBatches[0].totalSemesters || 1;
          setAvailableSemesters(Array.from({ length: maxSemesters }, (_, i) => i + 1));
          console.log(`Found ${validBatches.length} batches with max ${maxSemesters} semesters`);
        } else {
          setAvailableSemesters([1]);
          console.log('No batches found for the selected criteria');
        }
      } catch (error) {
        console.error('Error fetching batches:', error);
        toast.error('Failed to load available batches');
        setBatches([]);
        setAvailableSemesters([1]);
      } finally {
        setLoadingBatches(false);
      }
    };

    fetchBatches();
  }, [formData.department, formData.degreeLevel]);

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    setValidationErrors(prev => ({ ...prev, [name]: '' }));

    if (value && !validationUtils.isValidText(value)) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: 'Only letters, spaces, hyphens, and apostrophes are allowed'
      }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleInstitutionChange = (e) => {
    const { name, value } = e.target;
    setValidationErrors(prev => ({ ...prev, [name]: '' }));

    if (value && !validationUtils.isValidInstitution(value)) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: 'Only letters, numbers, spaces, hyphens, apostrophes, commas, periods, ampersands, and parentheses are allowed'
      }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setValidationErrors(prev => ({ ...prev, [name]: '' }));

    if (value && !validationUtils.isValidAddress(value)) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: 'Only letters, numbers, spaces, and common address characters are allowed'
      }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    setValidationErrors(prev => ({ ...prev, [name]: '' }));

    if (value && !validationUtils.isValidNumber(value)) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: 'Only numbers are allowed'
      }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEmailChange = (e) => {
    const { name, value } = e.target;
    setValidationErrors(prev => ({ ...prev, [name]: '' }));

    if (value && !validationUtils.isValidEmail(value)) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: 'Please enter a valid email address'
      }));
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhoneChange = (e) => {
    const { name, value } = e.target;
    setValidationErrors(prev => ({ ...prev, [name]: '' }));

    if (value && !validationUtils.isValidNumber(value)) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: 'Only numbers are allowed'
      }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCNICChange = (e) => {
    const { name, value } = e.target;
    setValidationErrors(prev => ({ ...prev, [name]: '' }));

    if (value && !/^[\d\-]*$/.test(value)) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: 'Only numbers and dashes are allowed'
      }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePostalCodeChange = (e) => {
    const { name, value } = e.target;
    setValidationErrors(prev => ({ ...prev, [name]: '' }));

    if (value && !validationUtils.isValidNumber(value)) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: 'Only numbers are allowed'
      }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleChange = e => {
    const { name, value, type, checked, files } = e.target;
    setValidationErrors(prev => ({ ...prev, [name]: '' }));

    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (files) {
      setFormData(prev => ({ ...prev, [name]: files[0] }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleQualificationChange = (qualType, field, value, isNumberField = false, isInstitutionField = false) => {
    const errorKey = `${qualType}${field.charAt(0).toUpperCase() + field.slice(1)}`;
    
    setValidationErrors(prev => ({ ...prev, [errorKey]: '' }));

    if (isNumberField && field !== 'year' && value && !validationUtils.isValidNumber(value)) {
      setValidationErrors(prev => ({
        ...prev,
        [errorKey]: 'Only numbers are allowed'
      }));
      return;
    }

    if (isInstitutionField && value && !validationUtils.isValidInstitution(value)) {
      setValidationErrors(prev => ({
        ...prev,
        [errorKey]: 'Only letters, numbers, spaces, and common punctuation are allowed'
      }));
      return;
    }

    if ((field === 'totalMarks' || field === 'obtainedMarks') && value && !validationUtils.isValidMarks(value)) {
      setValidationErrors(prev => ({
        ...prev,
        [errorKey]: 'Please enter valid marks'
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      [`${qualType}Qualification`]: {
        ...prev[`${qualType}Qualification`],
        [field]: value
      }
    }));
  };

  const handleYearBlur = (qualType, value) => {
    const errorKey = `${qualType}Year`;
    
    if (value && !validationUtils.isValidYear(value)) {
      setValidationErrors(prev => ({
        ...prev,
        [errorKey]: 'Please enter a valid year (1900 - current year)'
      }));
    } else {
      setValidationErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  const handleQualificationFileChange = (qualType, e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      toast.error('Only PDF, JPG, and PNG files are allowed');
      e.target.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB');
      e.target.value = '';
      return;
    }

    setFormData(prev => ({
      ...prev,
      [`${qualType}Qualification`]: {
        ...prev[`${qualType}Qualification`],
        document: file
      }
    }));
  };

  const validateForm = () => {
    const errors = {};
    let isValid = true;

    // Required field validations
    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required';
    } else if (!validationUtils.isValidText(formData.firstName)) {
      errors.firstName = 'First name contains invalid characters';
    }

    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required';
    } else if (!validationUtils.isValidText(formData.lastName)) {
      errors.lastName = 'Last name contains invalid characters';
    }

    if (!formData.fatherFirstName.trim()) {
      errors.fatherFirstName = 'Father first name is required';
    } else if (!validationUtils.isValidText(formData.fatherFirstName)) {
      errors.fatherFirstName = 'Father first name contains invalid characters';
    }

    if (!formData.fatherLastName.trim()) {
      errors.fatherLastName = 'Father last name is required';
    } else if (!validationUtils.isValidText(formData.fatherLastName)) {
      errors.fatherLastName = 'Father last name contains invalid characters';
    }

    if (!formData.gender) errors.gender = 'Gender is required';
    
    if (!formData.cnic) {
      errors.cnic = 'CNIC is required';
    } else if (!validationUtils.isValidCNIC(formData.cnic)) {
      errors.cnic = 'Valid CNIC is required (XXXXX-XXXXXXX-X)';
    }

    if (!formData.birthDate) errors.birthDate = 'Birth date is required';

    if (!formData.personalEmail) {
      errors.personalEmail = 'Email is required';
    } else if (!validationUtils.isValidEmail(formData.personalEmail)) {
      errors.personalEmail = 'Valid email is required';
    }

    if (!formData.contactNumber) {
      errors.contactNumber = 'Phone number is required';
    } else if (!validationUtils.isValidPhone(formData.contactNumber)) {
      errors.contactNumber = 'Valid phone number is required (11 digits)';
    }

    if (!formData.emergencyContact) {
      errors.emergencyContact = 'Emergency contact is required';
    } else if (!validationUtils.isValidPhone(formData.emergencyContact)) {
      errors.emergencyContact = 'Valid emergency contact is required (11 digits)';
    }

    if (!formData.address.trim()) {
      errors.address = 'Address is required';
    } else if (!validationUtils.isValidAddress(formData.address)) {
      errors.address = 'Address contains invalid characters';
    }
    
    if (!formData.city.trim()) {
      errors.city = 'City is required';
    } else if (!validationUtils.isValidText(formData.city)) {
      errors.city = 'City name contains invalid characters';
    }

    if (!formData.province) errors.province = 'Province is required';

    if (formData.postalCode && !validationUtils.isValidPostalCode(formData.postalCode)) {
      errors.postalCode = 'Postal code must be 5 digits';
    }

    if (!formData.degreeLevel) errors.degreeLevel = 'Degree level is required';
    if (!formData.department) errors.department = 'Department is required';
    if (!formData.batch) errors.batch = 'Batch is required';
    if (!formData.currentSemester) errors.currentSemester = 'Current semester is required';

    if (!formData.photo) errors.photo = 'Photo is required';
    if (!formData.domicile) errors.domicile = 'Domicile certificate is required';

    if (!formData.matricQualification.institution.trim()) {
      errors.matricInstitution = 'Institution is required';
    } else if (!validationUtils.isValidInstitution(formData.matricQualification.institution)) {
      errors.matricInstitution = 'Institution name contains invalid characters';
    }

    if (!formData.matricQualification.year) {
      errors.matricYear = 'Year is required';
    } else if (!validationUtils.isValidYear(formData.matricQualification.year)) {
      errors.matricYear = 'Please enter a valid year (1900 - current year)';
    }

    if (!formData.matricQualification.totalMarks) {
      errors.matricTotalMarks = 'Total marks is required';
    } else if (!validationUtils.isValidMarks(formData.matricQualification.totalMarks)) {
      errors.matricTotalMarks = 'Please enter valid total marks';
    }

    if (!formData.matricQualification.obtainedMarks) {
      errors.matricObtainedMarks = 'Obtained marks is required';
    } else if (!validationUtils.isValidMarks(formData.matricQualification.obtainedMarks)) {
      errors.matricObtainedMarks = 'Please enter valid obtained marks';
    } else if (parseInt(formData.matricQualification.obtainedMarks) > parseInt(formData.matricQualification.totalMarks)) {
      errors.matricObtainedMarks = 'Obtained marks cannot exceed total marks';
    }

    if (!formData.matricQualification.boardUniversity.trim()) {
      errors.matricBoard = 'Board/University is required';
    } else if (!validationUtils.isValidInstitution(formData.matricQualification.boardUniversity)) {
      errors.matricBoard = 'Board/University name contains invalid characters';
    }

    if (!formData.matricQualification.document) errors.matricDocument = 'Document is required';

    if (!formData.intermediateQualification.institution.trim()) {
      errors.interInstitution = 'Institution is required';
    } else if (!validationUtils.isValidInstitution(formData.intermediateQualification.institution)) {
      errors.interInstitution = 'Institution name contains invalid characters';
    }

    if (!formData.intermediateQualification.year) {
      errors.interYear = 'Year is required';
    } else if (!validationUtils.isValidYear(formData.intermediateQualification.year)) {
      errors.interYear = 'Please enter a valid year (1900 - current year)';
    }

    if (!formData.intermediateQualification.totalMarks) {
      errors.interTotalMarks = 'Total marks is required';
    } else if (!validationUtils.isValidMarks(formData.intermediateQualification.totalMarks)) {
      errors.interTotalMarks = 'Please enter valid total marks';
    }

    if (!formData.intermediateQualification.obtainedMarks) {
      errors.interObtainedMarks = 'Obtained marks is required';
    } else if (!validationUtils.isValidMarks(formData.intermediateQualification.obtainedMarks)) {
      errors.interObtainedMarks = 'Please enter valid obtained marks';
    } else if (parseInt(formData.intermediateQualification.obtainedMarks) > parseInt(formData.intermediateQualification.totalMarks)) {
      errors.interObtainedMarks = 'Obtained marks cannot exceed total marks';
    }

    if (!formData.intermediateQualification.boardUniversity.trim()) {
      errors.interBoard = 'Board/University is required';
    } else if (!validationUtils.isValidInstitution(formData.intermediateQualification.boardUniversity)) {
      errors.interBoard = 'Board/University name contains invalid characters';
    }

    if (!formData.intermediateQualification.document) errors.intermediateDocument = 'Document is required';

    if (formData.isScholarshipApplicant && (formData.scholarshipPercentage === '' || formData.scholarshipPercentage < 0 || formData.scholarshipPercentage > 100)) {
      errors.scholarshipPercentage = 'Valid scholarship percentage (0-100) is required';
    }

    setValidationErrors(errors);
    isValid = Object.keys(errors).length === 0;

    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please fix the validation errors before submitting');
      return;
    }

    setLoading(true);

    const formDataToSend = new FormData();

    Object.entries(formData).forEach(([key, value]) => {
      if (key === 'matricQualification' || key === 'intermediateQualification') {
        const copy = { ...value };
        delete copy.document;
        formDataToSend.append(key, JSON.stringify(copy));
      } else if (key !== 'photo' && key !== 'domicile') {
        if (value !== null && value !== undefined) {
          formDataToSend.append(key, value);
        }
      }
    });

    if (formData.photo) formDataToSend.append('photo', formData.photo);
    if (formData.domicile) formDataToSend.append('domicile', formData.domicile);
    if (formData.matricQualification.document) formDataToSend.append('matricDocument', formData.matricQualification.document);
    if (formData.intermediateQualification.document) formDataToSend.append('intermediateDocument', formData.intermediateQualification.document);

    try {
      const response = await axios.post(
        'http://localhost:65000/api/students/enroll',
        formDataToSend,
        { 
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000
        }
      );

      toast.success("Student enrolled successfully!");
      console.log('Enrollment response:', response.data);

      setFormData(initialFormState);
      setValidationErrors({});
      document.querySelectorAll('input[type="file"]').forEach(input => (input.value = ''));

      if (onClose) {
        setTimeout(() => onClose(), 1000);
      }

    } catch (error) {
      console.error('Enrollment error:', error);
      if (error.response && error.response.data) {
        console.error('Backend response:', error.response.data);
        toast.error(error.response.data.message || 'Enrollment failed. Please try again.');
      } else if (error.code === 'ECONNABORTED') {
        toast.error('Request timeout. Please try again.');
      } else {
        toast.error('Enrollment failed. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData(initialFormState);
    setValidationErrors({});
    if (onClose) onClose();
  };

  return (
    <div className="add-student container mt-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="add-student-title mb-0">Student Enrollment</h2>
        {onClose && (
          <button className="close-btn" onClick={handleCancel}>
            <FaTimes className="me-2" /> Close
          </button>
        )}
      </div>
      
      <form onSubmit={handleSubmit} encType="multipart/form-data">
        {/* Personal Information Section */}
        <h4 className="mb-3">Personal Information</h4>
        <div className="row">
          <div className="col-md-6 mb-3">
            <label className="form-label">First Name *</label>
            <input
              type="text"
              className={`form-control ${validationErrors.firstName ? 'is-invalid' : ''}`}
              name="firstName"
              value={formData.firstName}
              onChange={handleTextChange}
              required
            />
            {validationErrors.firstName && (
              <div className="invalid-feedback">{validationErrors.firstName}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Last Name *</label>
            <input
              type="text"
              className={`form-control ${validationErrors.lastName ? 'is-invalid' : ''}`}
              name="lastName"
              value={formData.lastName}
              onChange={handleTextChange}
              required
            />
            {validationErrors.lastName && (
              <div className="invalid-feedback">{validationErrors.lastName}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Father's First Name *</label>
            <input
              type="text"
              className={`form-control ${validationErrors.fatherFirstName ? 'is-invalid' : ''}`}
              name="fatherFirstName"
              value={formData.fatherFirstName}
              onChange={handleTextChange}
              required
            />
            {validationErrors.fatherFirstName && (
              <div className="invalid-feedback">{validationErrors.fatherFirstName}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Father's Last Name *</label>
            <input
              type="text"
              className={`form-control ${validationErrors.fatherLastName ? 'is-invalid' : ''}`}
              name="fatherLastName"
              value={formData.fatherLastName}
              onChange={handleTextChange}
              required
            />
            {validationErrors.fatherLastName && (
              <div className="invalid-feedback">{validationErrors.fatherLastName}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Gender *</label>
            <select
              name="gender"
              className={`form-control ${validationErrors.gender ? 'is-invalid' : ''}`}
              value={formData.gender}
              onChange={handleChange}
              required
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
            {validationErrors.gender && (
              <div className="invalid-feedback">{validationErrors.gender}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">CNIC * (XXXXX-XXXXXXX-X)</label>
            <input
              type="text"
              className={`form-control ${validationErrors.cnic ? 'is-invalid' : ''}`}
              name="cnic"
              value={formData.cnic}
              onChange={handleCNICChange}
              placeholder="XXXXX-XXXXXXX-X"
              required
            />
            {validationErrors.cnic && (
              <div className="invalid-feedback">{validationErrors.cnic}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Date of Birth *</label>
            <input
              type="date"
              className={`form-control ${validationErrors.birthDate ? 'is-invalid' : ''}`}
              name="birthDate"
              value={formData.birthDate}
              onChange={handleChange}
              max={new Date().toISOString().split('T')[0]}
              required
            />
            {validationErrors.birthDate && (
              <div className="invalid-feedback">{validationErrors.birthDate}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Blood Group</label>
            <select
              name="bloodGroup"
              className="form-control"
              value={formData.bloodGroup}
              onChange={handleChange}
            >
              {bloodGroups.map(group => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Marital Status</label>
            <select
              name="maritalStatus"
              className="form-control"
              value={formData.maritalStatus}
              onChange={handleChange}
            >
              <option value="Single">Single</option>
              <option value="Married">Married</option>
            </select>
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Religion</label>
            <select
              name="religion"
              className="form-control"
              value={formData.religion}
              onChange={handleChange}
            >
              {religions.map(religion => (
                <option key={religion} value={religion}>{religion}</option>
              ))}
            </select>
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Photograph *</label>
            <input
              type="file"
              className={`form-control ${validationErrors.photo ? 'is-invalid' : ''}`}
              name="photo"
              onChange={handleChange}
              accept="image/*"
              required
            />
            {validationErrors.photo && (
              <div className="invalid-feedback">{validationErrors.photo}</div>
            )}
            <small className="text-muted">(Max 2MB, JPG, PNG)</small>
          </div>
        </div>

        {/* Contact Information Section */}
        <h4 className="mb-3">Contact Information</h4>
        <div className="row">
          <div className="col-md-6 mb-3">
            <label className="form-label">Personal Email *</label>
            <input
              type="email"
              className={`form-control ${validationErrors.personalEmail ? 'is-invalid' : ''}`}
              name="personalEmail"
              value={formData.personalEmail}
              onChange={handleEmailChange}
              required
            />
            {validationErrors.personalEmail && (
              <div className="invalid-feedback">{validationErrors.personalEmail}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Phone Number *</label>
            <input
              type="tel"
              className={`form-control ${validationErrors.contactNumber ? 'is-invalid' : ''}`}
              name="contactNumber"
              value={formData.contactNumber}
              onChange={handlePhoneChange}
              maxLength="11"
              required
            />
            {validationErrors.contactNumber && (
              <div className="invalid-feedback">{validationErrors.contactNumber}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Emergency Contact *</label>
            <input
              type="tel"
              className={`form-control ${validationErrors.emergencyContact ? 'is-invalid' : ''}`}
              name="emergencyContact"
              value={formData.emergencyContact}
              onChange={handlePhoneChange}
              maxLength="11"
              required
            />
            {validationErrors.emergencyContact && (
              <div className="invalid-feedback">{validationErrors.emergencyContact}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Address *</label>
            <input
              type="text"
              className={`form-control ${validationErrors.address ? 'is-invalid' : ''}`}
              name="address"
              value={formData.address}
              onChange={handleAddressChange}
              required
            />
            {validationErrors.address && (
              <div className="invalid-feedback">{validationErrors.address}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">City *</label>
            <input
              type="text"
              className={`form-control ${validationErrors.city ? 'is-invalid' : ''}`}
              name="city"
              value={formData.city}
              onChange={handleTextChange}
              required
            />
            {validationErrors.city && (
              <div className="invalid-feedback">{validationErrors.city}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Province *</label>
            <select
              name="province"
              className={`form-control ${validationErrors.province ? 'is-invalid' : ''}`}
              value={formData.province}
              onChange={handleChange}
              required
            >
              <option value="">Select Province</option>
              {provinces.map(province => (
                <option key={province} value={province}>{province}</option>
              ))}
            </select>
            {validationErrors.province && (
              <div className="invalid-feedback">{validationErrors.province}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Country</label>
            <input
              type="text"
              className="form-control"
              name="country"
              value={formData.country}
              readOnly
            />
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Postal Code</label>
            <input
              type="text"
              className={`form-control ${validationErrors.postalCode ? 'is-invalid' : ''}`}
              name="postalCode"
              value={formData.postalCode}
              onChange={handlePostalCodeChange}
              maxLength="5"
            />
            {validationErrors.postalCode && (
              <div className="invalid-feedback">{validationErrors.postalCode}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Domicile Province</label>
            <select
              name="domicileProvince"
              className="form-control"
              value={formData.domicileProvince}
              onChange={handleChange}
            >
              {provinces.map(province => (
                <option key={province} value={province}>{province}</option>
              ))}
            </select>
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Domicile Certificate *</label>
            <input
              type="file"
              className={`form-control ${validationErrors.domicile ? 'is-invalid' : ''}`}
              name="domicile"
              onChange={handleChange}
              accept=".pdf,.jpg,.png"
              required
            />
            {validationErrors.domicile && (
              <div className="invalid-feedback">{validationErrors.domicile}</div>
            )}
            <small className="text-muted">(Max 2MB, PDF, JPG, PNG)</small>
          </div>
        </div>

        {/* Academic Information Section */}
        <h4 className="mb-3">Academic Information</h4>
        <div className="row">
          <div className="col-md-6 mb-3">
            <label className="form-label">Degree Level *</label>
            <select
              name="degreeLevel"
              className={`form-control ${validationErrors.degreeLevel ? 'is-invalid' : ''}`}
              value={formData.degreeLevel}
              onChange={handleChange}
              disabled={loadingDegreeLevels}
              required
            >
              <option value="">Select Degree Level</option>
              {degreeLevels.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
            {validationErrors.degreeLevel && (
              <div className="invalid-feedback">{validationErrors.degreeLevel}</div>
            )}
            {loadingDegreeLevels && <small className="text-muted">Loading degree levels...</small>}
          </div>
        
          <div className="col-md-6 mb-3">
            <label className="form-label">Department *</label>
            <select
              name="department"
              className={`form-control ${validationErrors.department ? 'is-invalid' : ''}`}
              value={formData.department}
              onChange={handleChange}
              required
            >
              <option value="">Select Department</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept.departmentName}>
                  {dept.departmentName}
                </option>
              ))}
            </select>
            {validationErrors.department && (
              <div className="invalid-feedback">{validationErrors.department}</div>
            )}
            {loadingDepartments && (
              <small className="text-muted">Loading departments...</small>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Batch *</label>
            <select
              name="batch"
              className={`form-control ${validationErrors.batch ? 'is-invalid' : ''}`}
              value={formData.batch}
              onChange={handleChange}
              required
              disabled={loadingBatches || batches.length === 0}
            >
              <option value="">Select Batch</option>
              {batches.map((batch) => (
                <option key={batch._id} value={batch._id}>
                  {batch.batchName} - {batch.enrollmentYear} ({batch.semesterStart})
                </option>
              ))}
            </select>
            {validationErrors.batch && (
              <div className="invalid-feedback">{validationErrors.batch}</div>
            )}
            {loadingBatches && (
              <small className="text-muted">Loading batches...</small>
            )}
            {!loadingBatches && batches.length === 0 && (
              <small className="text-muted">No batches available for selected criteria</small>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Current Semester *</label>
            <select
              className={`form-control ${validationErrors.currentSemester ? 'is-invalid' : ''}`}
              name="currentSemester"
              value={formData.currentSemester}
              onChange={handleChange}
              required
            >
              {availableSemesters.map(sem => (
                <option key={sem} value={sem}>Semester {sem}</option>
              ))}
            </select>
            {validationErrors.currentSemester && (
              <div className="invalid-feedback">{validationErrors.currentSemester}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Admission Type</label>
            <select
              className="form-control"
              name="admissionType"
              value={formData.admissionType}
              onChange={handleChange}
              required
            >
              {admissionTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Study Mode</label>
            <select
              className="form-control"
              name="studyMode"
              value={formData.studyMode}
              onChange={handleChange}
              required
            >
              {studyModes.map(mode => (
                <option key={mode} value={mode}>{mode}</option>
              ))}
            </select>
          </div>
          
          <div className="col-md-6 mb-3">
            <div className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                name="isScholarshipApplicant"
                checked={formData.isScholarshipApplicant}
                onChange={handleChange}
              />
              <label className="form-check-label">Scholarship Applicant?</label>
            </div>
          </div>
          
          {formData.isScholarshipApplicant && (
            <div className="col-md-6 mb-3">
              <label className="form-label">Scholarship Percentage *</label>
              <input
                type="number"
                className={`form-control ${validationErrors.scholarshipPercentage ? 'is-invalid' : ''}`}
                name="scholarshipPercentage"
                value={formData.scholarshipPercentage}
                onChange={handleNumberChange}
                min="0"
                max="100"
                step="0.01"
                required
              />
              {validationErrors.scholarshipPercentage && (
                <div className="invalid-feedback">{validationErrors.scholarshipPercentage}</div>
              )}
            </div>
          )}
        </div>

        {/* Educational Qualifications Section */}
        <h4 className="mb-3">Educational Qualifications</h4>
        
        {/* Matric/O-Level Section */}
        <h5 className="mb-3">Matric/O-Level</h5>
        <div className="row">
          <div className="col-md-6 mb-3">
            <label className="form-label">Institution *</label>
            <input
              type="text"
              className={`form-control ${validationErrors.matricInstitution ? 'is-invalid' : ''}`}
              value={formData.matricQualification.institution}
              onChange={(e) => handleQualificationChange('matric', 'institution', e.target.value, false, true)}
              required
            />
            {validationErrors.matricInstitution && (
              <div className="invalid-feedback">{validationErrors.matricInstitution}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Year *</label>
            <input
              type="text"
              className={`form-control ${validationErrors.matricYear ? 'is-invalid' : ''}`}
              value={formData.matricQualification.year}
              onChange={(e) => handleQualificationChange('matric', 'year', e.target.value, true)}
              onBlur={(e) => handleYearBlur('matric', e.target.value)}
              min="1900"
              max={new Date().getFullYear()}
              maxLength="4"
              required
            />
            {validationErrors.matricYear && (
              <div className="invalid-feedback">{validationErrors.matricYear}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Total Marks *</label>
            <input
              type="text"
              className={`form-control ${validationErrors.matricTotalMarks ? 'is-invalid' : ''}`}
              value={formData.matricQualification.totalMarks}
              onChange={(e) => handleQualificationChange('matric', 'totalMarks', e.target.value, true)}
              min="1"
              required
            />
            {validationErrors.matricTotalMarks && (
              <div className="invalid-feedback">{validationErrors.matricTotalMarks}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Obtained Marks *</label>
            <input
              type="text"
              className={`form-control ${validationErrors.matricObtainedMarks ? 'is-invalid' : ''}`}
              value={formData.matricQualification.obtainedMarks}
              onChange={(e) => handleQualificationChange('matric', 'obtainedMarks', e.target.value, true)}
              min="0"
              max={formData.matricQualification.totalMarks || ''}
              required
            />
            {validationErrors.matricObtainedMarks && (
              <div className="invalid-feedback">{validationErrors.matricObtainedMarks}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Board/University *</label>
            <input
              type="text"
              className={`form-control ${validationErrors.matricBoard ? 'is-invalid' : ''}`}
              value={formData.matricQualification.boardUniversity}
              onChange={(e) => handleQualificationChange('matric', 'boardUniversity', e.target.value, false, true)}
              required
            />
            {validationErrors.matricBoard && (
              <div className="invalid-feedback">{validationErrors.matricBoard}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Certificate/Transcript *</label>
            <input
              type="file"
              className={`form-control ${validationErrors.matricDocument ? 'is-invalid' : ''}`}
              onChange={(e) => handleQualificationFileChange('matric', e)}
              accept=".pdf,.jpg,.png"
              required
            />
            {validationErrors.matricDocument && (
              <div className="invalid-feedback">{validationErrors.matricDocument}</div>
            )}
            <small className="text-muted">(Max 2MB, PDF, JPG, PNG)</small>
          </div>
        </div>
        
        {/* Intermediate/A-Level Section */}
        <h5 className="mb-3 mt-4">Intermediate/A-Level</h5>
        <div className="row">
          <div className="col-md-6 mb-3">
            <label className="form-label">Institution *</label>
            <input
              type="text"
              className={`form-control ${validationErrors.interInstitution ? 'is-invalid' : ''}`}
              value={formData.intermediateQualification.institution}
              onChange={(e) => handleQualificationChange('intermediate', 'institution', e.target.value, false, true)}
              required
            />
            {validationErrors.interInstitution && (
              <div className="invalid-feedback">{validationErrors.interInstitution}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Year *</label>
            <input
              type="text"
              className={`form-control ${validationErrors.interYear ? 'is-invalid' : ''}`}
              value={formData.intermediateQualification.year}
              onChange={(e) => handleQualificationChange('intermediate', 'year', e.target.value, true)}
              onBlur={(e) => handleYearBlur('intermediate', e.target.value)}
              min="1900"
              max={new Date().getFullYear()}
              maxLength="4"
              required
            />
            {validationErrors.interYear && (
              <div className="invalid-feedback">{validationErrors.interYear}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Total Marks *</label>
            <input
              type="text"
              className={`form-control ${validationErrors.interTotalMarks ? 'is-invalid' : ''}`}
              value={formData.intermediateQualification.totalMarks}
              onChange={(e) => handleQualificationChange('intermediate', 'totalMarks', e.target.value, true)}
              min="1"
              required
            />
            {validationErrors.interTotalMarks && (
              <div className="invalid-feedback">{validationErrors.interTotalMarks}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Obtained Marks *</label>
            <input
              type="text"
              className={`form-control ${validationErrors.interObtainedMarks ? 'is-invalid' : ''}`}
              value={formData.intermediateQualification.obtainedMarks}
              onChange={(e) => handleQualificationChange('intermediate', 'obtainedMarks', e.target.value, true)}
              min="0"
              max={formData.intermediateQualification.totalMarks || ''}
              required
            />
            {validationErrors.interObtainedMarks && (
              <div className="invalid-feedback">{validationErrors.interObtainedMarks}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Board/University *</label>
            <input
              type="text"
              className={`form-control ${validationErrors.interBoard ? 'is-invalid' : ''}`}
              value={formData.intermediateQualification.boardUniversity}
              onChange={(e) => handleQualificationChange('intermediate', 'boardUniversity', e.target.value, false, true)}
              required
            />
            {validationErrors.interBoard && (
              <div className="invalid-feedback">{validationErrors.interBoard}</div>
            )}
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label">Certificate/Transcript *</label>
            <input
              type="file"
              className={`form-control ${validationErrors.intermediateDocument ? 'is-invalid' : ''}`}
              onChange={(e) => handleQualificationFileChange('intermediate', e)}
              accept=".pdf,.jpg,.png"
              required
            />
            {validationErrors.intermediateDocument && (
              <div className="invalid-feedback">{validationErrors.intermediateDocument}</div>
            )}
            <small className="text-muted">(Max 2MB, PDF, JPG, PNG)</small>
          </div>
        </div>

        <div className="d-flex justify-content-end align-items-center gap-2 mt-4 mb-10">
          <Button 
            htmlType="submit"
            type="primary"
            icon={<SaveOutlined />}
            className="btn btn-primary"
            disabled={loading}
            size="large"
          >
            {loading ? 'Submitting...' : 'Save Student'}
          </Button>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>

      <ToastContainer position="top-right" autoClose={5000} />
    </div>
  );
};

export default StudentEnrollmentPage;