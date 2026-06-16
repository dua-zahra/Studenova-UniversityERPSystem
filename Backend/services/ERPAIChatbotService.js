// // backend/services/ERPAIChatbotService.js
// const { OpenAI } = require('openai');
// const mongoose = require('mongoose');

// class ERPAIChatbotService {
//     constructor() {
//         // Initialize OpenAI with correct API key
//         this.openai = new OpenAI({
//             apiKey: process.env.OPENAI_API_KEY
//         });
        
//         // Load all your MongoDB models
//         this.models = {
//             Student: mongoose.model('Student'),
//             StudentFee: mongoose.model('StudentFee'),
//             StudentAttendance: mongoose.model('StudentAttendance'),
//             Timetable: mongoose.model('Timetable'),
//             Result: mongoose.model('Result'),
//             FacultyTask: mongoose.model('FacultyTask'),
//             Batch: mongoose.model('Batch'),
//             CourseEntry: mongoose.model('CourseEntry')
//         };
//     }

//     async processStudentQuery(studentId, question) {
//         try {
//             console.log(`🤖 Processing query for ${studentId}: "${question}"`);
            
//             // Get student from database
//             const student = await this.models.Student.findOne({ studentId });
//             if (!student) {
//                 return "I couldn't find your student record. Please check your login.";
//             }

//             // Get comprehensive student data
//             const studentData = await this.compileStudentData(studentId, student);
            
//             // Prepare context for AI
//             const context = this.formatContextForAI(studentData);
            
//             // Call OpenAI API
//             const response = await this.openai.chat.completions.create({
//                 model: "gpt-3.5-turbo",  // Use gpt-3.5-turbo for cost efficiency
//                 messages: [
//                     {
//                         role: "system",
//                         content: `You are an AI assistant for a university ERP system. 
//                         Your job is to help students with their academic queries using their personal data.
                        
//                         STUDENT DATA CONTEXT:
//                         ${context}
                        
//                         INSTRUCTIONS:
//                         1. Use ONLY the data provided above
//                         2. If you don't have certain data, say "I don't have that information yet"
//                         3. Be specific and accurate with numbers
//                         4. Format dates nicely (e.g., "January 15, 2024")
//                         5. Use bullet points for lists
//                         6. Be friendly and helpful
//                         7. Don't make up any data
                        
//                         Remember: You can only answer based on the student data provided.`
//                     },
//                     { role: "user", content: question }
//                 ],
//                 temperature: 0.3,
//                 max_tokens: 500
//             });

//             const answer = response.choices[0].message.content;
//             console.log(`✅ Response generated for ${studentId}: ${answer.substring(0, 50)}...`);
            
//             return answer;

//         } catch (error) {
//             console.error("AI Chatbot Error:", error.message);
            
//             // Check for specific errors
//             if (error.message.includes('Invalid API key')) {
//                 return "AI service configuration error. Please contact administrator.";
//             }
            
//             if (error.message.includes('rate limit')) {
//                 return "The AI service is busy. Please try again in a moment.";
//             }
            
//             return "I'm having trouble accessing your data right now. Please try again in a moment.";
//         }
//     }

//     async compileStudentData(studentId, student) {
//         const data = {
//             studentInfo: {
//                 name: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
//                 studentId: student.studentId,
//                 department: student.department,
//                 degreeLevel: student.degreeLevel,
//                 currentSemester: student.currentSemester || 1,
//                 section: student.section,
//                 email: student.universityEmail,
//                 contact: student.contactNumber
//             },
//             academicProgress: {
//                 currentSemester: student.currentSemester || 1,
//                 cumulativeGPA: student.academicProgress?.cumulativeGPA || 0,
//                 totalCreditsEarned: student.academicProgress?.totalCreditsEarned || 0,
//                 totalCreditsRequired: student.academicProgress?.totalCreditsRequired || 0,
//                 completionPercentage: student.academicProgress?.completionPercentage || 0
//             },
//             currentSemesterCourses: [],
//             fees: {},
//             attendance: [],
//             timetable: [],
//             grades: [],
//             tasks: []
//         };

//         try {
//             // Get current semester courses
//             if (student.academicProgress && student.academicProgress.semesters) {
//                 const currentSemester = student.academicProgress.semesters.find(
//                     s => s.semesterNumber === student.currentSemester
//                 );
                
//                 if (currentSemester && currentSemester.courses) {
//                     data.currentSemesterCourses = currentSemester.courses.map(course => ({
//                         courseCode: course.courseCode,
//                         courseName: course.courseName,
//                         credits: course.creditsEarned || 0,
//                         status: course.status,
//                         grade: course.grade
//                     }));
//                 }
//             }

//             // Get fee information
//             try {
//                 const studentFee = await this.models.StudentFee.findOne({ studentId });
//                 if (studentFee) {
//                     data.fees = {
//                         totalDegreeFee: studentFee.totalDegreeFee,
//                         totalPaid: studentFee.totalPaid,
//                         totalDue: studentFee.totalDue,
//                         currentSemesterFee: studentFee.semesterFees?.find(
//                             f => f.semester === student.currentSemester
//                         )
//                     };
//                 }
//             } catch (feeError) {
//                 console.log("Fee data not available:", feeError.message);
//             }

//             // Get attendance
//             try {
//                 const attendance = await this.models.StudentAttendance.findOne({ studentId });
//                 if (attendance && attendance.semesters) {
//                     const currentAttendance = attendance.semesters.find(
//                         s => s.semesterNumber === student.currentSemester
//                     );
//                     if (currentAttendance && currentAttendance.courses) {
//                         data.attendance = currentAttendance.courses.map(course => ({
//                             courseCode: course.courseCode,
//                             percentage: course.percentage || 0,
//                             records: course.attendanceRecords?.length || 0
//                         }));
//                     }
//                 }
//             } catch (attError) {
//                 console.log("Attendance data not available:", attError.message);
//             }

//             // Get timetable
//             try {
//                 if (student.batch) {
//                     const timetable = await this.models.Timetable.findOne({
//                         batchId: student.batch,
//                         semester: student.currentSemester,
//                         isActive: true
//                     });
                    
//                     if (timetable && timetable.timeSlots) {
//                         const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
//                         data.timetable = {
//                             allSlots: timetable.timeSlots
//                                 .filter(slot => slot.isActive)
//                                 .map(slot => ({
//                                     courseCode: slot.courseCode,
//                                     courseName: slot.courseName,
//                                     day: slot.day,
//                                     time: `${slot.startTime} - ${slot.endTime}`,
//                                     room: slot.room,
//                                     teacher: slot.facultyName || 'Not assigned'
//                                 })),
//                             todaySlots: timetable.timeSlots
//                                 .filter(slot => slot.isActive && slot.day.toLowerCase() === today)
//                                 .map(slot => ({
//                                     courseCode: slot.courseCode,
//                                     time: `${slot.startTime} - ${slot.endTime}`,
//                                     room: slot.room
//                                 }))
//                         };
//                     }
//                 }
//             } catch (ttError) {
//                 console.log("Timetable data not available:", ttError.message);
//             }

//             // Get grades
//             try {
//                 const results = await this.models.Result.find({
//                     "results.studentId": studentId
//                 });
                
//                 if (results && results.length > 0) {
//                     data.grades = results.flatMap(result => 
//                         result.results
//                             .filter(r => r.studentId === studentId)
//                             .map(r => ({
//                                 courseCode: result.courseCode,
//                                 courseName: result.courseName,
//                                 grade: r.grade,
//                                 marks: `${r.obtainedMarks || 0}/${r.totalMarks || 100}`,
//                                 percentage: r.totalMarks ? 
//                                     ((r.obtainedMarks / r.totalMarks) * 100).toFixed(1) : 'N/A'
//                             }))
//                     );
//                 }
//             } catch (gradeError) {
//                 console.log("Grade data not available:", gradeError.message);
//             }

//             // Get tasks/assignments
//             try {
//                 const batch = await this.models.Batch.findById(student.batch);
//                 if (batch) {
//                     const tasks = await this.models.FacultyTask.find({
//                         batchName: batch.batchName,
//                         sectionName: student.section,
//                         semester: student.currentSemester.toString()
//                     });
                    
//                     data.tasks = tasks.map(task => ({
//                         courseCode: task.courseCode,
//                         title: task.taskTitle,
//                         description: task.taskDescription,
//                         date: task.createdAt ? new Date(task.createdAt).toLocaleDateString() : 'N/A'
//                     }));
//                 }
//             } catch (taskError) {
//                 console.log("Task data not available:", taskError.message);
//             }

//         } catch (error) {
//             console.error("Error compiling student data:", error.message);
//         }

//         return data;
//     }

//     formatContextForAI(data) {
//         // Format data in a way that's easy for AI to understand
//         const context = `
//         STUDENT PROFILE:
//         - Name: ${data.studentInfo.name}
//         - ID: ${data.studentInfo.studentId}
//         - Department: ${data.studentInfo.department}
//         - Current Semester: ${data.studentInfo.currentSemester}
//         - Section: ${data.studentInfo.section}
        
//         ACADEMIC PROGRESS:
//         - Cumulative GPA: ${data.academicProgress.cumulativeGPA}
//         - Credits Earned: ${data.academicProgress.totalCreditsEarned} / ${data.academicProgress.totalCreditsRequired}
//         - Completion: ${data.academicProgress.completionPercentage}%
        
//         CURRENT SEMESTER COURSES (${data.currentSemesterCourses.length} courses):
//         ${data.currentSemesterCourses.map(c => `  • ${c.courseCode}: ${c.courseName} (${c.credits} credits, Status: ${c.status}, Grade: ${c.grade || 'N/A'})`).join('\n')}
        
//         FEES STATUS:
//         - Total Degree Fee: $${data.fees.totalDegreeFee || 0}
//         - Total Paid: $${data.fees.totalPaid || 0}
//         - Total Due: $${data.fees.totalDue || 0}
//         ${data.fees.currentSemesterFee ? `- Current Semester Fee: $${data.fees.currentSemesterFee.totalFee || 0}` : ''}
        
//         ATTENDANCE (${data.attendance.length} courses):
//         ${data.attendance.map(a => `  • ${a.courseCode}: ${a.percentage}% (${a.records} records)`).join('\n')}
        
//         TIMETABLE:
//         ${data.timetable && data.timetable.allSlots ? 
//             `Total slots: ${data.timetable.allSlots.length}\n` +
//             data.timetable.allSlots.map(s => `  • ${s.day}: ${s.courseCode} (${s.time}) in ${s.room} by ${s.teacher}`).join('\n')
//             : 'No timetable data available'}
        
//         GRADES (${data.grades.length} courses):
//         ${data.grades.map(g => `  • ${g.courseCode}: ${g.grade} (${g.marks}, ${g.percentage}%)`).join('\n')}
        
//         TASKS/ASSIGNMENTS (${data.tasks.length} items):
//         ${data.tasks.map(t => `  • ${t.courseCode}: ${t.title} - ${t.description} (${t.date})`).join('\n')}
//         `;
        
//         return context;
//     }

//     // Helper method for complex queries
//     async processComplexQuery(studentId, question) {
//         // For now, use the simple approach
//         return await this.processStudentQuery(studentId, question);
//     }
// }

// module.exports = new ERPAIChatbotService();



// frontend/src/services/AIChatbotService.js
// backend/services/DynamicAIDrivenChatbot.js











// const ContextAwareChatbotController = require('../controllers/chatbot/chatbotController');

// class EnhancedERPAIChatbotService {
//   constructor() {
//     this.chatbot = ContextAwareChatbotController;
//     console.log('🤖 Enhanced ERP AI Chatbot Service initialized');
//   }

//   async processQuery(userId, question, studentId) {
//     try {
//       console.log(`📨 Chat request: ${studentId} - "${question.substring(0, 50)}..."`);
      
//       const response = await this.chatbot.processQuery(userId, question, studentId);
      
//       return {
//         ...response,
//         metadata: {
//           ...response.metadata,
//           service: 'Enhanced Chatbot',
//           version: '2.1.0'
//         }
//       };
      
//     } catch (error) {
//       console.error('Chatbot service error:', error);
      
//       return {
//         text: `I'm having trouble processing your request. Please try again in a moment.`,
//         error: process.env.NODE_ENV === 'development' ? error.message : undefined,
//         suggestions: [
//           'Ask about fees',
//           'Check attendance',
//           'View academic progress',
//           'See course information'
//         ],
//         metadata: {
//           error: error.message,
//           timestamp: new Date().toISOString()
//         }
//       };
//     }
//   }

//   clearStudentSession(studentId) {
//     // Clear all sessions for this student
//     this.chatbot.userSessions.forEach((session, sessionId) => {
//       if (sessionId.includes(studentId)) {
//         this.chatbot.clearSession(sessionId);
//       }
//     });
    
//     console.log(`🧹 Cleared all sessions for student: ${studentId}`);
//   }

//   getStats() {
//     return this.chatbot.getSessionStats();
//   }
// }

// // Export singleton
// module.exports = new EnhancedERPAIChatbotService();


// const { OpenAI } = require('openai');
// const mongoose = require('mongoose');

// class DynamicAIDrivenChatbot {
//     constructor() {
//         this.openai = new OpenAI({
//             apiKey: process.env.OPENAI_API_KEY
//         });
        
//         this.models = this.initializeModels();
//         this.chatSessions = new Map();
//         this.systemPrompt = this.createDynamicSystemPrompt();
//         this.studentIdCache = new Map(); // Cache for user ID to student ID mapping
//     }
    
//     initializeModels() {
//         return {
//             Student: mongoose.model('Student'),
//             StudentFee: mongoose.model('StudentFee'),
//             UniversityExpenses: mongoose.model('UniversityExpense'),
//             StudentAttendance: mongoose.model('StudentAttendance'),
//             Timetable: mongoose.model('Timetable'),
//             Result: mongoose.model('Result'),
//             StudentResults: mongoose.model('StudentResults'),
//             FacultyTask: mongoose.model('FacultyTask'),
//             Batch: mongoose.model('Batch'),
//             CourseEntry: mongoose.model('CourseEntry'),
//             AssignedCourseFee: mongoose.model('AssignedCourseFee'),
//             FeeStructure: mongoose.model('FeeStructure'),
//             EventPayment: mongoose.model('EventPayment')
//         };
//     }

//     // NEW METHOD: Get student ID from user ID
//     async getStudentIdFromUserId(userId) {
//         try {
//             // Check cache first
//             if (this.studentIdCache.has(userId)) {
//                 return this.studentIdCache.get(userId);
//             }
            
//             // Fetch from database
//             const student = await this.models.Student.findById(userId).select('studentId');
            
//             if (!student || !student.studentId) {
//                 console.error(`No student ID found for user ID: ${userId}`);
//                 return null;
//             }
            
//             // Cache the result
//             this.studentIdCache.set(userId, student.studentId);
            
//             return student.studentId;
//         } catch (error) {
//             console.error("Error getting student ID from user ID:", error);
//             return null;
//         }
//     }

//     // NEW METHOD: Validate student ID format
//     isValidStudentId(studentId) {
//         if (!studentId || typeof studentId !== 'string') {
//             return false;
//         }
        
//         // Student IDs should be alphanumeric with specific format
//         // Examples: "BSCS-F24-001", "2023001", "S24-001"
//         const studentIdPattern = /^[A-Z0-9]+[-\s]?[A-Z0-9]+[-\s]?[A-Z0-9]+$/i;
//         return studentIdPattern.test(studentId);
//     }

//     // UPDATED: Process query with proper student ID validation
//     async processQuery(userId, userQuery) {
//         try {
//             // Get student ID from user ID
//             const studentId = await this.getStudentIdFromUserId(userId);
            
//             if (!studentId || !this.isValidStudentId(studentId)) {
//                 return "I need to identify your student account. Please ensure you're logged in properly or contact support.";
//             }
            
//             console.log(`🤖 Processing query for student: ${studentId}`);
            
//             // Validate that query doesn't contain another student ID
//             const queryLower = userQuery.toLowerCase();
//             const studentIdPatterns = [
//                 /\b\d{6,12}\b/g, // 6-12 digit numbers
//                 /\b[A-Z]{2,4}[- ][A-Z]\d{2}[- ]\d{3}\b/i, // BSCS-F24-001 format
//                 /\b[A-Z]{2,4}\d{4}\b/i, // BSCS2024 format
//             ];
            
//             let foundStudentIds = [];
//             studentIdPatterns.forEach(pattern => {
//                 const matches = userQuery.match(pattern);
//                 if (matches) {
//                     foundStudentIds.push(...matches);
//                 }
//             });
            
//             // If query contains a student ID that's not the logged-in user's ID
//             if (foundStudentIds.length > 0) {
//                 const hasOtherStudentId = foundStudentIds.some(id => 
//                     id.toLowerCase() !== studentId.toLowerCase()
//                 );
                
//                 if (hasOtherStudentId) {
//                     return "I can only provide information for your own student account. Please ask about your own academic information.";
//                 }
//             }
            
//             let session = this.chatSessions.get(studentId);
//             if (!session) {
//                 session = {
//                     history: [],
//                     context: { studentId, userId }
//                 };
//                 this.chatSessions.set(studentId, session);
//             }
            
//             const messages = [
//                 { role: "system", content: this.systemPrompt },
//                 ...session.history,
//                 { role: "user", content: userQuery }
//             ];
            
//             const response = await this.openai.chat.completions.create({
//                 model: "gpt-3.5-turbo",
//                 messages: messages,
//                 functions: this.getFunctionDefinitions(),
//                 function_call: "auto",
//                 temperature: 0.3,
//                 max_tokens: 500
//             });
            
//             const initialResponse = response.choices[0].message;
            
//             if (initialResponse.function_call) {
//                 const functionName = initialResponse.function_call.name;
//                 let functionArgs;
                
//                 try {
//                     functionArgs = JSON.parse(initialResponse.function_call.arguments);
//                 } catch (e) {
//                     functionArgs = {};
//                 }
                
//                 // CRITICAL: Override any studentId in function args with authenticated student ID
//                 functionArgs.studentId = studentId;
                
//                 console.log(`🤖 AI called function: ${functionName} for student: ${studentId}`);
                
//                 let functionResult;
//                 try {
//                     functionResult = await this.executeFunction(functionName, functionArgs);
//                 } catch (error) {
//                     console.error(`Function execution error: ${error.message}`);
//                     functionResult = { error: "Unable to fetch your data. Please try again later." };
//                 }
                
//                 messages.push(initialResponse);
//                 messages.push({
//                     role: "function",
//                     name: functionName,
//                     content: JSON.stringify(functionResult)
//                 });
                
//                 const finalResponse = await this.openai.chat.completions.create({
//                     model: "gpt-3.5-turbo",
//                     messages: messages,
//                     temperature: 0.3,
//                     max_tokens: 800
//                 });
                
//                 const finalMessage = finalResponse.choices[0].message.content;
                
//                 session.history.push(
//                     { role: "user", content: userQuery },
//                     { role: "assistant", content: finalMessage }
//                 );
                
//                 if (session.history.length > 10) {
//                     session.history = session.history.slice(-10);
//                 }
                
//                 return finalMessage;
//             } else {
//                 const answer = initialResponse.content;
                
//                 session.history.push(
//                     { role: "user", content: userQuery },
//                     { role: "assistant", content: answer }
//                 );
                
//                 return answer;
//             }
            
//         } catch (error) {
//             console.error("AI processing error:", error);
//             return "I encountered an error while processing your query. Please try again or contact support.";
//         }
//     }

//     // UPDATED: System prompt with clear student ID rules
//     createDynamicSystemPrompt() {
//         return `You are an AI assistant for a University ERP system. You help students with ALL their academic and administrative queries.

// CRITICAL RULES:
// 1. You MUST use function calls to fetch REAL data from the database
// 2. NEVER make up or assume data - ALWAYS fetch actual data
// 3. Combine multiple data sources for comprehensive answers
// 4. Explain calculations clearly using REAL numbers from the database
// 5. Provide specific numbers, dates, and details ONLY from fetched data
// 6. Maintain natural conversation flow
// 7. If data isn't available, say so clearly

// STUDENT ID RULES:
// 1. You will ALWAYS use the authenticated student's ID - DO NOT extract it from the message
// 2. NEVER use any ID or number mentioned in the student's question
// 3. All data queries will automatically use the logged-in student's ID
// 4. If a student asks about another student's data, politely decline
// 5. Student ID is automatically provided in all function calls

// AVAILABLE FUNCTIONS:
// - getStudentBasicInfo: Basic student profile for authenticated student
// - getStudentAcademicProgress: Academic progress summary
// - getCurrentSemesterCourses: Current semester courses
// - getAllSemesterCourses: All courses history
// - getAttendanceData: Attendance records
// - getGradesAndResults: Grades and marks
// - getDynamicFeeInformation: Fee details and breakdown
// - getTimetable: Class schedule
// - getTeachersInformation: Teacher details
// - getTasksAndAssignments: Assignments and tasks
// - getBatchInformation: Batch and calendar
// - getUniversityExpenses: Additional expenses
// - getCourseOperations: Drop/freeze/repeat courses
// - getDynamicGPACalculation: GPA details
// - searchAcrossAllData: Comprehensive search
// - getDetailedFeeBreakdown: Detailed fee calculation

// HOW TO HANDLE QUERIES:
// 1. The student is automatically authenticated - NO NEED to ask for ID
// 2. Interpret the student's question
// 3. Decide which function(s) to call
// 4. Fetch the real data (student ID is automatically included)
// 5. Formulate response using ONLY fetched data
// 6. Never mention static examples or made-up data

// SECURITY REMINDERS:
// - Never disclose another student's information
// - Never ask for or use student IDs from messages
// - All data is scoped to the authenticated student only

// REMEMBER: Every number, date, and detail must come from database queries for the authenticated student.`;
//     }
    
//     // UPDATED: Function definitions - studentId is still required but will be auto-filled
//     getFunctionDefinitions() {
//         return [
//             {
//                 name: "getStudentBasicInfo",
//                 description: "Get basic student information for the authenticated student",
//                 parameters: {
//                     type: "object",
//                     properties: {
//                         studentId: {
//                             type: "string",
//                             description: "The authenticated student's ID (auto-provided)"
//                         }
//                     },
//                     required: ["studentId"]
//                 }
//             },
//             {
//                 name: "getStudentAcademicProgress",
//                 description: "Get student's academic progress including current semester, GPA, credits",
//                 parameters: {
//                     type: "object",
//                     properties: {
//                         studentId: {
//                             type: "string",
//                             description: "The authenticated student's ID (auto-provided)"
//                         }
//                     },
//                     required: ["studentId"]
//                 }
//             },
//             {
//                 name: "getCurrentSemesterCourses",
//                 description: "Get courses for student's current semester",
//                 parameters: {
//                     type: "object",
//                     properties: {
//                         studentId: {
//                             type: "string",
//                             description: "The authenticated student's ID (auto-provided)"
//                         }
//                     },
//                     required: ["studentId"]
//                 }
//             },
//             {
//                 name: "getAllSemesterCourses",
//                 description: "Get all courses across all semesters for a student",
//                 parameters: {
//                     type: "object",
//                     properties: {
//                         studentId: {
//                             type: "string",
//                             description: "The authenticated student's ID (auto-provided)"
//                         }
//                     },
//                     required: ["studentId"]
//                 }
//             },
//             {
//                 name: "getAttendanceData",
//                 description: "Get attendance data for the student",
//                 parameters: {
//                     type: "object",
//                     properties: {
//                         studentId: {
//                             type: "string",
//                             description: "The authenticated student's ID (auto-provided)"
//                         },
//                         semester: {
//                             type: "number",
//                             description: "Specific semester number (optional)"
//                         },
//                         courseCode: {
//                             type: "string",
//                             description: "Specific course code (optional)"
//                         }
//                     },
//                     required: ["studentId"]
//                 }
//             },
//             {
//                 name: "getGradesAndResults",
//                 description: "Get grades, marks, and results for the student",
//                 parameters: {
//                     type: "object",
//                     properties: {
//                         studentId: {
//                             type: "string",
//                             description: "The authenticated student's ID (auto-provided)"
//                         },
//                         semester: {
//                             type: "number",
//                             description: "Specific semester number (optional)"
//                         },
//                         courseCode: {
//                             type: "string",
//                             description: "Specific course code (optional)"
//                         }
//                     },
//                     required: ["studentId"]
//                 }
//             },
//             {
//                 name: "getDynamicFeeInformation",
//                 description: "Get ALL fee details including paid, due, installments, and dynamic breakdown",
//                 parameters: {
//                     type: "object",
//                     properties: {
//                         studentId: {
//                             type: "string",
//                             description: "The authenticated student's ID (auto-provided)"
//                         },
//                         semester: {
//                             type: "number",
//                             description: "Specific semester number (optional)"
//                         }
//                     },
//                     required: ["studentId"]
//                 }
//             },
//             {
//                 name: "getDetailedFeeBreakdown",
//                 description: "Get detailed fee breakdown with all components and calculations",
//                 parameters: {
//                     type: "object",
//                     properties: {
//                         studentId: {
//                             type: "string",
//                             description: "The authenticated student's ID (auto-provided)"
//                         },
//                         semester: {
//                             type: "string",
//                             description: "Semester to analyze (optional)"
//                         }
//                     },
//                     required: ["studentId"]
//                 }
//             },
//             {
//                 name: "getTimetable",
//                 description: "Get timetable/schedule for the student",
//                 parameters: {
//                     type: "object",
//                     properties: {
//                         studentId: {
//                             type: "string",
//                             description: "The authenticated student's ID (auto-provided)"
//                         },
//                         day: {
//                             type: "string",
//                             description: "Specific day (monday, tuesday, etc.)"
//                         },
//                         courseCode: {
//                             type: "string",
//                             description: "Specific course code"
//                         }
//                     },
//                     required: ["studentId"]
//                 }
//             },
//             {
//                 name: "getTeachersInformation",
//                 description: "Get information about teachers for the student's courses",
//                 parameters: {
//                     type: "object",
//                     properties: {
//                         studentId: {
//                             type: "string",
//                             description: "The authenticated student's ID (auto-provided)"
//                         },
//                         courseCode: {
//                             type: "string",
//                             description: "Specific course code"
//                         }
//                     },
//                     required: ["studentId"]
//                 }
//             },
//             {
//                 name: "getTasksAndAssignments",
//                 description: "Get tasks, assignments, and projects for the student",
//                 parameters: {
//                     type: "object",
//                     properties: {
//                         studentId: {
//                             type: "string",
//                             description: "The authenticated student's ID (auto-provided)"
//                         },
//                         status: {
//                             type: "string",
//                             enum: ["pending", "completed", "overdue", "all"],
//                             description: "Status filter"
//                         }
//                     },
//                     required: ["studentId"]
//                 }
//             },
//             {
//                 name: "getBatchInformation",
//                 description: "Get batch details including academic calendar, dates, breaks",
//                 parameters: {
//                     type: "object",
//                     properties: {
//                         studentId: {
//                             type: "string",
//                             description: "The authenticated student's ID (auto-provided)"
//                         }
//                     },
//                     required: ["studentId"]
//                 }
//             },
//             {
//                 name: "getUniversityExpenses",
//                 description: "Get university expenses beyond tuition fees",
//                 parameters: {
//                     type: "object",
//                     properties: {
//                         studentId: {
//                             type: "string",
//                             description: "The authenticated student's ID (auto-provided)"
//                         }
//                     },
//                     required: ["studentId"]
//                 }
//             },
//             {
//                 name: "getCourseOperations",
//                 description: "Get information about course operations (drop, freeze, fresh enroll, repeat)",
//                 parameters: {
//                     type: "object",
//                     properties: {
//                         studentId: {
//                             type: "string",
//                             description: "The authenticated student's ID (auto-provided)"
//                         }
//                     },
//                     required: ["studentId"]
//                 }
//             },
//             {
//                 name: "getDynamicGPACalculation",
//                 description: "Get detailed GPA/CGPA calculation information with real data",
//                 parameters: {
//                     type: "object",
//                     properties: {
//                         studentId: {
//                             type: "string",
//                             description: "The authenticated student's ID (auto-provided)"
//                         },
//                         semester: {
//                             type: "number",
//                             description: "Specific semester number"
//                         }
//                     },
//                     required: ["studentId"]
//                 }
//             },
//             {
//                 name: "searchAcrossAllData",
//                 description: "Search across all student data for specific information",
//                 parameters: {
//                     type: "object",
//                     properties: {
//                         studentId: {
//                             type: "string",
//                             description: "The authenticated student's ID (auto-provided)"
//                         },
//                         searchQuery: {
//                             type: "string",
//                             description: "The search query or topic"
//                         }
//                     },
//                     required: ["studentId", "searchQuery"]
//                 }
//             }
//         ];
//     }
    
//     // UPDATED: Execute function with security validation
//     executeFunction(functionName, args) {
//         const functionMap = {
//             "getStudentBasicInfo": this.getStudentBasicInfo.bind(this),
//             "getStudentAcademicProgress": this.getStudentAcademicProgress.bind(this),
//             "getCurrentSemesterCourses": this.getCurrentSemesterCourses.bind(this),
//             "getAllSemesterCourses": this.getAllSemesterCourses.bind(this),
//             "getAttendanceData": this.getAttendanceData.bind(this),
//             "getGradesAndResults": this.getGradesAndResults.bind(this),
//             "getDynamicFeeInformation": this.getDynamicFeeInformation.bind(this),
//             "getDetailedFeeBreakdown": this.getDetailedFeeBreakdown.bind(this),
//             "getTimetable": this.getTimetable.bind(this),
//             "getTeachersInformation": this.getTeachersInformation.bind(this),
//             "getTasksAndAssignments": this.getTasksAndAssignments.bind(this),
//             "getBatchInformation": this.getBatchInformation.bind(this),
//             "getUniversityExpenses": this.getUniversityExpenses.bind(this),
//             "getCourseOperations": this.getCourseOperations.bind(this),
//             "getDynamicGPACalculation": this.getDynamicGPACalculation.bind(this),
//             "searchAcrossAllData": this.searchAcrossAllData.bind(this)
//         };
        
//         if (!functionMap[functionName]) {
//             throw new Error(`Unknown function: ${functionName}`);
//         }
        
//         // Validate student ID before proceeding
//         if (!args.studentId || !this.isValidStudentId(args.studentId)) {
//             throw new Error("Invalid student ID provided");
//         }
        
//         return functionMap[functionName](
//             args.studentId, 
//             args.semester, 
//             args.courseCode, 
//             args.day, 
//             args.status, 
//             args.searchQuery
//         );
//     }
    
//     // ALL FUNCTION IMPLEMENTATIONS (Complete)
//     async getStudentBasicInfo(studentId) {
//         try {
//             if (!this.isValidStudentId(studentId)) {
//                 return { error: "Invalid student ID format" };
//             }
            
//             const student = await this.models.Student.findOne({ studentId })
//                 .select('firstName lastName universityEmail department degreeLevel currentSemester section status');
            
//             if (!student) {
//                 return { error: "Student not found" };
//             }
            
//             return {
//                 name: `${student.firstName} ${student.lastName}`,
//                 studentId: student.studentId,
//                 email: student.universityEmail,
//                 department: student.department,
//                 degreeLevel: student.degreeLevel,
//                 currentSemester: student.currentSemester,
//                 section: student.section,
//                 status: student.status
//             };
//         } catch (error) {
//             console.error("Error fetching student info:", error);
//             return { error: "Failed to fetch student information" };
//         }
//     }
    
//     async getStudentAcademicProgress(studentId) {
//         try {
//             if (!this.isValidStudentId(studentId)) {
//                 return { error: "Invalid student ID format" };
//             }
            
//             const student = await this.models.Student.findOne({ studentId })
//                 .select('academicProgress');
            
//             if (!student || !student.academicProgress) {
//                 return { error: "Academic progress data not found" };
//             }
            
//             const progress = student.academicProgress;
//             return {
//                 currentSemester: progress.currentSemester,
//                 cumulativeGPA: progress.cumulativeGPA || 0,
//                 totalCreditsEarned: progress.totalCreditsEarned || 0,
//                 totalCreditsRequired: progress.totalCreditsRequired || 0,
//                 completionPercentage: progress.completionPercentage || 0,
//                 totalQualityPoints: progress.totalQualityPoints || 0,
//                 semestersCount: progress.semesters?.length || 0
//             };
//         } catch (error) {
//             console.error("Error fetching academic progress:", error);
//             return { error: "Failed to fetch academic progress" };
//         }
//     }
    
//     async getCurrentSemesterCourses(studentId) {
//         try {
//             if (!this.isValidStudentId(studentId)) {
//                 return { error: "Invalid student ID format" };
//             }
            
//             const student = await this.models.Student.findOne({ studentId });
            
//             if (!student || !student.academicProgress || !student.academicProgress.semesters) {
//                 return { error: "Course data not found" };
//             }
            
//             const currentSemester = student.currentSemester || 1;
//             const semester = student.academicProgress.semesters.find(
//                 s => s.semesterNumber === currentSemester
//             );
            
//             if (!semester) {
//                 return { error: "Current semester data not found" };
//             }
            
//             return {
//                 semester: currentSemester,
//                 courses: semester.courses.map(course => ({
//                     courseCode: course.courseCode,
//                     courseName: course.courseName,
//                     credits: course.creditsEarned || 0,
//                     status: course.status,
//                     grade: course.grade || 'Not assigned',
//                     isRepeated: course.isRepeated || false,
//                     isFresh: course.isFresh || false,
//                     isDropped: course.status === 'dropped',
//                     isFrozen: course.status === 'frozen'
//                 }))
//             };
//         } catch (error) {
//             console.error("Error fetching current semester courses:", error);
//             return { error: "Failed to fetch course information" };
//         }
//     }
    
//     async getAllSemesterCourses(studentId) {
//         try {
//             if (!this.isValidStudentId(studentId)) {
//                 return { error: "Invalid student ID format" };
//             }
            
//             const student = await this.models.Student.findOne({ studentId });
            
//             if (!student || !student.academicProgress || !student.academicProgress.semesters) {
//                 return { error: "Course data not found" };
//             }
            
//             const allCourses = [];
//             const bySemester = {};
            
//             student.academicProgress.semesters.forEach(semester => {
//                 bySemester[semester.semesterNumber] = semester.courses.map(course => ({
//                     courseCode: course.courseCode,
//                     courseName: course.courseName,
//                     credits: course.creditsEarned || 0,
//                     status: course.status,
//                     grade: course.grade || 'Not assigned'
//                 }));
                
//                 allCourses.push(...bySemester[semester.semesterNumber]);
//             });
            
//             return {
//                 totalCourses: allCourses.length,
//                 bySemester,
//                 summary: {
//                     completed: allCourses.filter(c => c.status === 'completed').length,
//                     inProgress: allCourses.filter(c => c.status === 'in-progress').length,
//                     dropped: allCourses.filter(c => c.status === 'dropped').length,
//                     failed: allCourses.filter(c => c.grade === 'F').length
//                 }
//             };
//         } catch (error) {
//             console.error("Error fetching all courses:", error);
//             return { error: "Failed to fetch course history" };
//         }
//     }
    
//     async getAttendanceData(studentId, semester = null, courseCode = null) {
//         try {
//             if (!this.isValidStudentId(studentId)) {
//                 return { error: "Invalid student ID format" };
//             }
            
//             const attendance = await this.models.StudentAttendance.findOne({ studentId });
            
//             if (!attendance || !attendance.semesters) {
//                 return { error: "Attendance data not found" };
//             }
            
//             let filteredSemesters = attendance.semesters;
            
//             if (semester) {
//                 filteredSemesters = filteredSemesters.filter(s => s.semesterNumber === semester);
//             }
            
//             const result = {
//                 overall: {
//                     totalCourses: 0,
//                     averagePercentage: 0,
//                     coursesBelow75: 0,
//                     coursesBelow60: 0
//                 },
//                 bySemester: {}
//             };
            
//             let totalPercentage = 0;
//             let totalCourses = 0;
            
//             filteredSemesters.forEach(sem => {
//                 const semesterData = {
//                     semesterNumber: sem.semesterNumber,
//                     courses: []
//                 };
                
//                 sem.courses.forEach(course => {
//                     if (courseCode && course.courseCode !== courseCode) {
//                         return;
//                     }
                    
//                     const present = course.attendanceRecords?.filter(r => r.status === "Present").length || 0;
//                     const absent = course.attendanceRecords?.filter(r => r.status === "Absent").length || 0;
//                     const total = course.attendanceRecords?.length || 0;
//                     const percentage = total > 0 ? (present / total * 100) : 0;
                    
//                     const courseData = {
//                         courseCode: course.courseCode,
//                         courseName: course.courseName,
//                         percentage: percentage.toFixed(1),
//                         present,
//                         absent,
//                         total,
//                         lastUpdated: course.attendanceRecords?.[course.attendanceRecords.length - 1]?.date
//                     };
                    
//                     semesterData.courses.push(courseData);
                    
//                     totalPercentage += percentage;
//                     totalCourses++;
//                     if (percentage < 75) result.overall.coursesBelow75++;
//                     if (percentage < 60) result.overall.coursesBelow60++;
//                 });
                
//                 if (semesterData.courses.length > 0) {
//                     result.bySemester[sem.semesterNumber] = semesterData;
//                 }
//             });
            
//             result.overall.totalCourses = totalCourses;
//             result.overall.averagePercentage = totalCourses > 0 ? (totalPercentage / totalCourses).toFixed(1) : 0;
            
//             return result;
//         } catch (error) {
//             console.error("Error fetching attendance:", error);
//             return { error: "Failed to fetch attendance data" };
//         }
//     }
    
//     async getGradesAndResults(studentId, semester = null, courseCode = null) {
//         try {
//             if (!this.isValidStudentId(studentId)) {
//                 return { error: "Invalid student ID format" };
//             }
            
//             const currentResults = await this.models.Result.find({
//                 "results.studentId": studentId
//             });
            
//             const studentResults = await this.models.StudentResults.findOne({ studentId });
            
//             const results = {
//                 currentSemester: [],
//                 allSemesters: [],
//                 gpa: {
//                     cumulative: 0,
//                     bySemester: {}
//                 }
//             };
            
//             if (currentResults.length > 0) {
//                 currentResults.forEach(result => {
//                     const studentResult = result.results.find(r => r.studentId === studentId);
//                     if (studentResult && (!semester || result.semester === semester)) {
//                         results.currentSemester.push({
//                             courseCode: result.courseCode,
//                             courseName: result.courseName,
//                             semester: result.semester,
//                             grade: studentResult.grade,
//                             gradePoints: studentResult.gradePoints || 0,
//                             obtainedMarks: studentResult.obtainedMarks || 0,
//                             totalMarks: studentResult.totalMarks || 100,
//                             percentage: studentResult.totalMarks ? 
//                                 ((studentResult.obtainedMarks / studentResult.totalMarks) * 100).toFixed(1) : 'N/A'
//                         });
//                     }
//                 });
//             }
            
//             if (studentResults && studentResults.academicProgress) {
//                 studentResults.academicProgress.forEach(semesterData => {
//                     if (!semester || semesterData.semesterNumber === semester) {
//                         const semesterResults = semesterData.courses.map(course => ({
//                             courseCode: course.courseCode,
//                             courseName: course.courseName,
//                             semester: semesterData.semesterNumber,
//                             grade: course.grade,
//                             gradePoints: course.gradePoints || 0,
//                             obtainedMarks: course.obtainedMarks || 0,
//                             totalMarks: course.totalMarks || 0,
//                             percentage: course.percentage || 0
//                         }));
                        
//                         results.allSemesters.push(...semesterResults);
                        
//                         const totalGradePoints = semesterResults.reduce((sum, course) => sum + (course.gradePoints || 0), 0);
//                         results.gpa.bySemester[semesterData.semesterNumber] = semesterResults.length > 0 ? 
//                             (totalGradePoints / semesterResults.length).toFixed(2) : 0;
//                     }
//                 });
                
//                 const allCourses = results.allSemesters.filter(course => course.gradePoints > 0);
//                 const totalGradePoints = allCourses.reduce((sum, course) => sum + course.gradePoints, 0);
//                 results.gpa.cumulative = allCourses.length > 0 ? 
//                     (totalGradePoints / allCourses.length).toFixed(2) : 0;
//             }
            
//             if (courseCode) {
//                 results.currentSemester = results.currentSemester.filter(r => r.courseCode === courseCode);
//                 results.allSemesters = results.allSemesters.filter(r => r.courseCode === courseCode);
//             }
            
//             return results;
//         } catch (error) {
//             console.error("Error fetching grades:", error);
//             return { error: "Failed to fetch grade information" };
//         }
//     }
    
//     async getDynamicFeeInformation(studentId, semester = null) {
//         try {
//             if (!this.isValidStudentId(studentId)) {
//                 return { error: "Invalid student ID format" };
//             }
            
//             const student = await this.models.Student.findOne({ studentId });
//             if (!student) {
//                 return { error: "Student not found" };
//             }
            
//             const [studentFee, universityExpenses, feeStructure] = await Promise.all([
//                 this.models.StudentFee.findOne({ studentId }),
//                 this.models.UniversityExpenses.findOne({ studentId }),
//                 this.models.FeeStructure.findOne({
//                     degreeLevel: student.degreeLevel,
//                     department: student.department,
//                     batch: student.batchName || (await this.models.Batch.findById(student.batch))?.batchName,
//                     isActive: true
//                 })
//             ]);
            
//             const result = {
//                 studentInfo: {
//                     name: `${student.firstName} ${student.lastName}`,
//                     studentId: student.studentId,
//                     currentSemester: student.currentSemester,
//                     scholarshipPercentage: student.scholarshipPercentage || 0
//                 },
//                 feeSummary: {},
//                 semesterWiseFees: {},
//                 universityExpenses: [],
//                 feeStructure: null,
//                 totalCalculations: {
//                     totalAmount: 0,
//                     totalPaid: 0,
//                     totalDue: 0
//                 }
//             };
            
//             if (feeStructure) {
//                 result.feeStructure = {
//                     degreeLevel: feeStructure.degreeLevel,
//                     department: feeStructure.department,
//                     batch: feeStructure.batch,
//                     masterBaseFee: feeStructure.masterBaseFee || {},
//                     semesterBreakdown: feeStructure.semesterBreakdown || []
//                 };
//             }
            
//             if (studentFee) {
//                 result.feeSummary = {
//                     totalDegreeFee: studentFee.totalDegreeFee || 0,
//                     totalPaid: studentFee.totalPaid || 0,
//                     totalDue: studentFee.totalDue || 0,
//                     scholarshipPercentage: studentFee.scholarshipPercentage || 0
//                 };
                
//                 result.totalCalculations.totalAmount += studentFee.totalDegreeFee || 0;
//                 result.totalCalculations.totalPaid += studentFee.totalPaid || 0;
//                 result.totalCalculations.totalDue += studentFee.totalDue || 0;
                
//                 if (studentFee.semesterFees) {
//                     studentFee.semesterFees.forEach(semFee => {
//                         if (!semester || semFee.semester === semester) {
//                             result.semesterWiseFees[semFee.semester] = {
//                                 totalFee: semFee.totalFee || 0,
//                                 originalBaseFee: semFee.originalBaseFee || 0,
//                                 originalCourseFee: semFee.originalCourseFee || 0,
//                                 tuitionFee: semFee.tuitionFee || 0,
//                                 courseFees: semFee.courseFees || 0,
//                                 fixedFees: semFee.fixedFees || 0,
//                                 scholarshipDiscount: semFee.scholarshipDiscount || 0,
//                                 discountedFee: semFee.discountedFee || 0,
//                                 amountPaid: semFee.amountPaid || 0,
//                                 currentPayableAmount: semFee.currentPayableAmount || 0,
//                                 status: semFee.status || "pending",
//                                 installments: semFee.installments || []
//                             };
//                         }
//                     });
//                 }
//             }
            
//             if (universityExpenses) {
//                 result.universityExpenses = universityExpenses.expenseConfigurations.map(exp => ({
//                     title: exp.expenseTitle,
//                     calculatedAmount: exp.calculatedAmount || 0,
//                     durationInMonths: exp.durationInMonths,
//                     startDate: exp.startDate,
//                     endDate: exp.endDate,
//                     status: exp.status,
//                     invoiceNumber: exp.invoiceNumber
//                 }));
                
//                 if (universityExpenses.invoices) {
//                     result.universityInvoices = universityExpenses.invoices.map(inv => ({
//                         invoiceNumber: inv.invoiceNumber,
//                         expenseTitle: inv.expenseTitle,
//                         amount: inv.amount,
//                         amountPaid: inv.amountPaid || 0,
//                         amountDue: inv.amount - (inv.amountPaid || 0),
//                         paymentStatus: inv.paymentStatus,
//                         dueDate: inv.dueDate
//                     }));
//                 }
                
//                 result.totalCalculations.totalAmount += universityExpenses.totalAmount || 0;
//                 result.totalCalculations.totalPaid += universityExpenses.amountPaid || 0;
//                 result.totalCalculations.totalDue += (universityExpenses.totalAmount || 0) - (universityExpenses.amountPaid || 0);
//             }
            
//             return result;
//         } catch (error) {
//             console.error("Error fetching dynamic fee information:", error);
//             return { error: "Failed to fetch fee information" };
//         }
//     }
    
//     async getDetailedFeeBreakdown(studentId, semester = null) {
//         try {
//             if (!this.isValidStudentId(studentId)) {
//                 return { error: "Invalid student ID format" };
//             }
            
//             const student = await this.models.Student.findOne({ studentId });
//             if (!student) {
//                 return { error: "Student not found" };
//             }
            
//             const currentSemester = student.currentSemester;
//             const targetSemester = semester || currentSemester;
            
//             const [studentFee, universityExpenses, feeStructure, assignedCourseFees] = await Promise.all([
//                 this.models.StudentFee.findOne({ studentId }),
//                 this.models.UniversityExpenses.findOne({ studentId }),
//                 this.models.FeeStructure.findOne({
//                     degreeLevel: student.degreeLevel,
//                     department: student.department,
//                     batch: student.batchName || (await this.models.Batch.findById(student.batch))?.batchName,
//                     isActive: true
//                 }),
//                 this.models.AssignedCourseFee.findOne({
//                     degreeLevel: student.degreeLevel,
//                     department: student.department
//                 })
//             ]);
            
//             const breakdown = {
//                 studentInfo: {
//                     name: `${student.firstName} ${student.lastName}`,
//                     studentId: student.studentId,
//                     currentSemester: student.currentSemester,
//                     scholarshipPercentage: student.scholarshipPercentage || 0
//                 },
//                 targetSemester: targetSemester,
//                 components: {
//                     tuitionFee: 0,
//                     courseFees: 0,
//                     fixedFees: {},
//                     universityExpenses: [],
//                     scholarships: {
//                         percentage: student.scholarshipPercentage || 0,
//                         amount: 0
//                     },
//                     totalBeforeScholarship: 0,
//                     totalAfterScholarship: 0
//                 },
//                 calculations: [],
//                 sources: []
//             };
            
//             if (studentFee && studentFee.semesterFees) {
//                 const semesterFee = studentFee.semesterFees.find(sf => sf.semester === targetSemester);
//                 if (semesterFee) {
//                     breakdown.components.tuitionFee = semesterFee.tuitionFee || 0;
//                     breakdown.components.courseFees = semesterFee.courseFees || 0;
//                     breakdown.components.fixedFees = {
//                         miscellaneous: semesterFee.fixedFees || 0
//                     };
//                     breakdown.components.scholarships.amount = semesterFee.scholarshipDiscount || 0;
//                     breakdown.components.totalBeforeScholarship = semesterFee.originalTotalFee || 0;
//                     breakdown.components.totalAfterScholarship = semesterFee.totalFee || 0;
                    
//                     breakdown.calculations.push({
//                         description: "Semester fee from student record",
//                         amount: semesterFee.totalFee || 0
//                     });
                    
//                     breakdown.sources.push("StudentFee Record");
//                 }
//             }
            
//             if (feeStructure) {
//                 const semesterBreakdown = feeStructure.semesterBreakdown?.find(sb => sb.semester === targetSemester);
//                 if (semesterBreakdown) {
//                     breakdown.calculations.push({
//                         description: "Base fee from fee structure",
//                         amount: semesterBreakdown.baseFee || 0
//                     });
                    
//                     breakdown.calculations.push({
//                         description: "Course fees from fee structure",
//                         amount: semesterBreakdown.courseFee || 0
//                     });
                    
//                     breakdown.sources.push("Fee Structure");
//                 }
                
//                 if (feeStructure.masterBaseFee) {
//                     breakdown.components.fixedFees = {
//                         ...breakdown.components.fixedFees,
//                         examFee: feeStructure.masterBaseFee.examFee || 0,
//                         libraryFee: feeStructure.masterBaseFee.libraryFee || 0,
//                         labFee: feeStructure.masterBaseFee.labFee || 0,
//                         miscellaneousFee: feeStructure.masterBaseFee.miscellaneousFee || 0
//                     };
//                 }
//             }
            
//             if (assignedCourseFees) {
//                 const semesterCourses = assignedCourseFees.semesters?.find(s => s.semester === targetSemester);
//                 if (semesterCourses && semesterCourses.courses) {
//                     const totalCourseFees = semesterCourses.courses.reduce((sum, course) => sum + (course.feeAmount || 0), 0);
                    
//                     breakdown.calculations.push({
//                         description: "Course fees from assigned courses",
//                         amount: totalCourseFees,
//                         details: semesterCourses.courses.map(c => ({
//                             course: c.courseCode,
//                             fee: c.feeAmount || 0
//                         }))
//                     });
                    
//                     breakdown.sources.push("Assigned Course Fees");
//                 }
//             }
            
//             if (universityExpenses) {
//                 const semesterExpenses = universityExpenses.expenseConfigurations.filter(exp => {
//                     const startDate = new Date(exp.startDate);
//                     const endDate = new Date(exp.endDate);
//                     const semesterMonths = Array.from({length: exp.durationInMonths || 0}, (_, i) => {
//                         const date = new Date(startDate);
//                         date.setMonth(date.getMonth() + i);
//                         return date.getMonth();
//                     });
                    
//                     return semesterMonths.length > 0;
//                 });
                
//                 if (semesterExpenses.length > 0) {
//                     breakdown.components.universityExpenses = semesterExpenses.map(exp => ({
//                         title: exp.expenseTitle,
//                         amount: exp.calculatedAmount || 0,
//                         duration: exp.durationInMonths
//                     }));
                    
//                     const totalExpenses = semesterExpenses.reduce((sum, exp) => sum + (exp.calculatedAmount || 0), 0);
                    
//                     breakdown.calculations.push({
//                         description: "University expenses",
//                         amount: totalExpenses,
//                         details: semesterExpenses.map(exp => ({
//                             expense: exp.expenseTitle,
//                             amount: exp.calculatedAmount || 0
//                         }))
//                     });
                    
//                     breakdown.sources.push("University Expenses");
//                 }
//             }
            
//             const tuitionAndCourseFees = breakdown.components.tuitionFee + breakdown.components.courseFees;
//             const fixedFeesTotal = Object.values(breakdown.components.fixedFees).reduce((sum, fee) => sum + (fee || 0), 0);
//             const expensesTotal = breakdown.components.universityExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
            
//             breakdown.components.totalBeforeScholarship = tuitionAndCourseFees + fixedFeesTotal + expensesTotal;
            
//             if (breakdown.components.scholarships.percentage > 0) {
//                 const scholarshipAmount = (tuitionAndCourseFees * breakdown.components.scholarships.percentage) / 100;
//                 breakdown.components.scholarships.amount = scholarshipAmount;
//                 breakdown.components.totalAfterScholarship = breakdown.components.totalBeforeScholarship - scholarshipAmount;
//             } else {
//                 breakdown.components.totalAfterScholarship = breakdown.components.totalBeforeScholarship;
//             }
            
//             if (studentFee && studentFee.semesterFees) {
//                 const semesterFee = studentFee.semesterFees.find(sf => sf.semester === targetSemester);
//                 if (semesterFee && semesterFee.installments) {
//                     breakdown.installments = semesterFee.installments.map(inst => ({
//                         number: inst.installmentNumber,
//                         amount: inst.amount || 0,
//                         dueDate: inst.dueDate,
//                         status: inst.status,
//                         amountPaid: inst.amountPaid || 0
//                     }));
//                 }
//             }
            
//             return breakdown;
//         } catch (error) {
//             console.error("Error fetching detailed fee breakdown:", error);
//             return { error: "Failed to fetch detailed fee breakdown" };
//         }
//     }
    
//     async getTimetable(studentId, day = null, courseCode = null) {
//         try {
//             if (!this.isValidStudentId(studentId)) {
//                 return { error: "Invalid student ID format" };
//             }
            
//             const student = await this.models.Student.findOne({ studentId });
            
//             if (!student || !student.batch) {
//                 return { error: "Student batch information not found" };
//             }
            
//             const timetable = await this.models.Timetable.findOne({
//                 batchId: student.batch,
//                 semester: student.currentSemester,
//                 isActive: true
//             });
            
//             if (!timetable || !timetable.timeSlots) {
//                 return { error: "Timetable not found" };
//             }
            
//             const activeSlots = timetable.timeSlots.filter(slot => slot.isActive);
            
//             let filteredSlots = activeSlots;
//             if (day) {
//                 filteredSlots = filteredSlots.filter(slot => slot.day.toLowerCase() === day.toLowerCase());
//             }
//             if (courseCode) {
//                 filteredSlots = filteredSlots.filter(slot => slot.courseCode === courseCode);
//             }
            
//             const byDay = {};
//             filteredSlots.forEach(slot => {
//                 if (!byDay[slot.day]) {
//                     byDay[slot.day] = [];
//                 }
//                 byDay[slot.day].push({
//                     courseCode: slot.courseCode,
//                     courseName: slot.courseName,
//                     time: `${slot.startTime} - ${slot.endTime}`,
//                     room: slot.room,
//                     teacher: slot.facultyName || 'Not assigned',
//                     classType: slot.classType
//                 });
//             });
            
//             const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
//             const todaysSchedule = byDay[today] || [];
            
//             return {
//                 currentSemester: student.currentSemester,
//                 totalSlots: filteredSlots.length,
//                 byDay,
//                 todaysSchedule,
//                 tomorrowsSchedule: byDay[this.getTomorrowDay()] || []
//             };
//         } catch (error) {
//             console.error("Error fetching timetable:", error);
//             return { error: "Failed to fetch timetable" };
//         }
//     }
    
//     getTomorrowDay() {
//         const tomorrow = new Date();
//         tomorrow.setDate(tomorrow.getDate() + 1);
//         return tomorrow.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
//     }
    
//     async getTeachersInformation(studentId, courseCode = null) {
//         try {
//             if (!this.isValidStudentId(studentId)) {
//                 return { error: "Invalid student ID format" };
//             }
            
//             const student = await this.models.Student.findOne({ studentId });
            
//             if (!student || !student.batch) {
//                 return { error: "Student information not found" };
//             }
            
//             const timetable = await this.models.Timetable.findOne({
//                 batchId: student.batch,
//                 semester: student.currentSemester,
//                 isActive: true
//             });
            
//             if (!timetable || !timetable.timeSlots) {
//                 return { error: "Teacher information not found" };
//             }
            
//             const activeSlots = timetable.timeSlots.filter(slot => slot.isActive);
//             const teachers = {};
            
//             activeSlots.forEach(slot => {
//                 if (slot.facultyName && slot.facultyName !== 'Not assigned') {
//                     if (!teachers[slot.facultyName]) {
//                         teachers[slot.facultyName] = {
//                             name: slot.facultyName,
//                             facultyId: slot.facultyId,
//                             courses: [],
//                             schedule: []
//                         };
//                     }
                    
//                     const teacher = teachers[slot.facultyName];
//                     if (!teacher.courses.includes(slot.courseCode)) {
//                         teacher.courses.push(slot.courseCode);
//                     }
                    
//                     teacher.schedule.push({
//                         courseCode: slot.courseCode,
//                         courseName: slot.courseName,
//                         day: slot.day,
//                         time: `${slot.startTime} - ${slot.endTime}`,
//                         room: slot.room
//                     });
//                 }
//             });
            
//             const teachersArray = Object.values(teachers);
            
//             if (courseCode) {
//                 const filtered = teachersArray.filter(teacher => 
//                     teacher.courses.includes(courseCode)
//                 );
//                 return {
//                     teachers: filtered,
//                     forCourse: courseCode
//                 };
//             }
            
//             return {
//                 teachers: teachersArray,
//                 totalTeachers: teachersArray.length
//             };
//         } catch (error) {
//             console.error("Error fetching teachers:", error);
//             return { error: "Failed to fetch teacher information" };
//         }
//     }
    
//     async getTasksAndAssignments(studentId, status = "all") {
//         try {
//             if (!this.isValidStudentId(studentId)) {
//                 return { error: "Invalid student ID format" };
//             }
            
//             const student = await this.models.Student.findOne({ studentId });
            
//             if (!student || !student.batch) {
//                 return { error: "Student information not found" };
//             }
            
//             const batch = await this.models.Batch.findById(student.batch);
//             if (!batch) {
//                 return { error: "Batch information not found" };
//             }
            
//             const tasks = await this.models.FacultyTask.find({
//                 batchName: batch.batchName,
//                 sectionName: student.section,
//                 semester: student.currentSemester.toString()
//             }).sort({ createdAt: -1 });
            
//             const now = new Date();
//             const categorized = {
//                 all: tasks,
//                 pending: [],
//                 recent: [],
//                 byCourse: {}
//             };
            
//             tasks.forEach(task => {
//                 const taskObj = {
//                     courseCode: task.courseCode,
//                     courseName: task.courseName,
//                     title: task.taskTitle,
//                     description: task.taskDescription,
//                     createdAt: task.createdAt,
//                     isRecent: (now - task.createdAt) < 7 * 24 * 60 * 60 * 1000
//                 };
                
//                 categorized.pending.push(taskObj);
                
//                 if (taskObj.isRecent) {
//                     categorized.recent.push(taskObj);
//                 }
                
//                 if (!categorized.byCourse[task.courseCode]) {
//                     categorized.byCourse[task.courseCode] = [];
//                 }
//                 categorized.byCourse[task.courseCode].push(taskObj);
//             });
            
//             if (status !== "all") {
//                 return {
//                     tasks: categorized[status] || [],
//                     total: (categorized[status] || []).length
//                 };
//             }
            
//             return {
//                 totalTasks: tasks.length,
//                 recentTasks: categorized.recent.length,
//                 pendingTasks: categorized.pending.length,
//                 byCourse: categorized.byCourse
//             };
//         } catch (error) {
//             console.error("Error fetching tasks:", error);
//             return { error: "Failed to fetch tasks" };
//         }
//     }
    
//     async getBatchInformation(studentId) {
//         try {
//             if (!this.isValidStudentId(studentId)) {
//                 return { error: "Invalid student ID format" };
//             }
            
//             const student = await this.models.Student.findOne({ studentId });
            
//             if (!student || !student.batch) {
//                 return { error: "Batch information not found" };
//             }
            
//             const batch = await this.models.Batch.findById(student.batch);
            
//             if (!batch) {
//                 return { error: "Batch details not found" };
//             }
            
//             const result = {
//                 batchName: batch.batchName,
//                 degreeLevel: batch.degreeLevel,
//                 department: batch.departmentName,
//                 enrollmentYear: batch.enrollmentYear,
//                 graduationYear: batch.graduationYear,
//                 currentSemester: batch.currentSemester,
//                 totalSemesters: batch.totalSemesters,
//                 semesterStart: batch.semesterStart,
//                 graduationStatus: batch.graduationStatus,
//                 isActive: batch.isActive,
//                 enrollmentStatus: batch.enrollmentStatus,
//                 academicCalendar: []
//             };
            
//             if (batch.academicCalendar) {
//                 result.academicCalendar = batch.academicCalendar.map(cal => ({
//                     semester: cal.semester,
//                     name: cal.name,
//                     startDate: cal.startDate,
//                     endDate: cal.endDate,
//                     midtermStart: cal.midtermStart,
//                     midtermEnd: cal.midtermEnd,
//                     finalStart: cal.finalStart,
//                     finalEnd: cal.finalEnd,
//                     breaks: cal.breaks || []
//                 }));
                
//                 const currentCalendar = batch.academicCalendar.find(
//                     cal => cal.semester === student.currentSemester
//                 );
//                 if (currentCalendar) {
//                     result.currentSemesterCalendar = currentCalendar;
//                 }
//             }
            
//             return result;
//         } catch (error) {
//             console.error("Error fetching batch info:", error);
//             return { error: "Failed to fetch batch information" };
//         }
//     }
    
//     async getUniversityExpenses(studentId) {
//         try {
//             if (!this.isValidStudentId(studentId)) {
//                 return { error: "Invalid student ID format" };
//             }
            
//             const expenses = await this.models.UniversityExpenses.findOne({ studentId });
            
//             if (!expenses) {
//                 return { error: "University expenses not found" };
//             }
            
//             return {
//                 totalAmount: expenses.totalAmount || 0,
//                 amountPaid: expenses.amountPaid || 0,
//                 amountDue: expenses.totalAmount - (expenses.amountPaid || 0),
//                 paymentStatus: expenses.paymentStatus,
//                 expenseConfigurations: expenses.expenseConfigurations.map(exp => ({
//                     title: exp.expenseTitle,
//                     amount: exp.calculatedAmount || 0,
//                     duration: exp.durationInMonths,
//                     startDate: exp.startDate,
//                     endDate: exp.endDate,
//                     status: exp.status
//                 })),
//                 invoices: expenses.invoices?.map(inv => ({
//                     number: inv.invoiceNumber,
//                     title: inv.expenseTitle,
//                     amount: inv.amount,
//                     paid: inv.amountPaid || 0,
//                     due: inv.amount - (inv.amountPaid || 0),
//                     status: inv.paymentStatus,
//                     dueDate: inv.dueDate
//                 })) || []
//             };
//         } catch (error) {
//             console.error("Error fetching university expenses:", error);
//             return { error: "Failed to fetch university expenses" };
//         }
//     }
    
//     async getCourseOperations(studentId) {
//         try {
//             if (!this.isValidStudentId(studentId)) {
//                 return { error: "Invalid student ID format" };
//             }
            
//             const student = await this.models.Student.findOne({ studentId });
            
//             if (!student || !student.academicProgress || !student.academicProgress.semesters) {
//                 return { error: "Course operation data not found" };
//             }
            
//             const operations = {
//                 droppedCourses: [],
//                 frozenCourses: [],
//                 repeatedCourses: [],
//                 freshEnrolledCourses: [],
//                 failedCourses: []
//             };
            
//             student.academicProgress.semesters.forEach(semester => {
//                 semester.courses.forEach(course => {
//                     const courseData = {
//                         courseCode: course.courseCode,
//                         courseName: course.courseName,
//                         semester: semester.semesterNumber,
//                         status: course.status,
//                         grade: course.grade
//                     };
                    
//                     if (course.status === 'dropped') {
//                         operations.droppedCourses.push({
//                             ...courseData,
//                             droppedAt: course.droppedAt,
//                             reason: course.dropReason
//                         });
//                     }
                    
//                     if (course.status === 'frozen') {
//                         operations.frozenCourses.push({
//                             ...courseData,
//                             frozenAt: course.frozenAt
//                         });
//                     }
                    
//                     if (course.isRepeated) {
//                         operations.repeatedCourses.push({
//                             ...courseData,
//                             originalSemester: course.originalSemester
//                         });
//                     }
                    
//                     if (course.isFresh) {
//                         operations.freshEnrolledCourses.push({
//                             ...courseData,
//                             reason: course.freshEnrollmentReason
//                         });
//                     }
                    
//                     if (course.grade === 'F') {
//                         operations.failedCourses.push(courseData);
//                     }
//                 });
//             });
            
//             return operations;
//         } catch (error) {
//             console.error("Error fetching course operations:", error);
//             return { error: "Failed to fetch course operations" };
//         }
//     }
    
//     async getDynamicGPACalculation(studentId, semester = null) {
//         try {
//             if (!this.isValidStudentId(studentId)) {
//                 return { error: "Invalid student ID format" };
//             }
            
//             const studentResults = await this.models.StudentResults.findOne({ studentId });
            
//             if (!studentResults || !studentResults.academicProgress) {
//                 return { error: "GPA calculation data not found" };
//             }
            
//             const result = {
//                 cumulativeGPA: 0,
//                 semesterGPAs: {},
//                 courseDetails: [],
//                 calculationMethod: "Grade Points × Credits ÷ Total Credits",
//                 totalCredits: 0,
//                 totalGradePoints: 0
//             };
            
//             let totalGradePoints = 0;
//             let totalCredits = 0;
            
//             studentResults.academicProgress.forEach(semesterData => {
//                 if (!semester || semesterData.semesterNumber === semester) {
//                     let semesterGradePoints = 0;
//                     let semesterCredits = 0;
                    
//                     semesterData.courses.forEach(course => {
//                         const credits = course.creditsEarned || 3;
//                         const gradePoints = course.gradePoints || 0;
                        
//                         result.courseDetails.push({
//                             semester: semesterData.semesterNumber,
//                             courseCode: course.courseCode,
//                             grade: course.grade,
//                             gradePoints,
//                             credits,
//                             contribution: gradePoints * credits
//                         });
                        
//                         semesterGradePoints += gradePoints * credits;
//                         semesterCredits += credits;
//                         totalGradePoints += gradePoints * credits;
//                         totalCredits += credits;
//                     });
                    
//                     if (semesterCredits > 0) {
//                         result.semesterGPAs[semesterData.semesterNumber] = 
//                             (semesterGradePoints / semesterCredits).toFixed(2);
//                     }
//                 }
//             });
            
//             if (totalCredits > 0) {
//                 result.cumulativeGPA = (totalGradePoints / totalCredits).toFixed(2);
//                 result.totalCredits = totalCredits;
//                 result.totalGradePoints = totalGradePoints;
//             }
            
//             return result;
//         } catch (error) {
//             console.error("Error fetching GPA calculation:", error);
//             return { error: "Failed to fetch GPA calculation" };
//         }
//     }
    
//     async searchAcrossAllData(studentId, searchQuery) {
//         try {
//             if (!this.isValidStudentId(studentId)) {
//                 return { error: "Invalid student ID format" };
//             }
            
//             const searchResults = {
//                 studentInfo: null,
//                 courses: [],
//                 attendance: [],
//                 grades: [],
//                 fees: [],
//                 timetable: [],
//                 tasks: [],
//                 batchInfo: null
//             };
            
//             const student = await this.models.Student.findOne({ studentId });
//             if (student) {
//                 searchResults.studentInfo = {
//                     name: `${student.firstName} ${student.lastName}`,
//                     department: student.department,
//                     currentSemester: student.currentSemester
//                 };
//             }
            
//             if (student && student.academicProgress && student.academicProgress.semesters) {
//                 student.academicProgress.semesters.forEach(semester => {
//                     semester.courses.forEach(course => {
//                         if (course.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
//                             course.courseName.toLowerCase().includes(searchQuery.toLowerCase())) {
//                             searchResults.courses.push({
//                                 courseCode: course.courseCode,
//                                 courseName: course.courseName,
//                                 semester: semester.semesterNumber,
//                                 status: course.status,
//                                 grade: course.grade
//                             });
//                         }
//                     });
//                 });
//             }
            
//             const attendance = await this.models.StudentAttendance.findOne({ studentId });
//             if (attendance && attendance.semesters) {
//                 attendance.semesters.forEach(semester => {
//                     semester.courses.forEach(course => {
//                         if (course.courseCode.toLowerCase().includes(searchQuery.toLowerCase())) {
//                             searchResults.attendance.push({
//                                 courseCode: course.courseCode,
//                                 percentage: course.percentage || 0,
//                                 semester: semester.semesterNumber
//                             });
//                         }
//                     });
//                 });
//             }
            
//             const fees = await this.models.StudentFee.findOne({ studentId });
//             if (fees) {
//                 if (searchQuery.toLowerCase().includes('fee') || 
//                     searchQuery.toLowerCase().includes('payment')) {
//                     searchResults.fees.push({
//                         totalDue: fees.totalDue || 0,
//                         totalPaid: fees.totalPaid || 0
//                     });
//                 }
//             }
            
//             return searchResults;
//         } catch (error) {
//             console.error("Error in comprehensive search:", error);
//             return { error: "Search failed" };
//         }
//     }
    
//     clearChatHistory(studentId) {
//         this.chatSessions.delete(studentId);
//         return { success: true, message: "Chat history cleared" };
//     }
    
//     getSessionInfo(studentId) {
//         const session = this.chatSessions.get(studentId);
//         return {
//             hasSession: !!session,
//             messageCount: session?.history?.length || 0
//         };
//     }
    
//     clearCacheForUser(userId) {
//         this.studentIdCache.delete(userId);
//     }
// }

// module.exports = new DynamicAIDrivenChatbot();