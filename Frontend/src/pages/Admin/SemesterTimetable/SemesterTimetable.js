import React from 'react';
import ManageTimetable from './ManageTimetable';
import PublishedTimetable from './PublishedTimetable';
import API_URL from '../../../config';

const SemesterTimetable = () => {
  return (
    <div>
      <ManageTimetable />
      <PublishedTimetable />
    

    </div>
  );
};

export default SemesterTimetable;
