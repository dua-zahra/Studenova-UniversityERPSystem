import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { addDays, subMonths, format, parseISO } from 'date-fns';
import { Button } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import "../../../assets/style.css";
import API_URL from '../../../config';

const AddBatch = ({ existingBatch }) => {
  const currentYear = new Date().getFullYear();
  
  const [formData, setFormData] = useState({
    degreeLevel: existingBatch?.degreeLevel || '',
    departmentName: existingBatch?.departmentName || '',
    enrollmentYear: existingBatch?.enrollmentYear || currentYear,
    semesterStart: existingBatch?.semesterStart || 'spring',
    totalSemesters: existingBatch?.totalSemesters || 8,
    admissionStartDate: existingBatch?.admissionStartDate 
      ? format(parseISO(existingBatch.admissionStartDate), 'yyyy-MM-dd')
      : '',
    admissionEndDate: existingBatch?.admissionEndDate 
      ? format(parseISO(existingBatch.admissionEndDate), 'yyyy-MM-dd')
      : '',
    graduationYear: existingBatch?.graduationYear || currentYear + 4
  });

  const [departments, setDepartments] = useState([]);
  const [degreeLevels, setDegreeLevels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [maxSemesters, setMaxSemesters] = useState(0);
  const [autoSetAdmissionDates, setAutoSetAdmissionDates] = useState(false);

  const calculateSemesterStartDate = () => {
    if (!formData.enrollmentYear || !formData.semesterStart) return null;
    const year = parseInt(formData.enrollmentYear);
    return formData.semesterStart === 'spring'
      ? new Date(year, 2, 14) 
      : new Date(year, 7, 18); // August 18
  };

  const calculateGraduationYear = () => {
    if (!formData.degreeLevel || !formData.enrollmentYear) return currentYear + 4;
    
    const degreeDuration = {
      undergraduate: 4,
      graduate: 2,
      phd: 4
    }[formData.degreeLevel.toLowerCase()] || 4;

    return parseInt(formData.enrollmentYear) + degreeDuration;
  };

  useEffect(() => {
    if (autoSetAdmissionDates) {
      const semesterStartDate = calculateSemesterStartDate();
      if (semesterStartDate) {
        setFormData(prev => ({
          ...prev,
          admissionStartDate: format(subMonths(semesterStartDate, 2), 'yyyy-MM-dd'),
          admissionEndDate: format(addDays(semesterStartDate, 3), 'yyyy-MM-dd')
        }));
      }
    }
  }, [formData.enrollmentYear, formData.semesterStart, autoSetAdmissionDates]);

  useEffect(() => {
    const graduationYear = calculateGraduationYear();
    const totalSemesters = (graduationYear - parseInt(formData.enrollmentYear || currentYear)) * 2;
    
    setFormData(prev => ({
      ...prev,
      graduationYear,
      totalSemesters: Math.min(totalSemesters, maxSemesters || 8)
    }));
  }, [formData.degreeLevel, formData.enrollmentYear, maxSemesters]);

  useEffect(() => {
    const fetchDegreeLevels = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_URL}/api/degree-levels`);
        setDegreeLevels(response.data);
      } catch (error) {
        toast.error('Failed to load degree levels');
      } finally {
        setLoading(false);
      }
    };
    fetchDegreeLevels();
  }, []);

  useEffect(() => {
    if (!formData.degreeLevel) {
      setDepartments([]);
      setFormData(prev => ({ ...prev, departmentName: '' }));
      return;
    }

    const fetchDepartments = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_URL}/api/departments/by-degree`, {
        // const response = await axios.get(`${API_URL}/api/departments/by-degree', {
          params: { degreeLevel: formData.degreeLevel, exactMatch: true }
        });
        setDepartments(response.data.departments || []);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to load departments');
      } finally {
        setLoading(false);
      }
    };
    fetchDepartments();
  }, [formData.degreeLevel]);

  useEffect(() => {
    if (!formData.degreeLevel || !formData.departmentName) return;

    const fetchMaxSemesters = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_URL}/api/semester-credits`, {
        // const response = await axios.get(`${API_URL}/api/semester-credits', {
          params: { degreeLevel: formData.degreeLevel, department: formData.departmentName }
        });
        setMaxSemesters(response.data.maxSemester || 8);
      } catch (error) {
        toast.error('Failed to load semester information');
      } finally {
        setLoading(false);
      }
    };
    fetchMaxSemesters();
  }, [formData.departmentName, formData.degreeLevel]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.degreeLevel) {
      toast.error('Degree level is required');
      return false;
    }
    if (!formData.departmentName) {
      toast.error('Department is required');
      return false;
    }
    if (!formData.enrollmentYear || formData.enrollmentYear < currentYear - 1) {
      toast.error(`Enrollment year must be ${currentYear - 1} or later`);
      return false;
    }
    if (!formData.totalSemesters || formData.totalSemesters < 1 || formData.totalSemesters > maxSemesters) {
      toast.error(`Total semesters must be between 1 and ${maxSemesters}`);
      return false;
    }
    if (!formData.graduationYear || formData.graduationYear <= formData.enrollmentYear) {
      toast.error('Graduation year must be after enrollment year');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const payload = {
        degreeLevel: formData.degreeLevel,
        departmentName: formData.departmentName,
        enrollmentYear: Number(formData.enrollmentYear),
        semesterStart: formData.semesterStart.toLowerCase(),
        totalSemesters: Number(formData.totalSemesters),
        graduationYear: Number(formData.graduationYear),
        currentSemester: 1,
        admissionStartDate: formData.admissionStartDate || null,
        admissionEndDate: formData.admissionEndDate || null
      };

      const url = existingBatch 
        ? `${API_URL}/api/batches/${existingBatch._id}`
        : `${API_URL}/api/batches`;
      
      const method = existingBatch ? 'put' : 'post';
      
      const response = await axios[method](url, payload, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      toast.success(existingBatch ? 'Batch updated successfully' : 'Batch created successfully');
      
      if (!existingBatch) {
        setFormData({
          degreeLevel: formData.degreeLevel,
          departmentName: '',
          enrollmentYear: currentYear,
          semesterStart: 'spring',
          totalSemesters: 8,
          admissionStartDate: '',
          admissionEndDate: '',
          graduationYear: calculateGraduationYear()
        });
      }
    } catch (error) {
      console.error('Submission error:', error);
      const errorMessage = error.response?.data?.message || 
                         error.response?.data?.error || 
                         'Failed to process batch';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      degreeLevel: '',
      departmentName: '',
      enrollmentYear: currentYear,
      semesterStart: 'spring',
      totalSemesters: 8,
      admissionStartDate: '',
      admissionEndDate: '',
      graduationYear: currentYear + 4
    });
    setAutoSetAdmissionDates(false);
  };

  const getBatchPreview = () => {
    if (!formData.departmentName || !formData.degreeLevel) return '';
    const dept = departments.find(d => d.departmentName === formData.departmentName);
    return dept ? `${dept.departmentCode}-${formData.semesterStart.toUpperCase()}-${formData.enrollmentYear}` : '';
  };

  return (
    <div className="add-batch container mt-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="add-batch-title mb-0">
          {existingBatch ? 'Edit Batch' : 'Create New Batch'}
        </h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-row-grid">
          <div className="form-group">
            <label>Degree Level</label>
            <select
              name="degreeLevel"
              value={formData.degreeLevel}
              onChange={handleChange}
              className="form-control"
              required
              disabled={loading || isSubmitting}
            >
              <option value="">Select Degree Level</option>
              {degreeLevels.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="form-row-grid">
          <div className="form-group">
            <label>Department Name</label>
            <select
              name="departmentName"
              value={formData.departmentName}
              onChange={handleChange}
              className="form-control"
              required
              disabled={!formData.degreeLevel || loading || isSubmitting}
            >
              <option value="">{departments.length ? 'Select Department' : 'Select degree level first'}</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept.departmentName}>
                  {dept.departmentName} ({dept.departmentCode})
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="form-row-grid">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="block mb-1 font-medium">Enrollment Year</label>
              <input
                type="number"
                name="enrollmentYear"
                value={formData.enrollmentYear}
                className="form-control"
                onChange={handleChange}
                min={currentYear - 1}
                max="2100"
                
                required
              />
            </div>
            
            <div className="form-group">
              <label>Starting Semester</label>
              <select
                name="semesterStart"
                value={formData.semesterStart}
                className="form-control"
                onChange={handleChange}
                required
              >
                <option value="spring">Spring</option>
                <option value="fall">Fall</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="form-row-grid">
          <div className="form-group">
            <label className="block mb-1 font-medium">Graduation Year</label>
            <input
              type="number"
              name="graduationYear"
              value={formData.graduationYear}
              onChange={handleChange}
              min={formData.enrollmentYear ? parseInt(formData.enrollmentYear) + 1 : currentYear + 1}
              max="2100"
              className="form-control"
              required
              readOnly={!!formData.degreeLevel}
            />
            <p className="text-xs text-gray-500 mt-1">
              Auto-calculated based on degree level
            </p>
          </div>
        </div>

        <div className="form-row-grid">
          <div className="form-group">
            <label>Total Semesters</label>
            <input
              type="number"
              name="totalSemesters"
              value={formData.totalSemesters}
              onChange={handleChange}
              min="1"
              max={maxSemesters}
              className="form-control"
              required
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Typically {formData.graduationYear && formData.enrollmentYear 
                ? (formData.graduationYear - formData.enrollmentYear) * 2 
                : '8'} semesters
            </p>
          </div>
        </div>
        
        <div className="form-row-grid">
          <div className="form-group">
            <label className="block mb-1 font-medium">Batch Name</label>
            <input
              type="text"
              value={getBatchPreview()}
              readOnly
              className="form-control"
            />
          </div>
        </div>
        
        <div className="form-row-grid">
          <div className="form-group">
             <div className="checkbox-row">
      <input
        type="checkbox"
        checked={autoSetAdmissionDates}
        onChange={() => setAutoSetAdmissionDates(!autoSetAdmissionDates)}
        className="form-checkbox"
        id="autoAdmission"
      />
      <label htmlFor="autoAdmission" className="form-checkbox-label">
        Auto-set Admission Dates
        <span className="admission-box">
          {autoSetAdmissionDates ? '(Will start 2 months before semester)' : ''}
        </span>
      </label>
    </div>
            
            <label className="block mb-1 font-medium">Admission Start Date</label>
            <input
              type="date"
              name="admissionStartDate"
              value={formData.admissionStartDate}
              onChange={handleChange}
              min={`${formData.enrollmentYear-1}-01-01`}
              max={`${formData.enrollmentYear}-12-31`}
              className="form-control"
              disabled={autoSetAdmissionDates}
            />
            {!autoSetAdmissionDates && (
              <p className="text-xs text-gray-500 mt-1">
                Must be 1-3 months before semester starts
              </p>
            )}
          </div>
          
          <div className="form-group">
            <label className="block mb-1 font-medium">Admission End Date</label>
            <input
              type="date"
              name="admissionEndDate"
              value={formData.admissionEndDate}
              onChange={handleChange}
              min={formData.admissionStartDate || `${formData.enrollmentYear}-01-01`}
              max={`${formData.enrollmentYear}-12-31`}
              className="form-control"
              disabled={autoSetAdmissionDates}
            />
            {!autoSetAdmissionDates && (
              <p className="text-xs text-gray-500 mt-1">
                Must be exactly 3 days after semester starts
              </p>
            )}
          </div>
        </div>
        
        <div className="d-flex justify-content-end align-items-center gap-2 mt-4">
         <Button 
  type="primary"
  htmlType="submit"
  disabled={isSubmitting}
  icon={<SaveOutlined />}
  loading={isSubmitting}
  className="save-button"
>
  {existingBatch ? 'Update Batch' : 'Save Batch'}
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

      <ToastContainer position="top-right" />
    </div>
  );
};

export default AddBatch;

