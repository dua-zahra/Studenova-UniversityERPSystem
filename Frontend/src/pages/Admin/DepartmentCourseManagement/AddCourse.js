import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Button } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import "../../../assets/style.css";

const emptyCourse = { courseName: '', courseCode: '', creditHrs: 1, type: 'Core' };
const emptySemester = { semesterNumber: 1, courses: [{ ...emptyCourse }] };

export default function AddCoursesForm() {
  const [degreeLevel, setDegreeLevel] = useState('');
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState([]);
  const [semesters, setSemesters] = useState([{ ...emptySemester }]);
  const [loading, setLoading] = useState(false);
  const [creditData, setCreditData] = useState({ limits: {}, used: {}, maxSemester: null });
  const [degreeConfig, setDegreeConfig] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [degreeLevels, setDegreeLevels] = useState([]);
  const [isLoadingDegreeLevels, setIsLoadingDegreeLevels] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const levelsRes = await axios.get('http://localhost:65000/api/degree-levels');
        setDegreeLevels(levelsRes.data);
        setIsLoadingDegreeLevels(false);

        const configRes = await axios.get('http://localhost:65000/api/degree-config');
        setDegreeConfig(configRes.data);
      } catch (err) {
        console.error('Error fetching initial data:', err);
        toast.error('Failed to load degree configuration');
        setIsLoadingDegreeLevels(false);
      }
    };

    fetchInitialData();
  }, []);

  const currentConfig = degreeConfig ? degreeConfig[degreeLevel] : null;

  const handleDegreeChange = (e) => {
    const newDegreeLevel = e.target.value;
    setDegreeLevel(newDegreeLevel);
    setDepartment('');
    setSemesters([{ ...emptySemester }]);
    
    if (degreeConfig && newDegreeLevel) {
      setCreditData(prev => ({
        ...prev,
        maxSemester: degreeConfig[newDegreeLevel]?.maxSemesters || null
      }));
    }
  };

  const handleDepartmentChange = (e) => {
    const selectedDepartment = e.target.value;
    setDepartment(selectedDepartment);
  };

  useEffect(() => {
    if (!degreeLevel) {
      setDepartments([]);
      setDepartment('');
      return;
    }

    const fetchDepartments = async () => {
      try {
        setLoading(true);
        const res = await axios.get('http://localhost:65000/api/departments/by-degree', {
          params: { degreeLevel }
        });
        setDepartments(res.data.departments || []);
      } catch (err) {
        console.error('Error fetching departments:', err);
        toast.error('Failed to fetch departments');
        setDepartments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDepartments();
  }, [degreeLevel]);

  useEffect(() => {
    async function fetchCreditData() {
      if (!degreeLevel || !degreeConfig) return;

      try {
        setLoading(true);
        let maxSemester = degreeConfig[degreeLevel]?.maxSemesters || null;
        let limits = {};
        let used = {};

        if (department) {
          const res = await axios.get('http://localhost:65000/api/semester-credits', {
            params: { degreeLevel, department }
          });
          limits = res.data.limits || {};
          used = res.data.used || {};
          maxSemester = res.data.maxSemester || maxSemester;
        }

        setCreditData({
          limits,
          used,
          maxSemester
        });
      } catch (error) {
        console.error('Error fetching credit data:', error);
        toast.error('Failed to fetch semester credit data');
        setCreditData({
          limits: {},
          used: {},
          maxSemester: degreeConfig[degreeLevel]?.maxSemesters || null
        });
      } finally {
        setLoading(false);
      }
    }

    fetchCreditData();
  }, [degreeLevel, department, degreeConfig]);
  
  const addSemester = () => {
    if (!degreeLevel || !currentConfig) {
      toast.error('Please select a degree level first');
      return;
    }

    const maxAllowed = creditData.maxSemester || currentConfig.maxSemesters;
    
    if (semesters.length >= maxAllowed) {
      toast.warning(`Maximum ${maxAllowed} semesters allowed for ${degreeLevel}`);
      return;
    }

    const usedSemesterNumbers = semesters.map(s => s.semesterNumber);
    let nextSemesterNumber = 1;
    
    while (usedSemesterNumbers.includes(nextSemesterNumber)) {
      nextSemesterNumber++;
    }

    setSemesters([...semesters, { 
      semesterNumber: nextSemesterNumber,
      courses: [{ ...emptyCourse }] 
    }]);
  };

  const removeSemester = (index) => {
    setSemesters(semesters.filter((_, i) => i !== index));
  };

  const handleSemesterNumberChange = (index, value) => {
    const numValue = Number(value);
    const maxSemester = creditData.maxSemester || currentConfig?.maxSemesters;
    if (numValue < 1 || numValue > maxSemester) return;
    
    const newSemesters = [...semesters];
    newSemesters[index].semesterNumber = numValue;
    setSemesters(newSemesters);
  };

  const addCourse = (semesterIndex) => {
    const newSemesters = [...semesters];
    newSemesters[semesterIndex].courses.push({ ...emptyCourse });
    setSemesters(newSemesters);
  };

  const removeCourse = (semesterIndex, courseIndex) => {
    const newSemesters = [...semesters];
    if (newSemesters[semesterIndex].courses.length === 1) return;
    newSemesters[semesterIndex].courses.splice(courseIndex, 1);
    setSemesters(newSemesters);
  };

  const validateCourseName = (name) => {
    return /^[a-zA-Z\s\-&]+$/.test(name);
  };

  const validateCourseCode = (code) => {
    return /^[a-zA-Z0-9]+$/.test(code);
  };

  const handleCourseChange = (semesterIndex, courseIndex, field, value) => {
    const newSemesters = [...semesters];
    
    if (field === 'creditHrs') {
      const numValue = Number(value);
      if (currentConfig?.creditRange) {
        if (value === '' || (numValue >= currentConfig.creditRange[0] && numValue <= currentConfig.creditRange[1])) {
          newSemesters[semesterIndex].courses[courseIndex][field] = value === '' ? '' : numValue;
        } else {
          toast.error(`Credit hours must be between ${currentConfig.creditRange[0]} and ${currentConfig.creditRange[1]}`);
          return;
        }
      } else {
        newSemesters[semesterIndex].courses[courseIndex][field] = numValue;
      }
    } else if (field === 'courseName') {
      if (value === '' || validateCourseName(value)) {
        newSemesters[semesterIndex].courses[courseIndex][field] = value;
      } else {
        toast.error('Please input valid characters');
        return;
      }
    } else if (field === 'courseCode') {
      if (value === '' || validateCourseCode(value)) {
        newSemesters[semesterIndex].courses[courseIndex][field] = value;
      } else {
        toast.error('Please input valid characters');
        return;
      }
    } else {
      newSemesters[semesterIndex].courses[courseIndex][field] = value;
    }
    
    setSemesters(newSemesters);
  };

  const totalCreditsForSemester = (sem) => 
    sem.courses.reduce((sum, c) => sum + c.creditHrs, 0);

  const totalCreditsForDepartment = (semesters) => 
    semesters.reduce((sum, sem) => sum + totalCreditsForSemester(sem), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!degreeLevel) {
      toast.error('Please select a degree level');
      setIsSubmitting(false);
      return;
    }

    if (!department) {
      toast.error('Please select a department');
      setIsSubmitting(false);
      return;
    }

    if (!currentConfig) {
      toast.error('Degree configuration not loaded yet');
      setIsSubmitting(false);
      return;
    }

    const maxSemester = creditData.maxSemester || currentConfig.maxSemesters;
    for (const sem of semesters) {
      if (sem.semesterNumber < 1 || sem.semesterNumber > maxSemester) {
        toast.error(`Semester number must be between 1 and ${maxSemester}`);
        setIsSubmitting(false);
        return;
      }
    }

    for (const sem of semesters) {
      for (const c of sem.courses) {
        if (!c.courseName.trim() || !c.courseCode.trim() || !c.type) {
          toast.error('Fill all course fields');
          setIsSubmitting(false);
          return;
        }
        if (!validateCourseName(c.courseName)) {
          toast.error('Please input valid characters)');
          setIsSubmitting(false);
          return;
        }
        if (!validateCourseCode(c.courseCode)) {
          toast.error('Please input valid characters');
          setIsSubmitting(false);
          return;
        }
        if (c.creditHrs < currentConfig.creditRange[0] || c.creditHrs > currentConfig.creditRange[1]) {
          toast.error(`Credit hours must be between ${currentConfig.creditRange[0]} and ${currentConfig.creditRange[1]}`);
          setIsSubmitting(false);
          return;
        }
      }
    }

    for (const sem of semesters) {
      const currentTotal = totalCreditsForSemester(sem);
      const maxLimit = creditData.limits[sem.semesterNumber] || 0;
      const usedFromDB = creditData.used[sem.semesterNumber] || 0;
      const combinedTotal = currentTotal + usedFromDB;

      if (maxLimit === 0) {
        toast.warning(`No credit limit found for semester ${sem.semesterNumber}, skipping limit check`);
      } else if (combinedTotal > maxLimit) {
        toast.error(
          `Semester ${sem.semesterNumber} would reach ${combinedTotal} credits ` +
          `(limit ${maxLimit}). Existing: ${usedFromDB}, New: ${currentTotal}`
        );
        setIsSubmitting(false);
        return;
      }
    }

    const departmentTotal = totalCreditsForDepartment(semesters);
    if (departmentTotal > currentConfig.maxDepartmentCredits) {
      toast.error(`Total department credit hours exceed ${currentConfig.maxDepartmentCredits} (${departmentTotal}/${currentConfig.maxDepartmentCredits})`);
      setIsSubmitting(false);
      return;
    }

    const allCourses = semesters.flatMap((sem) => sem.courses);
    const courseCodes = new Set();
    const courseNames = new Set();

    for (const c of allCourses) {
      const code = c.courseCode.trim().toLowerCase();
      const name = c.courseName.trim().toLowerCase();
      
      if (courseCodes.has(code)) {
        toast.error(`Duplicate course code found across semesters: ${c.courseCode}`);
        setIsSubmitting(false);
        return;
      }
      if (courseNames.has(name)) {
        toast.error(`Duplicate course name found across semesters: ${c.courseName}`);
        setIsSubmitting(false);
        return;
      }
      courseCodes.add(code);
      courseNames.add(name);
    }

    try {
      setLoading(true);
      const payload = { 
        degreeLevel, 
        department: department.trim(),
        semesters 
      };
      
      await axios.post('http://localhost:65000/api/courses', payload);
      toast.success('Courses saved successfully');
      
      const res = await axios.get('http://localhost:65000/api/semester-credits', {
        params: { degreeLevel, department }
      });
      setCreditData({
        limits: res.data.limits || {},
        used: res.data.used || {},
        maxSemester: res.data.maxSemester || currentConfig.maxSemesters
      });
    } catch (error) {
      console.error('Submission error:', error);
      toast.error(error.response?.data?.message || 'Error saving courses');
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  const maxSemesterDisplay = creditData.maxSemester || currentConfig?.maxSemesters || 'N/A';

  return (
    <div className="add-course container mt-5">
      <h2 className="add-course-title">Add Courses</h2>

      <form onSubmit={handleSubmit} className="add-course-form">
        <div className="form-row">
          <div className="form-group">
            <label>Degree Level</label>
            <select 
              value={degreeLevel} 
              onChange={handleDegreeChange} 
              required
              disabled={isSubmitting || isLoadingDegreeLevels}
            >
              <option value="">Select Degree Level</option>
              {degreeLevels.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            {isLoadingDegreeLevels && <p className="loading-text">Loading degree levels...</p>}
          </div>

          <div className="form-group">
            <label>Department</label>
            <select 
              value={department} 
              onChange={handleDepartmentChange} 
              required
              disabled={!degreeLevel || isSubmitting}
            >
              <option value="">{departments.length ? 'Select Department' : 'Select degree level first'}</option>
              {departments.map((d) => (
                <option key={d._id} value={d.departmentName}>
                  {d.departmentName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading && <p className="loading-text">Loading credit data...</p>}

        {semesters.map((semester, sIndex) => {
          const semesterNumber = semester.semesterNumber;
          const currentTotal = totalCreditsForSemester(semester);
          const maxLimit = creditData.limits[semesterNumber] || 0;
          const usedFromDB = creditData.used[semesterNumber] || 0;
          const remaining = maxLimit - (usedFromDB + currentTotal);
          const maxSemester = creditData.maxSemester || currentConfig?.maxSemesters;

          return (
            <div key={sIndex} className="semester-box">
              <div className="semester-header">
                <div className="semester-info">
                  <label>
                    Semester Number 
                    {degreeLevel && ` (1-${maxSemester})`}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={maxSemester}
                    value={semester.semesterNumber}
                    onChange={(e) => handleSemesterNumberChange(sIndex, e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="credit-info">
                  <div>
                    <strong>Current: {currentTotal} credits</strong>
                  </div>
                  <div>
                    <strong>Existing: {usedFromDB} credits</strong>
                  </div>
                  <div>
                    <strong>Limit: {maxLimit} credits</strong>
                    {maxLimit > 0 && (
                      <span style={{ 
                        marginLeft: '10px', 
                        color: remaining >= 0 ? '#28a745' : '#dc3545',
                        fontWeight: 'bold'
                      }}>
                        ({Math.abs(remaining)} {remaining >= 0 ? 'remaining' : 'over limit'})
                      </span>
                    )}
                  </div>
                </div>

                {semesters.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSemester(sIndex)}
                    className="remove-sem-btn"
                    disabled={isSubmitting}
                  >
                    Remove Semester
                  </button>
                )}
              </div>

              {semester.courses.map((course, cIndex) => (
                <div key={cIndex} className="course-grid">
                  <input
                    type="text"
                    placeholder="Course Name"
                    value={course.courseName}
                    onChange={(e) => handleCourseChange(sIndex, cIndex, 'courseName', e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                  <input
                    type="text"
                    placeholder="Course Code "
                    value={course.courseCode}
                    onChange={(e) => handleCourseChange(sIndex, cIndex, 'courseCode', e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                  <input
                    type="number"
                    placeholder="Credit Hours"
                    min={currentConfig?.creditRange?.[0] || 1}
                    max={currentConfig?.creditRange?.[1] || 4}
                    value={course.creditHrs}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || (!isNaN(value) && 
                          (currentConfig?.creditRange 
                            ? value >= currentConfig.creditRange[0] && value <= currentConfig.creditRange[1]
                            : true))) {
                        handleCourseChange(sIndex, cIndex, 'creditHrs', value);
                      }
                    }}
                    required
                    disabled={isSubmitting}
                  />
                  <select
                    value={course.type}
                    onChange={(e) => handleCourseChange(sIndex, cIndex, 'type', e.target.value)}
                    disabled={isSubmitting}
                  >
                    <option value="Core">Core</option>
                    <option value="Elective">Elective</option>
                  </select>

                  {semester.courses.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCourse(sIndex, cIndex)}
                      className="remove-course-btn"
                      disabled={isSubmitting}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => addCourse(sIndex)}
                className="add-course-btn"
                disabled={isSubmitting}
              >
                + Add Course
              </button>
            </div>
          );
        })}

        <div className="form-actions">
          <div className="add-semester-wrapper">
            <button
              type="button"
              onClick={addSemester}
              disabled={!degreeLevel || semesters.length >= (creditData.maxSemester || currentConfig?.maxSemesters || Infinity) || isSubmitting}
              className="add-semester-btn"
            >
              + Add Semester {degreeLevel && department && `(Max ${maxSemesterDisplay})`}
            </button>
          </div>

          <div className="submit-cancel-wrapper">
            <Button 
              htmlType="submit"
              type="primary"
              icon={<SaveOutlined />}
              disabled={loading || isSubmitting} 
              className="submit-btn"
            >
              {loading || isSubmitting ? 'Saving...' : 'Save Courses'}
            </Button>
            <button
              type="button"
              onClick={() => {
                setDegreeLevel('');
                setDepartment('');
                setSemesters([{ ...emptySemester }]);
                setCreditData({ limits: {}, used: {}, maxSemester: null });
              }}
              className="cancel-btn"
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        pauseOnFocusLoss={false}  
        draggable
        pauseOnHover
        theme="colored"
      />
    </div>
  );
}