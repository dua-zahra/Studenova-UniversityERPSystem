module.exports = (req, res, next) => {
    const {
      courseName,
      courseCode,
      departments,
      courseType,
      courseDuration,
      courseCredits,
      courseLevel,
      prerequisites
    } = req.body;
  
    if (
      !courseName || !courseCode || !departments.length ||
      !courseType || !courseDuration || !courseCredits || !courseLevel
    ) {
      return res.status(400).json({ message: 'Please fill all required fields.' });
    }
  
    for (let dep of departments) {
      if (!dep.department || !dep.semester) {
        return res.status(400).json({ message: 'Each department must have a name and semester.' });
      }
    }
  
    next();
  };
  