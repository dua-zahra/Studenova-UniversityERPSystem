const mongoose = require('mongoose');

const facultyTimeSlotSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    required: true
  },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  courseCode: { type: String, required: true },
  courseName: { type: String, required: true },
  sectionName: { type: String, required: true },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
  batchName: { type: String, required: true },
  semester: { type: Number, required: true },
  room: { type: String, required: true },
  classType: {
    type: String,
    enum: ['lecture', 'lab', 'tutorial'],
    default: 'lecture'
  },
  isActive: { type: Boolean, default: true },
  timetableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Timetable', required: true }
}, { timestamps: true });

const facultyTimetableSchema = new mongoose.Schema({
  facultyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Faculty', 
    required: true 
  },
  facultyName: { type: String, required: true },
  semester: { type: Number, required: true },
  academicYear: { type: String, required: true },
  timeSlots: [facultyTimeSlotSchema],
  totalWeeklyHours: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now },
  publishedAt: { type: Date },
  version: { type: Number, default: 1 }
}, { timestamps: true });

facultyTimetableSchema.index({ facultyId: 1, semester: 1, isActive: 1 });
facultyTimetableSchema.index({ 'timeSlots.batchId': 1 });
facultyTimetableSchema.index({ 'timeSlots.courseCode': 1 });

facultyTimetableSchema.statics.upsertFacultyTimetable = async function(facultyId, facultyName, timetable, session = null) {
  try {
    if (timetable.status !== 'published') {
      console.log(`⏸ Skipping faculty timetable update - timetable is not published (status: ${timetable.status})`);
      return null;
    }

    console.log(`Creating/updating faculty timetable for ${facultyName} (ID: ${facultyId})`);
    const facultySlots = timetable.timeSlots.filter(slot => 
      slot.isActive && 
      slot.facultyId && 
      slot.facultyId.toString() === facultyId.toString()
    );

    if (facultySlots.length === 0) {
      console.log(`No active time slots found for faculty ${facultyName} in published timetable`);
      await this.deactivateFacultyTimetable(facultyId, timetable.semester, session);
      return null;
    }

    const totalWeeklyHours = facultySlots.reduce((total, slot) => {
      const start = parseInt(slot.startTime.replace(':', ''));
      const end = parseInt(slot.endTime.replace(':', ''));
      const duration = (end - start) / 100; // Convert to hours
      return total + duration;
    }, 0);

    let facultyTimetable = await this.findOne({
      facultyId: facultyId,
      semester: timetable.semester,
      isActive: true
    }).session(session);

    if (facultyTimetable) {
      facultyTimetable.facultyName = facultyName;
      facultyTimetable.academicYear = timetable.academicYear;
      facultyTimetable.totalWeeklyHours = totalWeeklyHours;
      facultyTimetable.lastUpdated = new Date();
      facultyTimetable.publishedAt = timetable.lastPublishedAt;
      facultyTimetable.version += 1;

      facultyTimetable.timeSlots = [];

      facultySlots.forEach(slot => {
        facultyTimetable.timeSlots.push({
          day: slot.day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          courseCode: slot.courseCode,
          courseName: slot.courseName,
          sectionName: slot.sectionName,
          batchId: timetable.batchId,
          batchName: timetable.batchId.batchName, 
          semester: timetable.semester,
          room: slot.room,
          classType: slot.classType,
          isActive: true,
          timetableId: timetable._id
        });
      });
    } else {
      facultyTimetable = new this({
        facultyId: facultyId,
        facultyName: facultyName,
        semester: timetable.semester,
        academicYear: timetable.academicYear,
        totalWeeklyHours: totalWeeklyHours,
        isActive: true,
        publishedAt: timetable.lastPublishedAt,
        timeSlots: facultySlots.map(slot => ({
          day: slot.day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          courseCode: slot.courseCode,
          courseName: slot.courseName,
          sectionName: slot.sectionName,
          batchId: timetable.batchId,
          batchName: timetable.batchId.batchName,
          semester: timetable.semester,
          room: slot.room,
          classType: slot.classType,
          isActive: true,
          timetableId: timetable._id
        }))
      });
    }

    await facultyTimetable.save({ session });
    console.log(` Faculty timetable updated for ${facultyName} with ${facultySlots.length} time slots`);

    return facultyTimetable;
  } catch (error) {
    console.error('Error upserting faculty timetable:', error);
    throw error;
  }
};

facultyTimetableSchema.statics.deactivateFacultySlots = async function(facultyId, batchId, semester, courseCode, sectionName, session = null) {
  try {
    const result = await this.updateMany(
      {
        facultyId: facultyId,
        semester: semester,
        'timeSlots.batchId': batchId,
        'timeSlots.courseCode': courseCode,
        'timeSlots.sectionName': sectionName,
        'timeSlots.isActive': true
      },
      {
        $set: {
          'timeSlots.$[elem].isActive': false
        }
      },
      {
        arrayFilters: [
          { 
            'elem.batchId': batchId,
            'elem.courseCode': courseCode,
            'elem.sectionName': sectionName,
            'elem.isActive': true
          }
        ],
        session
      }
    );

    console.log(`Deactivated faculty slots for ${facultyId}, ${courseCode}-${sectionName}`);

    await this.recalculateWeeklyHours(facultyId, semester, session);

    return result;
  } catch (error) {
    console.error('Error deactivating faculty slots:', error);
    throw error;
  }
};

facultyTimetableSchema.statics.deactivateAllFacultySlots = async function(facultyId, session = null) {
  try {
    const result = await this.updateMany(
      {
        facultyId: facultyId,
        'timeSlots.isActive': true
      },
      {
        $set: {
          'timeSlots.$[].isActive': false
        }
      },
      { session }
    );

    await this.updateMany(
      { facultyId: facultyId, isActive: true },
      { isActive: false },
      { session }
    );

    console.log(`Deactivated ALL faculty slots and timetables for ${facultyId}`);
    return result;
  } catch (error) {
    console.error('Error deactivating all faculty slots:', error);
    throw error;
  }
};

facultyTimetableSchema.statics.deactivateFacultyTimetable = async function(facultyId, semester, session = null) {
  try {
    const result = await this.updateOne(
      {
        facultyId: facultyId,
        semester: semester,
        isActive: true
      },
      {
        isActive: false,
        timeSlots: []
      },
      { session }
    );

    console.log(` Deactivated faculty timetable for ${facultyId}, semester ${semester}`);
    return result;
  } catch (error) {
    console.error('Error deactivating faculty timetable:', error);
    throw error;
  }
};

facultyTimetableSchema.statics.recalculateWeeklyHours = async function(facultyId, semester, session = null) {
  try {
    const facultyTimetable = await this.findOne({
      facultyId: facultyId,
      semester: semester,
      isActive: true
    }).session(session);

    if (!facultyTimetable) return;

    const activeSlots = facultyTimetable.timeSlots.filter(slot => slot.isActive);
    const totalWeeklyHours = activeSlots.reduce((total, slot) => {
      const start = parseInt(slot.startTime.replace(':', ''));
      const end = parseInt(slot.endTime.replace(':', ''));
      const duration = (end - start) / 100;
      return total + duration;
    }, 0);

    facultyTimetable.totalWeeklyHours = totalWeeklyHours;
    await facultyTimetable.save({ session });

    console.log(`Recalculated weekly hours for ${facultyId}: ${totalWeeklyHours} hours`);
  } catch (error) {
    console.error('Error recalculating weekly hours:', error);
    throw error;
  }
};

module.exports = mongoose.model('FacultyTimetable', facultyTimetableSchema);