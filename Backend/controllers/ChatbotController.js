const mongoose = require('mongoose');
const natural = require('natural');
const { NlpManager } = require('node-nlp');
const fs = require('fs').promises;
const path = require('path');

const Student = require('../models/Student');
const StudentFee = require('../models/StudentFee');
const StudentAttendance = require('../models/StudentAttendance');
const Result = require('../models/Result');
const Timetable = require('../models/Timetable');
const Batch = require('../models/Batch');
const FacultyTask = require('../models/FacultyTask');

class AIChatbotController {
    constructor() {
        this.memory = new Map();
        this.nlpManager = new NlpManager({ 
            languages: ['en'],
            forceNER: true,
            nlu: { useNoneFeature: false }
        });
        this.sessionTimeout = 15 * 60 * 1000;
        
        this.initializeAI();
        this.handleQuery = this.handleQuery.bind(this);
        
        setInterval(() => this.cleanupMemory(), 10 * 60 * 1000);
    }

    async initializeAI() {
        try {
            await this.loadPreTrainedModel();
            console.log('✅ AI Initialized with pre-trained model');
        } catch (error) {
            console.log('⚠️ No pre-trained model found, training from scratch...');
            await this.trainAI();
        }
    }

    async loadPreTrainedModel() {
        const modelPath = path.join(__dirname, '../models/nlp-model.nlp');
        try {
            await fs.access(modelPath);
            await this.nlpManager.load(modelPath);
            console.log('✅ Pre-trained AI model loaded successfully');
        } catch (error) {
            throw new Error('No pre-trained model found');
        }
    }

    async trainAI() {
        console.log('🤖 Training AI...');
        
        this.nlpManager.addLanguage('en');
        
        this.nlpManager.addDocument('en', 'hello', 'greeting');
        this.nlpManager.addDocument('en', 'hi', 'greeting');
        this.nlpManager.addDocument('en', 'hey', 'greeting');
        this.nlpManager.addDocument('en', 'good morning', 'greeting');
        
        this.nlpManager.addDocument('en', 'bye', 'farewell');
        this.nlpManager.addDocument('en', 'goodbye', 'farewell');
        this.nlpManager.addDocument('en', 'thank you', 'farewell');
        
        this.nlpManager.addDocument('en', 'help', 'help');
        this.nlpManager.addDocument('en', 'what can you do', 'help');
        
        this.nlpManager.addDocument('en', 'who are you', 'identity');
        this.nlpManager.addDocument('en', 'what are you', 'identity');
        
        [
            'show timetable', 'view timetable', 'get timetable', 'check timetable',
            'what is my timetable', 'timetable please', 'my class schedule',
            'what are my classes', 'class timetable', 'lecture schedule',
            'when are my classes', 'show me my classes', 'whats my schedule',
            'when do i have class', 'my daily classes', 'class timings',
            'schedule information', 'class schedule details', 'my schedule',
            'whats my schdule', 'show my schdule', 'my schdule', 'what is my schdule',
            'view my schdule', 'check my schdule', 'get my schdule'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'timetable.general'));
        
        [
            'today schedule', 'classes today', 'what classes today', 'todays classes',
            'today timetable', 'schedule for today', 'whats today', 'today plan',
            'do i have class today', 'any classes today', 'is there class today',
            'my classes today', 'whats on today', 'todays lectures', 'lectures today',
            'show todays classes', 'what is today schedule', 'today class schedule'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'timetable.today'));
        
        [
            'monday schedule', 'classes on monday', 'monday classes', 'monday timetable',
            'what on monday', 'schedule for monday', 'monday class schedule',
            'what classes on monday', 'do i have class on monday', 'monday lectures',
            'tuesday schedule', 'classes on tuesday', 'tuesday classes',
            'wednesday schedule', 'classes on wednesday', 'wednesday classes',
            'thursday schedule', 'classes on thursday', 'thursday classes',
            'friday schedule', 'classes on friday', 'friday classes',
            'saturday schedule', 'classes on saturday', 'saturday classes',
            'sunday schedule', 'classes on sunday', 'sunday classes',
            'moday schedule', 'classes on moday', 'moday classes', 'what class is on moday',
            'do i have class on moday', 'is there class on moday', 'moday timetable',
            'tuseday classes', 'wensday schedule', 'thrusday classes', 'saterday classes',
            'what on moday', 'schedule for moday', 'moday class schedule'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'timetable.day_schedule'));
        
        
        [
            'attendance', 'my attendance', 'attendance record', 'attendance details',
            'show attendance', 'view attendance', 'check attendance', 'attendance report',
            'what is my attendance', 'attendance status', 'attendance percentage',
            'my attendance details', 'attendance summary', 'attendance overview',
            'whats my attendance', 'check my attendance', 'view my attendance',
            'my attendance in', 'show my attendance in', 'attendance of'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'attendance.general'));
        
        [
            'attendance in calculus', 'attendance for math', 'course attendance',
            'subject attendance', 'class attendance', 'lecture attendance',
            'calculus attendance', 'physics attendance', 'cs101 attendance',
            'whats my attendance in calculus', 'show my attendance in physics',
            'attendance of programming', 'my attendance in english',
            'what is my attendance in physics', 'check attendance for math'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'attendance.course'));
        
        [
            'absent classes', 'how many classes absent', 'my absent classes',
            'classes i missed', 'missed classes', 'days absent',
            'how many days absent', 'my absences', 'absent count',
            'present classes', 'how many classes present', 'days present',
            'my attendance present', 'present count'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'attendance.detail'));
        
        [
            'fees', 'my fees', 'fee details', 'fee information', 'fee status',
            'show fees', 'view fees', 'check fees', 'what are my fees',
            'fee balance', 'financial status', 'tuition fees', 'my fee details',
            'pending fees', 'show my pending fees', 'what fees are pending',
            'unpaid fees', 'due fees', 'outstanding fees', 'fee payment status',
            'how much do i owe', 'what do i need to pay', 'fee dues',
            'installment due', 'unpaid installments', 'pending installments',
            'show my due fees', 'what is due', 'how much is due',
            'fee overview', 'my fee overview', 'total fees'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'fee.overview'));
    
        [
            'results', 'my results', 'grades', 'marks', 'scores', 'academic results',
            'show results', 'view results', 'check results', 'result details',
            'what are my results', 'my grades', 'my marks', 'my scores',
            'academic performance', 'my academic results', 'course results',
            'subject grades', 'class marks', 'lecture scores', 'gpa',
            'grade points', 'what is my gpa', 'my grade points', 'calculate my gpa',
            'overall gpa', 'current gpa', 'semester results', 'show my grades'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'results.all'));
        
        [
            'result in physics', 'grade in calculus', 'marks in programming',
            'score in math', 'what is my grade in physics', 'my result in english',
            'physics result', 'calculus grade', 'programming marks',
            'check my result in physics', 'show my grade in math',
            'what did i get in physics', 'my physics marks'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'results.course'));
        
        [
            'when will i graduate', 'graduation year', 'my batch',
            'semester end date', 'start date', 'how many total semesters',
            'admission dates', 'when can i apply', 'application dates',
            'batch information', 'my program details', 'academic calendar',
            'semester schedule', 'batch start date', 'batch end date',
            'total semesters', 'semester count', 'program duration',
            'when does semester end', 'when does semester start',
            'admission start date', 'admission end date', 'apply for admission',
            'when will the semester end', 'semester ending date',
            'end date of semester', 'semester finish date'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'batch.info'));

        [
            'my personal info', 'personal information', 'student details',
            'my profile', 'student profile', 'my information',
            'about me', 'my details', 'student information'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'student.personal_info'));
        
        [
            'scholarship status', 'do i have scholarship', 'am i on scholarship',
            'my scholarship', 'scholarship amount', 'scholarship percentage',
            'do i get scholarship', 'am i eligible for scholarship',
            'what is my scholarship', 'scholarship details',
            'my scholarship percentage', 'how much scholarship'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'student.scholarship'));
        
        [
            'my section', 'which section am i in', 'section information',
            'what is my section', 'which section do i belong to',
            'section details', 'my class section'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'student.section'));
        
        // Courses - assigned/current
        [
            'courses in progress', 'current courses', 'courses i am taking',
            'my current courses', 'assigned courses', 'courses assigned to me',
            'what courses do i have', 'my courses this semester',
            'courses for this semester', 'semester courses',
            'what are my courses', 'list my courses', 'show my courses'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'student.courses'));
        
        [
            'courses completed', 'completed courses', 'past courses',
            'what are my past courses', 'courses i have completed',
            'my completed courses', 'finished courses', 'passed courses'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'student.completed_courses'));
        
        [
            'my academic progress', 'academic standing', 'program progress',
            'credits earned', 'total credits', 'course credits',
            'current semester credits', 'overall credits', 'credits taken',
            'how many credits', 'credit hours', 'my credits',
            'dropped courses', 'courses dropped', 'failed courses',
            'my dropped courses', 'courses i dropped', 'failed subjects'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'student.academic_progress'));
        
        [
            'tasks', 'my tasks', 'assignments', 'homework', 'projects',
            'show tasks', 'view tasks', 'check tasks', 'what are my tasks',
            'task details', 'assignment details', 'homework details',
            'pending tasks', 'upcoming assignments', 'due assignments',
            'task list', 'assignment list', 'homework list',
            'what tasks do i have', 'what assignments do i have',
            'show my assignments', 'show my homework',
            'any pending work', 'any assignments due',
            'my pending tasks', 'my upcoming assignments'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'tasks.general'));
        
        [
            'latest tasks', 'recent tasks', 'new tasks', 'latest assignments',
            'recent assignments', 'new assignments', 'latest homework',
            'recent homework', 'new homework', 'latest projects',
            'whats new', 'any new tasks', 'any new assignments',
            'latest work', 'recent work', 'new work'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'tasks.latest'));
        
        [
            'upcoming tasks', 'future tasks', 'coming tasks',
            'upcoming assignments', 'future assignments', 'coming assignments',
            'upcoming homework', 'future homework', 'coming homework',
            'whats coming up', 'whats upcoming', 'next assignments',
            'next tasks', 'next homework', 'whats next'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'tasks.upcoming'));
        
        [
            'tasks for calculus', 'assignments for math', 'math homework',
            'programming tasks', 'physics assignments', 'course tasks',
            'calculus assignments', 'math tasks', 'programming homework',
            'physics tasks', 'cs101 assignments', 'calculus homework',
            'math assignments', 'programming assignments', 'physics homework',
            'tasks in calculus', 'assignments in math', 'homework in programming'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'tasks.course'));
        
        [
            'tasks from fatima', 'assignments from fatima arif',
            'fatima assignments', 'fatima tasks', 'fatima arif tasks',
            'tasks by fatima', 'assignments by fatima arif',
            'teacher tasks', 'faculty tasks', 'instructor assignments',
            'professor tasks', 'tasks from teacher', 'assignments from faculty'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'tasks.teacher'));
        
       
        [
            'how can i find timetable', 'how to find timetable', 'how to locate timetable',
            'how to view timetable', 'how to check timetable', 'how to get timetable',
            'how can i view timetable', 'how can i check timetable', 'how can i get timetable',
            'how can i locate timetable', 'how do i find timetable', 'how do i view timetable',
            'how do i check timetable', 'how do i get timetable', 'how do i locate timetable',
            
            'how can i find attendance', 'how to find attendance', 'how to locate attendance',
            'how to view attendance', 'how to check attendance', 'how to get attendance',
            'how can i view attendance', 'how can i check attendance', 'how can i get attendance',
            'how can i locate attendance', 'how do i find attendance', 'how do i view attendance',
            'how do i check attendance', 'how do i get attendance', 'how do i locate attendance',
            
            'how can i find schedule', 'how to find schedule', 'how to locate schedule',
            'how to view schedule', 'how to check schedule', 'how to get schedule',
            'how can i view schedule', 'how can i check schedule', 'how can i get schedule',
            'how can i locate schedule', 'how do i find schedule', 'how do i view schedule',
            'how do i check schedule', 'how do i get schedule', 'how do i locate schedule',
            
            'how can i find classes', 'how to find classes', 'how to locate classes',
            'how to view classes', 'how to check classes', 'how to get classes',
            'how can i view classes', 'how can i check classes', 'how can i get classes',
            'how can i locate classes', 'how do i find classes', 'how do i view classes',
            'how do i check classes', 'how do i get classes', 'how do i locate classes',
            
            'how can i find fees', 'how to find fees', 'how to locate fees',
            'how to view fees', 'how to check fees', 'how to get fees',
            'how can i view fees', 'how can i check fees', 'how can i get fees',
            'how can i locate fees', 'how do i find fees', 'how do i view fees',
            'how do i check fees', 'how do i get fees', 'how do i locate fees',
            
            'how can i find invoices', 'how to find invoices', 'how to locate invoices',
            'how to view invoices', 'how to check invoices', 'how to get invoices',
            'how can i view invoices', 'how can i check invoices', 'how can i get invoices',
            'how can i locate invoices', 'how do i find invoices', 'how do i view invoices',
            'how do i check invoices', 'how do i get invoices', 'how do i locate invoices',
            
            'how can i find tasks', 'how to find tasks', 'how to locate tasks',
            'how to view tasks', 'how to check tasks', 'how to get tasks',
            'how can i view tasks', 'how can i check tasks', 'how can i get tasks',
            'how can i locate tasks', 'how do i find tasks', 'how do i view tasks',
            'how do i check tasks', 'how do i get tasks', 'how do i locate tasks',
            
            'how can i find assignments', 'how to find assignments', 'how to locate assignments',
            'how to view assignments', 'how to check assignments', 'how to get assignments',
            'how can i view assignments', 'how can i check assignments', 'how can i get assignments',
            'how can i locate assignments', 'how do i find assignments', 'how do i view assignments',
            'how do i check assignments', 'how do i get assignments', 'how do i locate assignments',
            
            'how can i find results', 'how to find results', 'how to locate results',
            'how to view results', 'how to check results', 'how to get results',
            'how can i view results', 'how can i check results', 'how can i get results',
            'how can i locate results', 'how do i find results', 'how do i view results',
            'how do i check results', 'how do i get results', 'how do i locate results',
            
            'how can i find grades', 'how to find grades', 'how to locate grades',
            'how to view grades', 'how to check grades', 'how to get grades',
            'how can i view grades', 'how can i check grades', 'how can i get grades',
            'how can i locate grades', 'how do i find grades', 'how do i view grades',
            'how do i check grades', 'how do i get grades', 'how do i locate grades',
            
            'how can i find data', 'how to find data', 'how to locate data',
            'how to view data', 'how to check data', 'how to get data',
            'how can i view data', 'how can i check data', 'how can i get data',
            'how can i locate data', 'how do i find data', 'how do i view data',
            'how do i check data', 'how do i get data', 'how do i locate data',
            
            'how can i find personal info', 'how to find personal info', 'how to locate personal info',
            'how to view personal info', 'how to check personal info', 'how to get personal info',
            'how can i view personal info', 'how can i check personal info', 'how can i get personal info',
            'how can i locate personal info', 'how do i find personal info', 'how do i view personal info',
            'how do i check personal info', 'how do i get personal info', 'how do i locate personal info'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'sidebar.guidance.howto'));
        
        [
            'where can i find timetable', 'where to find timetable', 'where is timetable',
            'where can i view timetable', 'where can i check timetable', 'where can i get timetable',
            'where do i find timetable', 'where do i view timetable', 'where do i check timetable',
            'where do i get timetable', 'where is my timetable', 'where to view timetable',
            
            'where can i find attendance', 'where to find attendance', 'where is attendance',
            'where can i view attendance', 'where can i check attendance', 'where can i get attendance',
            'where do i find attendance', 'where do i view attendance', 'where do i check attendance',
            'where do i get attendance', 'where is my attendance', 'where to view attendance',
            
            'where can i find schedule', 'where to find schedule', 'where is schedule',
            'where can i view schedule', 'where can i check schedule', 'where can i get schedule',
            'where do i find schedule', 'where do i view schedule', 'where do i check schedule',
            'where do i get schedule', 'where is my schedule', 'where to view schedule',
            
            'where can i find classes', 'where to find classes', 'where are classes',
            'where can i view classes', 'where can i check classes', 'where can i get classes',
            'where do i find classes', 'where do i view classes', 'where do i check classes',
            'where do i get classes', 'where are my classes', 'where to view classes',
            
            'where can i find fees', 'where to find fees', 'where are fees',
            'where can i view fees', 'where can i check fees', 'where can i get fees',
            'where do i find fees', 'where do i view fees', 'where do i check fees',
            'where do i get fees', 'where are my fees', 'where to view fees',
            
            'where can i find invoices', 'where to find invoices', 'where are invoices',
            'where can i view invoices', 'where can i check invoices', 'where can i get invoices',
            'where do i find invoices', 'where do i view invoices', 'where do i check invoices',
            'where do i get invoices', 'where are my invoices', 'where to view invoices',
            
            'where can i find tasks', 'where to find tasks', 'where are tasks',
            'where can i view tasks', 'where can i check tasks', 'where can i get tasks',
            'where do i find tasks', 'where do i view tasks', 'where do i check tasks',
            'where do i get tasks', 'where are my tasks', 'where to view tasks',
            
            'where can i find assignments', 'where to find assignments', 'where are assignments',
            'where can i view assignments', 'where can i check assignments', 'where can i get assignments',
            'where do i find assignments', 'where do i view assignments', 'where do i check assignments',
            'where do i get assignments', 'where are my assignments', 'where to view assignments',
            
            'where can i find results', 'where to find results', 'where are results',
            'where can i view results', 'where can i check results', 'where can i get results',
            'where do i find results', 'where do i view results', 'where do i check results',
            'where do i get results', 'where are my results', 'where to view results',
            
            'where can i find grades', 'where to find grades', 'where are grades',
            'where can i view grades', 'where can i check grades', 'where can i get grades',
            'where do i find grades', 'where do i view grades', 'where do i check grades',
            'where do i get grades', 'where are my grades', 'where to view grades',
            
            'where can i find data', 'where to find data', 'where is data',
            'where can i view data', 'where can i check data', 'where can i get data',
            'where do i find data', 'where do i view data', 'where do i check data',
            'where do i get data', 'where is my data', 'where to view data',
            
            'where can i find personal info', 'where to find personal info', 'where is personal info',
            'where can i view personal info', 'where can i check personal info', 'where can i get personal info',
            'where do i find personal info', 'where do i view personal info', 'where do i check personal info',
            'where do i get personal info', 'where is my personal info', 'where to view personal info'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'sidebar.guidance.where'));
        
        [
            'show me timetable', 'show me attendance', 'show me schedule',
            'show me classes', 'show me fees', 'show me invoices',
            'show me tasks', 'show me assignments', 'show me results',
            'show me grades', 'show me data', 'show me personal info',
            'display timetable', 'display attendance', 'display schedule',
            'display classes', 'display fees', 'display invoices',
            'display tasks', 'display assignments', 'display results',
            'display grades', 'display data', 'display personal info'
        ].forEach(pattern => this.nlpManager.addDocument('en', pattern, 'sidebar.guidance.show'));
        
        this.nlpManager.addAnswer('en', 'greeting', 'Hello! How can I assist you with your academic queries today?');
        this.nlpManager.addAnswer('en', 'greeting', 'Hi there! I\'m your academic assistant. What would you like to know?');
        this.nlpManager.addAnswer('en', 'greeting', 'Greetings! Ready to help with timetable, attendance, results, fees, and more. How can I assist?');
        
        this.nlpManager.addAnswer('en', 'farewell', 'Goodbye! Have a great day ahead!');
        this.nlpManager.addAnswer('en', 'farewell', 'See you soon! Feel free to ask if you need more help.');
        this.nlpManager.addAnswer('en', 'farewell', 'Thank you! Wishing you success in your studies.');
        
        this.nlpManager.addAnswer('en', 'help', `I can help you with:
• 📅 Timetable & Schedule
• 📊 Attendance Records
• 📈 Results & Grades
• 💰 Fee Information
• 📚 Course Details
• 🎓 Batch Information
• 👤 Student Profile
• 📝 Tasks & Assignments
• 🧭 Sidebar Navigation Help

Just ask me anything like:
• "Show my timetable"
• "What's my attendance?"
• "Check my results"
• "Fee details please"
• "My current courses"
• "Show my tasks"
• "When will I graduate?"
• "Do I have scholarship?"
• "Where can I find attendance?"
• "How to view fees?"
• "Show me timetable"`);
        
        this.nlpManager.addAnswer('en', 'identity', 'I am your AI Academic Assistant! 🤖 I help students with timetable, attendance, results, fees, tasks and all academic queries.');
        this.nlpManager.addAnswer('en', 'identity', 'I\'m your intelligent academic chatbot! I can assist with all your academic needs including schedule, grades, attendance, tasks and more.');
        
        this.nlpManager.addAnswer('en', 'sidebar.guidance.howto', 'To find {{entity}}, you need to check the sidebar for "{{module}}" to access {{entity}} information.');
        this.nlpManager.addAnswer('en', 'sidebar.guidance.howto', 'You can view {{entity}} by clicking on "{{module}}" in the sidebar menu.');
        this.nlpManager.addAnswer('en', 'sidebar.guidance.howto', 'For {{entity}}, please go to the sidebar and select "{{module}}".');
        this.nlpManager.addAnswer('en', 'sidebar.guidance.howto', 'You need to see the sidebar for "{{module}}" to find {{entity}} details.');
        this.nlpManager.addAnswer('en', 'sidebar.guidance.howto', '{{entity}} information is available in the "{{module}}" section of the sidebar.');
        
        this.nlpManager.addAnswer('en', 'sidebar.guidance.where', 'To find {{entity}}, check the sidebar for "{{module}}" to access {{entity}} information.');
        this.nlpManager.addAnswer('en', 'sidebar.guidance.where', 'You can view {{entity}} by going to the "{{module}}" section in the sidebar.');
        this.nlpManager.addAnswer('en', 'sidebar.guidance.where', '{{entity}} is available in the sidebar under "{{module}}".');
        this.nlpManager.addAnswer('en', 'sidebar.guidance.where', 'Look for "{{module}}" in the sidebar menu to find {{entity}}.');
        this.nlpManager.addAnswer('en', 'sidebar.guidance.where', 'In the sidebar, click on "{{module}}" to view {{entity}}.');
        
        this.nlpManager.addAnswer('en', 'sidebar.guidance.show', 'To see {{entity}}, check the sidebar for "{{module}}" to access {{entity}} information.');
        this.nlpManager.addAnswer('en', 'sidebar.guidance.show', 'You can view {{entity}} by selecting "{{module}}" from the sidebar.');
        this.nlpManager.addAnswer('en', 'sidebar.guidance.show', '{{entity}} is displayed in the "{{module}}" section of the sidebar.');
        this.nlpManager.addAnswer('en', 'sidebar.guidance.show', 'Go to "{{module}}" in the sidebar to see {{entity}}.');
        this.nlpManager.addAnswer('en', 'sidebar.guidance.show', 'The "{{module}}" section in the sidebar shows your {{entity}}.');
        
        try {
            await this.nlpManager.train();
            console.log('✅ AI models trained successfully');
            
            // Save the trained model
            const modelDir = path.join(__dirname, '../models');
            await fs.mkdir(modelDir, { recursive: true });
            await this.nlpManager.save(path.join(modelDir, 'nlp-model.nlp'));
            console.log(' Model saved successfully');
        } catch (error) {
            console.error(' Training error:', error);
        }
    }

    async handleQuery(req, res) {
        try {
            console.log('\n' + '='.repeat(50));
            console.log(' NEW AI QUERY RECEIVED');
            console.log('='.repeat(50));
            
            const { query, studentId } = req.body;
            
            if (!query || !studentId) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Query and studentId are required" 
                });
            }

            console.log(`📝 Query: "${query}"`);
            console.log(`👤 Student ID: ${studentId}`);

            const student = await Student.findOne({ studentId }).lean();
            if (!student) {
                console.log(' Student not found in database');
                return res.status(404).json({
                    success: false,
                    message: "Student not found"
                });
            }

            console.log(`✅ Student found: ${student.firstName} ${student.lastName}`);
            console.log(`📚 Current Semester: ${student.currentSemester || 1}`);
            console.log(`🏫 Section: ${student.section}`);
            console.log(`🎓 Batch: ${student.batch}`);

            const sessionKey = `session_${studentId}`;
            let session = this.memory.get(sessionKey);
            if (!session) {
                session = {
                    studentId: studentId,
                    history: [],
                    lastIntent: null,
                    lastEntities: {},
                    lastTimestamp: Date.now(),
                    lastQuery: null,
                    lastResponse: null
                };
                this.memory.set(sessionKey, session);
                console.log('New session created');
            } else {
                console.log(' Existing session found');
            }

            session.lastTimestamp = Date.now();
            
            const isFollowUp = this.isFollowUpQuery(query, session);
            console.log(` Follow-up detection: ${isFollowUp ? 'YES' : 'NO'}`);
            
            if (isFollowUp) {
                console.log(`   Last intent: ${session.lastIntent}`);
                console.log(`   Last entities:`, session.lastEntities);
            }

            session.history.push({
                query: query,
                timestamp: Date.now(),
                isFollowUp: isFollowUp
            });

            if (session.history.length > 10) {
                session.history = session.history.slice(-10);
            }

            const aiResult = await this.processQueryWithAI(query, student, session, isFollowUp);
            console.log(` AI Analysis Result:`);
            console.log(`   Intent: ${aiResult.intent}`);
            console.log(`   Confidence: ${aiResult.confidence.toFixed(2)}`);
            console.log(`   Entities:`, aiResult.entities);
            console.log(`   Context:`, aiResult.context);

            session.lastIntent = aiResult.intent;
            session.lastEntities = aiResult.entities;
            session.lastQuery = query;

            let data = {};
            if (aiResult.intent.startsWith('sidebar.guidance')) {
                console.log(` Sidebar guidance intent - no data fetching required`);
            } else {
                console.log(` Fetching data for intent: ${aiResult.intent}`);
                data = await this.fetchDataByIntent(student, aiResult, session);
                
                Object.keys(data).forEach(key => {
                    if (key !== 'sessionContext' && key !== 'error') {
                        const dataItem = data[key];
                        if (dataItem && typeof dataItem === 'object') {
                            console.log(`   ${key}: ${dataItem.exists ? '✅ Found' : '❌ Not found'}`);
                            if (dataItem.exists && dataItem.debug) {
                                console.log(`      Debug:`, dataItem.debug);
                            }
                        }
                    }
                });
            }
            
            const response = await this.generateAIResponse(student, aiResult, data, query, session, isFollowUp);
            console.log(`💬 Response generated (${response.message.length} chars)`);
            
            session.lastResponse = response.message;
            
            this.memory.set(sessionKey, session);
            console.log(`Session updated`);

            console.log('='.repeat(50));
            res.json({
                success: true,
                response: response.message,
                data: response.data || {},
                aiAnalysis: {
                    intent: response.intent,
                    entities: response.entities,
                    confidence: response.confidence,
                    isFollowUp: isFollowUp,
                    sessionId: sessionKey
                },
                debug: {
                    studentName: `${student.firstName} ${student.lastName}`,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('\n AI CHATBOT CRITICAL ERROR ');
            console.error('Error:', error.message);
            console.error('Stack:', error.stack);
            console.error('\n');
            
            res.status(500).json({
                success: false,
                message: "AI processing error",
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    isFollowUpQuery(query, session) {
        if (!session || !session.lastIntent || session.history.length < 2) {
            return false;
        }
        
        const queryLower = query.toLowerCase().trim();
        const words = queryLower.split(/\s+/).filter(w => w.length > 0);
        
        console.log(`   Query analysis: "${queryLower}" (${words.length} words)`);
        
        const independentQueries = [
            'my batch', 'my attendance', 'my fees', 'my results', 'my timetable',
            'do i have scholarship', 'assigned courses', 'current courses',
            'when will semester end', 'what is my result', 'my personal info',
            'scholarship status', 'my section', 'completed courses',
            'my academic progress', 'dropped courses', 'credits earned',
            'where can i find', 'how to find', 'how to view', 'how to check',
            'how to locate', 'how to get', 'show me', 'display'
        ];
        
        for (const independentQuery of independentQueries) {
            if (queryLower === independentQuery || queryLower.startsWith(independentQuery + ' ')) {
                console.log(`   → Independent query detected: "${independentQuery}"`);
                return false;
            }
        }
        
        if (words.length <= 3) {
            const genericShortQueries = ['my batch', 'my fees', 'my results', 'my timetable'];
            for (const shortQuery of genericShortQueries) {
                if (queryLower.includes(shortQuery)) {
                    console.log(`   → Short but independent query: "${shortQuery}"`);
                    return false;
                }
            }
            
            if (words.length === 2 && (
                words[0] === 'physics' || words[0] === 'calculus' || words[0] === 'math' ||
                words[0] === 'programming' || words[0] === 'english' || words[0] === 'cs101' ||
                words[1] === 'result' || words[1] === 'grade' || words[1] === 'marks' ||
                words[1] === 'attendance' || words[1] === 'course'
            )) {
                console.log(`   → Course-specific query, not follow-up`);
                return false;
            }
            
            console.log(`   → Very short query (${words.length} words), treating as follow-up`);
            return true;
        }
        
        const followUpStarters = [
            'what about', 'how about', 'what else', 'anything else',
            'more about', 'also show', 'and my', 'then my',
            'next', 'after that', 'following'
        ];
        
        for (const phrase of followUpStarters) {
            if (queryLower.includes(phrase)) {
                console.log(`   → Contains follow-up phrase: "${phrase}"`);
                return true;
            }
        }
        
        if (session.lastIntent) {
            const currentIntentCategory = this.getIntentCategory(this.getQuickIntentFromQuery(queryLower));
            const lastIntentCategory = this.getIntentCategory(session.lastIntent);
            
            if (currentIntentCategory && lastIntentCategory && 
                currentIntentCategory !== lastIntentCategory) {
                console.log(`   → Different category: ${currentIntentCategory} vs ${lastIntentCategory}`);
                return false;
            }
            
            if (currentIntentCategory === lastIntentCategory && 
                currentIntentCategory !== 'general') {
                console.log(`   → New query in same category: ${currentIntentCategory}`);
                return false;
            }
        }
        
        if (queryLower.includes('it') || queryLower.includes('that') || 
            queryLower.includes('this') || queryLower.includes('those')) {
            console.log(`   → Contains pronoun indicating follow-up`);
            return true;
        }
        
        console.log(`   → Not a follow-up`);
        return false;
    }

    getQuickIntentFromQuery(queryLower) {
        if (queryLower.startsWith('how can i find ') || queryLower.startsWith('how to find ') ||
            queryLower.startsWith('how can i view ') || queryLower.startsWith('how to view ') ||
            queryLower.startsWith('how can i check ') || queryLower.startsWith('how to check ') ||
            queryLower.startsWith('how can i get ') || queryLower.startsWith('how to get ') ||
            queryLower.startsWith('how can i locate ') || queryLower.startsWith('how to locate ') ||
            queryLower.startsWith('how do i find ') || queryLower.startsWith('how do i view ') ||
            queryLower.startsWith('how do i check ') || queryLower.startsWith('how do i get ') ||
            queryLower.startsWith('how do i locate ')) {
            return 'sidebar.guidance.howto';
        }
        
        if (queryLower.startsWith('where can i find ') || queryLower.startsWith('where to find ') ||
            queryLower.startsWith('where can i view ') || queryLower.startsWith('where to view ') ||
            queryLower.startsWith('where can i check ') || queryLower.startsWith('where to check ') ||
            queryLower.startsWith('where can i get ') || queryLower.startsWith('where to get ') ||
            queryLower.startsWith('where do i find ') || queryLower.startsWith('where do i view ') ||
            queryLower.startsWith('where do i check ') || queryLower.startsWith('where do i get ') ||
            queryLower.startsWith('where is ') || queryLower.startsWith('where are ')) {
            return 'sidebar.guidance.where';
        }
        
        if (queryLower.startsWith('show me ') || queryLower.startsWith('display ')) {
            return 'sidebar.guidance.show';
        }
        
        if (queryLower.includes('timetable') || queryLower.includes('schedule') || 
            queryLower.includes('schdule') || queryLower.includes('class schedule')) {
            return 'timetable.general';
        }
        if (queryLower.includes('attendance') && queryLower.includes('calculus')) {
            return 'attendance.course';
        }
        if (queryLower.includes('attendance') && queryLower.includes('physics')) {
            return 'attendance.course';
        }
        if (queryLower.includes('attendance') && (queryLower.includes('absent') || queryLower.includes('present'))) {
            return 'attendance.detail';
        }
        if (queryLower.includes('attendance')) {
            return 'attendance.general';
        }
        if (queryLower.includes('fee') || queryLower.includes('payment') || 
            queryLower.includes('installment') || queryLower.includes('due')) {
            return 'fee.overview';
        }
        if ((queryLower.includes('result') || queryLower.includes('grade') || queryLower.includes('marks')) && 
            queryLower.includes('physics')) {
            return 'results.course';
        }
        if (queryLower.includes('result') || queryLower.includes('grade') || 
            queryLower.includes('mark') || queryLower.includes('score')) {
            return 'results.all';
        }
        if (queryLower.includes('task') || queryLower.includes('assignment') || 
            queryLower.includes('homework') || queryLower.includes('project')) {
            return 'tasks.general';
        }
        if (queryLower.includes('graduat') || queryLower.includes('batch') || 
            queryLower.includes('semester end') || queryLower.includes('admission')) {
            return 'batch.info';
        }
        if (queryLower.includes('scholarship') || 
            (queryLower.includes('do i have') && queryLower.includes('scholarship')) ||
            (queryLower.includes('am i') && queryLower.includes('scholarship'))) {
            return 'student.scholarship';
        }
        if (queryLower.includes('assigned courses') || queryLower.includes('current courses') || 
            queryLower.includes('courses i am') || queryLower.includes('my courses')) {
            return 'student.courses';
        }
        if (queryLower.includes('personal') || queryLower.includes('profile')) {
            return 'student.personal_info';
        }
        if (queryLower.includes('section')) {
            return 'student.section';
        }
        if (queryLower.includes('completed courses') || queryLower.includes('past courses')) {
            return 'student.completed_courses';
        }
        if (queryLower.includes('credit') || queryLower.includes('progress') || 
            queryLower.includes('dropped') || queryLower.includes('failed')) {
            return 'student.academic_progress';
        }
        return null;
    }

    getIntentCategory(intent) {
        if (!intent) return null;
        if (intent.startsWith('timetable.')) return 'timetable';
        if (intent.startsWith('attendance.')) return 'attendance';
        if (intent.startsWith('results.')) return 'results';
        if (intent.startsWith('fee.')) return 'fee';
        if (intent.startsWith('tasks.')) return 'tasks';
        if (intent.startsWith('batch.')) return 'batch';
        if (intent.startsWith('student.')) return 'student';
        if (intent.startsWith('sidebar.guidance')) return 'sidebar';
        return 'general';
    }

    async processQueryWithAI(query, student, session, isFollowUp = false) {
        const result = {
            intent: null,
            entities: {},
            confidence: 0,
            context: {},
            format: 'detailed'
        };

        try {
            console.log(`    Processing query with NLP...`);
            
            const nlpResult = await this.nlpManager.process('en', query);
            
            result.intent = nlpResult.intent || 'general';
            result.confidence = nlpResult.score || 0;
            
            console.log(`   → NLP result: ${result.intent} (confidence: ${result.confidence.toFixed(2)})`);

            const queryLower = query.toLowerCase();
            if (!result.intent.startsWith('sidebar.guidance') && 
                (queryLower.includes('how can i find') || 
                 queryLower.includes('how to find') ||
                 queryLower.includes('where can i find') ||
                 queryLower.includes('where to find') ||
                 queryLower.includes('show me') ||
                 queryLower.includes('display ') ||
                 (queryLower.includes('how') && queryLower.includes('find') && 
                  (queryLower.includes('timetable') || queryLower.includes('attendance') || 
                   queryLower.includes('schedule') || queryLower.includes('fees') ||
                   queryLower.includes('results') || queryLower.includes('tasks'))))) {
                
                console.log(`   🔧 Overriding intent to sidebar guidance`);
                if (queryLower.includes('how can i find') || queryLower.includes('how to find') || 
                    queryLower.includes('how do i find')) {
                    result.intent = 'sidebar.guidance.howto';
                } else if (queryLower.includes('where can i find') || queryLower.includes('where to find') || 
                          queryLower.includes('where is') || queryLower.includes('where are')) {
                    result.intent = 'sidebar.guidance.where';
                } else if (queryLower.includes('show me') || queryLower.includes('display ')) {
                    result.intent = 'sidebar.guidance.show';
                } else {
                    result.intent = 'sidebar.guidance.howto';
                }
                result.confidence = 1.0; 
            }
            
            this.extractEntities(query, student, result, session, isFollowUp);
            console.log(`   → Extracted entities:`, result.entities);
            
            if (result.confidence < 0.3) {
                console.log(`   → Low confidence, using fallback detection`);
                const fallbackIntent = this.resolveLowConfidenceIntent(query, result, session, isFollowUp);
                if (fallbackIntent !== result.intent) {
                    result.intent = fallbackIntent;
                    console.log(`   → Fallback intent: ${result.intent}`);
                    this.extractEntities(query, student, result, session, isFollowUp);
                }
            }
            
            if (isFollowUp) {
                result.context.isFollowUp = true;
                result.context.previousIntent = session.lastIntent;
                result.context.previousEntities = session.lastEntities;
                
                console.log(`   → Marked as follow-up to: ${session.lastIntent}`);
                
                if (query.split(' ').length <= 2) {
                    const lastCat = this.getIntentCategory(session.lastIntent);
                    const currentCat = this.getIntentCategory(result.intent);
                    
                    if (lastCat && currentCat && lastCat === currentCat) {
                        console.log(`   → Same category, inheriting relevant entities`);
                        if (lastCat === 'attendance' || lastCat === 'results') {
                            if (!result.entities.courseCode && session.lastEntities.courseCode) {
                                result.entities.courseCode = session.lastEntities.courseCode;
                            }
                            if (!result.entities.courseName && session.lastEntities.courseName) {
                                result.entities.courseName = session.lastEntities.courseName;
                            }
                        }
                        if (lastCat !== 'timetable' && lastCat !== 'tasks') {
                            if (!result.entities.semester && session.lastEntities.semester) {
                                result.entities.semester = session.lastEntities.semester;
                            }
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error(`    NLP processing error:`, error.message);
            result.intent = this.fallbackIntentRecognition(query, session, isFollowUp);
            this.extractEntities(query, student, result, session, isFollowUp);
        }
        
        return result;
    }

    extractEntities(query, student, result, session, isFollowUp) {
        const queryLower = query.toLowerCase();
        
        console.log(`    Extracting entities from: "${queryLower}"`);
        
        if (!isFollowUp || (session.lastIntent && 
            this.getIntentCategory(session.lastIntent) !== this.getIntentCategory(result.intent))) {
            result.entities = {};
        }
        
        if (result.intent.startsWith('sidebar.guidance')) {
            const moduleMap = {
                'attendance': 'Attendance',
                'schedule': 'TimeTable',
                'schdule': 'TimeTable', 
                'timetable': 'TimeTable',
                'class': 'TimeTable',
                'classes': 'TimeTable',
                'fee': 'Invoices',
                'fees': 'Invoices',
                'invoice': 'Invoices',
                'invoices': 'Invoices',
                'payment': 'Invoices',
                'task': 'Tasks',
                'tasks': 'Tasks',
                'assignment': 'Tasks',
                'assignments': 'Tasks',
                'homework': 'Tasks',
                'result': 'Result',
                'results': 'Result',
                'grade': 'Result',
                'grades': 'Result',
                'mark': 'Result',
                'marks': 'Result',
                'data': 'Dashboard',
                'personal': 'Dashboard',
                'profile': 'Dashboard',
                'info': 'Dashboard',
                'dashboard': 'Dashboard'
            };
            
            for (const [keyword, module] of Object.entries(moduleMap)) {
                if (new RegExp(`\\b${keyword}\\b`, 'i').test(queryLower)) {
                    result.entities.entity = keyword;
                    result.entities.module = module;
                    console.log(`     ✅ Detected entity: ${keyword} → Module: ${module}`);
                    break;
                }
            }
            
            if (!result.entities.module) {
                result.entities.module = 'Dashboard';
                result.entities.entity = 'information';
            }
            
            result.entities.semester = student.currentSemester || 1;
            console.log(`       Default semester: ${result.entities.semester}`);
            
            console.log(`    Final entities for sidebar:`, result.entities);
            return; 
        }
        
        const dayPatterns = {
            'monday': ['monday', 'moday', 'monda', 'mon', 'mnday', 'mondayy', 'mondays'],
            'tuesday': ['tuesday', 'tuseday', 'tues', 'tue', 'tusday', 'tuesdays'],
            'wednesday': ['wednesday', 'wensday', 'wednes', 'wed', 'wedsday', 'wednesdays'],
            'thursday': ['thursday', 'thrusday', 'thurs', 'thu', 'thrsday', 'thursdays'],
            'friday': ['friday', 'fridy', 'fri', 'fryday', 'fridays'],
            'saturday': ['saturday', 'saterday', 'sat', 'satday', 'saturdays'],
            'sunday': ['sunday', 'sund', 'sun', 'sundays']
        };
        
        for (const [day, patterns] of Object.entries(dayPatterns)) {
            for (const pattern of patterns) {
                if (new RegExp(`\\b${pattern}\\b`, 'i').test(query)) {
                    result.entities.day = day;
                    console.log(`     ✅ Extracted day: ${day} (from: ${pattern})`);
                    break;
                }
            }
            if (result.entities.day) break;
        }
        
        const coursePatterns = [
            /\b([A-Z]{2,}\s?\d{3,})\b/i,  
            /\b(CS|MATH|PHY|ENG|IT|COM|STAT)\s?(\d{3})\b/i 
        ];
        
        for (const pattern of coursePatterns) {
            const match = queryLower.match(pattern);
            if (match) {
                result.entities.courseCode = match[0].replace(/\s+/g, '').toUpperCase();
                console.log(`     Extracted course code: ${result.entities.courseCode}`);
                break;
            }
        }
        
        const courseKeywords = {
            'calculus': ['calculus', 'calclus', 'calc', 'math'],
            'programming': ['programming', 'programing', 'coding', 'cs101'],
            'physics': ['physics', 'phy'],
            'english': ['english', 'eng'],
            'mathematics': ['mathematics', 'math', 'maths'],
            'computer': ['computer', 'comp', 'cs'],
            'data structures': ['data structures', 'ds'],
            'algorithms': ['algorithms', 'algo']
        };
        
        for (const [courseName, keywords] of Object.entries(courseKeywords)) {
            for (const keyword of keywords) {
                if (new RegExp(`\\b${keyword}\\b`, 'i').test(query)) {
                    result.entities.courseName = courseName;
                    console.log(`      Extracted course name: ${courseName} (from: ${keyword})`);
                    break;
                }
            }
            if (result.entities.courseName) break;
        }
        
        const semesterMatch = queryLower.match(/semester\s*(\d+)/i) || 
                             queryLower.match(/sem\s*(\d+)/i) ||
                             queryLower.match(/(\d+)(?:st|nd|rd|th)?\s*semester/i);
        if (semesterMatch) {
            result.entities.semester = parseInt(semesterMatch[1]);
            console.log(`     Extracted semester: ${result.entities.semester}`);
        }
        
        if (queryLower.includes('today')) {
            result.entities.time = 'today';
            console.log(`      Time reference: today`);
        } else if (queryLower.includes('tomorrow') || queryLower.includes('tmw')) {
            result.entities.time = 'tomorrow';
            console.log(`      Time reference: tomorrow`);
        } else if (queryLower.includes('this week') || queryLower.includes('week')) {
            result.entities.time = 'this_week';
            console.log(`      Time reference: this week`);
        }
        
        if (queryLower.includes('absent') || queryLower.includes('missed') || 
            queryLower.includes('not present')) {
            result.entities.attendanceType = 'absent';
            console.log(`      Attendance type: absent`);
        } else if (queryLower.includes('present')) {
            result.entities.attendanceType = 'present';
            console.log(`      Attendance type: present`);
        }
                if (queryLower.includes('result') || queryLower.includes('grade') || 
            queryLower.includes('mark') || queryLower.includes('score')) {
            result.entities.hasResultQuery = true;
            console.log(`      Result query detected`);
        }
        
        if (queryLower.includes('attendance')) {
            result.entities.hasAttendanceQuery = true;
            console.log(`      Attendance query detected`);
        }
        
        if (queryLower.includes('scholarship') || 
            (queryLower.includes('do i have') && queryLower.includes('scholarship')) ||
            (queryLower.includes('am i') && queryLower.includes('scholarship'))) {
            result.entities.hasScholarshipQuery = true;
            console.log(`      Scholarship query detected`);
        }
        
        if (queryLower.includes('course') || queryLower.includes('subject') || 
            queryLower.includes('assigned') || queryLower.includes('current')) {
            result.entities.hasCourseQuery = true;
            console.log(`      Course query detected`);
        }
        
        if (queryLower.includes('batch') || queryLower.includes('graduat') || 
            queryLower.includes('semester end') || queryLower.includes('admission')) {
            result.entities.hasBatchQuery = true;
            console.log(`      Batch query detected`);
        }
        
        if (!result.entities.semester) {
            result.entities.semester = student.currentSemester || 1;
            console.log(`       Default semester: ${result.entities.semester}`);
        }
        
        console.log(`    Final entities:`, result.entities);
    }

    resolveLowConfidenceIntent(query, result, session, isFollowUp) {
        const queryLower = query.toLowerCase();
        console.log(`    Resolving low confidence intent for: "${queryLower}"`);
        
        if (queryLower.includes('how can i find') || queryLower.includes('how to find') ||
            queryLower.includes('where can i find') || queryLower.includes('where to find') ||
            queryLower.includes('show me') || queryLower.includes('display ')) {
            
            if (queryLower.includes('how can i find') || queryLower.includes('how to find') || 
                queryLower.includes('how do i find')) {
                console.log(`     → Sidebar guidance (howto) detected`);
                return 'sidebar.guidance.howto';
            } else if (queryLower.includes('where can i find') || queryLower.includes('where to find') || 
                      queryLower.includes('where is') || queryLower.includes('where are')) {
                console.log(`     → Sidebar guidance (where) detected`);
                return 'sidebar.guidance.where';
            } else if (queryLower.includes('show me') || queryLower.includes('display ')) {
                console.log(`     → Sidebar guidance (show) detected`);
                return 'sidebar.guidance.show';
            }
        }
        
        if (isFollowUp && session && session.lastIntent) {
            const lastCat = this.getIntentCategory(session.lastIntent);
            const currentCat = this.getIntentCategory(result.intent);
            
            if (lastCat && currentCat && lastCat === currentCat && query.split(' ').length <= 3) {
                console.log(`     → Same category short follow-up: ${session.lastIntent}`);
                return session.lastIntent;
            }
        }
        
        const keywordMap = {
            'timetable': 'timetable.general',
            'schedule': 'timetable.general',
            'schdule': 'timetable.general',
            'class': 'timetable.general',
            'lecture': 'timetable.general',
            'routine': 'timetable.general',
            'attendance': 'attendance.general',
            'present': 'attendance.detail',
            'absent': 'attendance.detail',
            'missed': 'attendance.detail',
            'fee': 'fee.overview',
            'fees': 'fee.overview',
            'payment': 'fee.overview',
            'installment': 'fee.overview',
            'due': 'fee.overview',
            'pending': 'fee.overview',
            'unpaid': 'fee.overview',
            'balance': 'fee.overview',
            'result': 'results.all',
            'results': 'results.all',
            'grade': 'results.all',
            'grades': 'results.all',
            'mark': 'results.all',
            'marks': 'results.all',
            'score': 'results.all',
            'gpa': 'results.all',
            'cgpa': 'results.all',
            'graduat': 'batch.info',
            'batch': 'batch.info',
            'admission': 'batch.info',
            'apply': 'batch.info',
            'program': 'batch.info',
            'semester': 'batch.info',
            'personal': 'student.personal_info',
            'profile': 'student.personal_info',
            'scholarship': 'student.scholarship',
            'section': 'student.section',
            'course': 'student.courses',
            'assigned': 'student.courses',
            'current': 'student.courses',
            'credit': 'student.academic_progress',
            'dropped': 'student.academic_progress',
            'failed': 'student.academic_progress',
            'progress': 'student.academic_progress',
            'completed': 'student.completed_courses',
            'past': 'student.completed_courses',
            'task': 'tasks.general',
            'tasks': 'tasks.general',
            'assignment': 'tasks.general',
            'assignments': 'tasks.general',
            'homework': 'tasks.general',
            'project': 'tasks.general',
        };
        
        const twoWordPatterns = {
            'my attendance': 'attendance.general',
            'my fees': 'fee.overview',
            'my results': 'results.all',
            'my timetable': 'timetable.general',
            'my batch': 'batch.info',
            'do i have scholarship': 'student.scholarship',
            'scholarship status': 'student.scholarship',
            'assigned courses': 'student.courses',
            'current courses': 'student.courses',
            'completed courses': 'student.completed_courses',
            'dropped courses': 'student.academic_progress',
            'credits earned': 'student.academic_progress',
            'personal info': 'student.personal_info',
            'my section': 'student.section',
            'semester end': 'batch.info',
            'admission dates': 'batch.info',
            'how can i find': 'sidebar.guidance.howto',
            'where can i find': 'sidebar.guidance.where',
            'show me': 'sidebar.guidance.show'
        };
        
        for (const [phrase, intent] of Object.entries(twoWordPatterns)) {
            if (queryLower.includes(phrase)) {
                console.log(`     → Phrase matched: "${phrase}" → ${intent}`);
                return intent;
            }
        }
        
        for (const [keyword, intent] of Object.entries(keywordMap)) {
            if (queryLower.includes(keyword)) {
                console.log(`     → Keyword matched: "${keyword}" → ${intent}`);
                return intent;
            }
        }
        
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
                     'moday', 'tuseday', 'wensday', 'thrusday', 'saterday'];
        for (const day of days) {
            if (queryLower.includes(day)) {
                console.log(`     → Day detected: "${day}" → timetable.day_schedule`);
                return 'timetable.day_schedule';
            }
        }
        
        console.log(`     → No keywords matched, using general intent`);
        return 'general';
    }

    fallbackIntentRecognition(query, session, isFollowUp) {
        const queryLower = query.toLowerCase();
        console.log(`   🆘 Fallback intent recognition for: "${queryLower}"`);
        
        // Basic patterns
        if (queryLower.match(/\b(hi|hello|hey|greetings|good morning|good afternoon)\b/)) {
            return 'greeting';
        }
        if (queryLower.match(/\b(bye|goodbye|thanks|thank you|see you)\b/)) {
            return 'farewell';
        }
        if (queryLower.match(/\b(help|assist|support|what can you do)\b/)) {
            return 'help';
        }
        if (queryLower.match(/\b(who are you|what are you|introduce yourself)\b/)) {
            return 'identity';
        }
        
        if (queryLower.includes('how can i find') || queryLower.includes('how to find') ||
            queryLower.includes('where can i find') || queryLower.includes('where to find') ||
            queryLower.includes('show me') || queryLower.includes('display ')) {
            
            if (queryLower.includes('how can i find') || queryLower.includes('how to find')) {
                return 'sidebar.guidance.howto';
            } else if (queryLower.includes('where can i find') || queryLower.includes('where to find')) {
                return 'sidebar.guidance.where';
            } else if (queryLower.includes('show me') || queryLower.includes('display ')) {
                return 'sidebar.guidance.show';
            }
        }
        
        if (queryLower.includes('my attendance')) {
            return 'attendance.general';
        }
        if (queryLower.includes('attendance in') || queryLower.includes('attendance for')) {
            return 'attendance.course';
        }
        if (queryLower.includes('absent') || queryLower.includes('present')) {
            return 'attendance.detail';
        }
        if (queryLower.includes('my fees') || queryLower.includes('fee')) {
            return 'fee.overview';
        }
        if (queryLower.includes('my results') || queryLower.includes('result in')) {
            if (queryLower.includes('physics') || queryLower.includes('calculus') || 
                queryLower.includes('math') || queryLower.includes('programming')) {
                return 'results.course';
            }
            return 'results.all';
        }
        if (queryLower.includes('my timetable') || queryLower.includes('schedule')) {
            return 'timetable.general';
        }
        if (queryLower.includes('my batch') || queryLower.includes('graduation') || 
            queryLower.includes('semester end')) {
            return 'batch.info';
        }
        if (queryLower.includes('do i have scholarship') || queryLower.includes('scholarship status')) {
            return 'student.scholarship';
        }
        if (queryLower.includes('assigned courses') || queryLower.includes('current courses')) {
            return 'student.courses';
        }
        if (queryLower.includes('personal info') || queryLower.includes('my profile')) {
            return 'student.personal_info';
        }
        if (queryLower.includes('my section')) {
            return 'student.section';
        }
        if (queryLower.includes('completed courses') || queryLower.includes('past courses')) {
            return 'student.completed_courses';
        }
        if (queryLower.includes('credits') || queryLower.includes('dropped') || 
            queryLower.includes('progress')) {
            return 'student.academic_progress';
        }
        if (queryLower.includes('task') || queryLower.includes('assignment')) {
            return 'tasks.general';
        }
        
        if (isFollowUp && session && session.lastIntent && query.split(' ').length <= 2) {
            return session.lastIntent;
        }
        
        return 'general';
    }

    async fetchDataByIntent(student, aiResult, session) {
        const intent = aiResult.intent;
        const data = {};
        
        console.log(`   📥 Fetching data for intent: ${intent}`);
        
        try {
            const fetchPromises = [];
            
            if (intent.startsWith('timetable.')) {
                console.log(`     → Will fetch timetable data`);
                fetchPromises.push(
                    this.fetchTimetableData(student, aiResult).then(timetableData => {
                        data.timetable = timetableData;
                        console.log(`     ← Timetable data: ${timetableData.exists ? 'FOUND' : 'NOT FOUND'}`);
                    }).catch(error => {
                        console.error(`     ← Timetable fetch error:`, error.message);
                        data.timetable = { exists: false, error: error.message };
                    })
                );
            }
            
            if (intent.startsWith('fee.')) {
                console.log(`     → Will fetch fee data`);
                fetchPromises.push(
                    this.fetchFeeData(student, aiResult).then(feeData => {
                        data.fee = feeData;
                        console.log(`     ← Fee data: ${feeData.exists ? 'FOUND' : 'NOT FOUND'}`);
                    }).catch(error => {
                        console.error(`     ← Fee fetch error:`, error.message);
                        data.fee = { exists: false, error: error.message };
                    })
                );
            }
            
            if (intent.startsWith('attendance.')) {
                console.log(`     → Will fetch attendance data`);
                fetchPromises.push(
                    this.fetchAttendanceData(student, aiResult).then(attendanceData => {
                        data.attendance = attendanceData;
                        console.log(`     ← Attendance data: ${attendanceData.exists ? 'FOUND' : 'NOT FOUND'}`);
                    }).catch(error => {
                        console.error(`     ← Attendance fetch error:`, error.message);
                        data.attendance = { exists: false, error: error.message };
                    })
                );
            }
            
            if (intent.startsWith('results.')) {
                console.log(`     → Will fetch results data`);
                fetchPromises.push(
                    this.fetchResultsData(student, aiResult).then(resultsData => {
                        data.results = resultsData;
                        console.log(`     ← Results data: ${resultsData.exists ? 'FOUND' : 'NOT FOUND'}`);
                    }).catch(error => {
                        console.error(`     ← Results fetch error:`, error.message);
                        data.results = { exists: false, error: error.message };
                    })
                );
            }
            
            if (intent === 'batch.info' || aiResult.entities.hasBatchQuery) {
                console.log(`     → Will fetch batch data`);
                fetchPromises.push(
                    this.fetchBatchData(student, aiResult).then(batchData => {
                        data.batch = batchData;
                        console.log(`     ← Batch data: ${batchData.exists ? 'FOUND' : 'NOT FOUND'}`);
                    }).catch(error => {
                        console.error(`     ← Batch fetch error:`, error.message);
                        data.batch = { exists: false, error: error.message };
                    })
                );
            }
            
            if (intent.startsWith('student.') || aiResult.entities.hasScholarshipQuery || 
                aiResult.entities.hasCourseQuery) {
                console.log(`     → Will fetch student info data`);
                fetchPromises.push(
                    this.fetchStudentInfoData(student, aiResult, intent).then(studentInfoData => {
                        data.studentInfo = studentInfoData;
                        console.log(`     ← Student info data: ${studentInfoData.exists ? 'FOUND' : 'NOT FOUND'}`);
                    }).catch(error => {
                        console.error(`     ← Student info fetch error:`, error.message);
                        data.studentInfo = { exists: false, error: error.message };
                    })
                );
            }
            
            if (intent.startsWith('tasks.')) {
                console.log(`     → Will fetch tasks data`);
                fetchPromises.push(
                    this.fetchTasksData(student, aiResult).then(tasksData => {
                        data.tasks = tasksData;
                        console.log(`     ← Tasks data: ${tasksData.exists ? 'FOUND' : 'NOT FOUND'}`);
                    }).catch(error => {
                        console.error(`     ← Tasks fetch error:`, error.message);
                        data.tasks = { exists: false, error: error.message };
                    })
                );
            }
            
            if (fetchPromises.length > 0) {
                console.log(`     ⏳ Waiting for ${fetchPromises.length} data fetch(es)...`);
                await Promise.all(fetchPromises);
                console.log(`     ✅ All data fetched`);
            } else {
                console.log(`     ℹ️  No data to fetch for this intent`);
            }
            
            data.sessionContext = {
                lastIntent: session ? session.lastIntent : null,
                isFollowUp: aiResult.context?.isFollowUp || false,
                previousQuery: session && session.history.length > 1 ? 
                    session.history[session.history.length - 2].query : null
            };
            
        } catch (error) {
            console.error(`   ❌ Data fetch overall error:`, error.message);
            data.error = error.message;
            data.fetched = false;
        }
        
        return data;
    }

    async fetchStudentInfoData(student, aiResult, intent) {
        try {
            console.log(`       👤 Fetching student info data for intent: ${intent}`);
            
            const hasScholarship = student.isScholarshipApplicant || false;
            const scholarshipPercentage = student.scholarshipPercentage || 0;
            
            const section = student.section || 'Not assigned';
            
            const academicProgress = student.academicProgress || {};
            const currentSemester = student.currentSemester || 1;
            
            const currentSemesterData = academicProgress.semesters?.find(s => 
                s.semesterNumber === currentSemester
            );
            
            const completedSemesters = academicProgress.semesters?.filter(s => 
                s.status === 'completed'
            ) || [];
            
            const inProgressSemesters = academicProgress.semesters?.filter(s => 
                s.status === 'in-progress' || s.status === 'registered'
            ) || [];
            
            const upcomingSemesters = academicProgress.semesters?.filter(s => 
                s.status === 'upcoming'
            ) || [];
            
            let specificData = {};
            
            if (intent === 'student.scholarship') {
                specificData = {
                    hasScholarship: hasScholarship,
                    percentage: scholarshipPercentage,
                    type: student.admissionType || 'Regular',
                    details: `You have a ${scholarshipPercentage}% scholarship (${student.admissionType})`
                };
            }
            
            else if (intent === 'student.courses') {
                const currentCourses = [];
                if (currentSemesterData && currentSemesterData.courses) {
                    currentSemesterData.courses.forEach(course => {
                        if (course.status === 'registered' || course.status === 'in-progress') {
                            currentCourses.push({
                                courseCode: course.courseCode,
                                courseName: course.courseName,
                                credits: course.creditsEarned || 0,
                                status: course.status,
                                semester: currentSemester
                            });
                        }
                    });
                }
                
                specificData = {
                    currentSemester: currentSemester,
                    totalCourses: currentCourses.length,
                    courses: currentCourses,
                    semesterName: currentSemesterData?.name || `Semester ${currentSemester}`
                };
            }
            
            else if (intent === 'student.completed_courses') {
                const completedCourses = [];
                completedSemesters.forEach(semester => {
                    if (semester.courses) {
                        semester.courses.forEach(course => {
                            if (course.status === 'completed') {
                                completedCourses.push({
                                    courseCode: course.courseCode,
                                    courseName: course.courseName,
                                    semester: semester.semesterNumber,
                                    grade: course.grade,
                                    credits: course.creditsEarned || 0
                                });
                            }
                        });
                    }
                });
                
                specificData = {
                    totalCompleted: completedCourses.length,
                    courses: completedCourses,
                    semesters: completedSemesters.map(s => s.semesterNumber)
                };
            }
            
            else if (intent === 'student.academic_progress') {
                const droppedCourses = [];
                const allCourses = [];
                
                academicProgress.semesters?.forEach(semester => {
                    if (semester.courses) {
                        semester.courses.forEach(course => {
                            allCourses.push({
                                courseCode: course.courseCode,
                                courseName: course.courseName,
                                semester: semester.semesterNumber,
                                grade: course.grade,
                                status: course.status,
                                credits: course.creditsEarned || 0,
                                isDropped: course.grade === 'D' || course.grade === 'F' || course.grade === 'W'
                            });
                            
                            if (course.grade === 'D' || course.grade === 'F' || course.grade === 'W') {
                                droppedCourses.push({
                                    courseCode: course.courseCode,
                                    courseName: course.courseName,
                                    semester: semester.semesterNumber,
                                    grade: course.grade
                                });
                            }
                        });
                    }
                });
                
                specificData = {
                    totalCreditsEarned: academicProgress.totalCreditsEarned || 0,
                    totalCreditsRequired: academicProgress.totalCreditsRequired || 133,
                    completionPercentage: academicProgress.completionPercentage || 0,
                    cumulativeGPA: academicProgress.cumulativeGPA || 0,
                    currentSemesterCredits: currentSemesterData?.courses?.reduce((sum, course) => 
                        sum + (course.creditsEarned || 0), 0) || 0,
                    droppedCourses: droppedCourses,
                    totalCourses: allCourses.length
                };
            }
            
            else if (intent === 'student.section') {
                specificData = {
                    section: section,
                    batch: student.batch,
                    currentSemester: currentSemester
                };
            }
            
            else if (intent === 'student.personal_info') {
                specificData = {
                    studentId: student.studentId,
                    name: `${student.firstName} ${student.lastName}`,
                    email: student.universityEmail || student.personalEmail,
                    contact: student.contactNumber,
                    address: `${student.address}, ${student.city}, ${student.province}`,
                    birthDate: student.birthDate ? 
                        new Date(student.birthDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        }) : 'Not specified',
                    gender: student.gender,
                    bloodGroup: student.bloodGroup
                };
            }
            
            return {
                exists: true,
                intent: intent,
                personalInfo: {
                    studentId: student.studentId,
                    name: `${student.firstName} ${student.lastName}`,
                    section: section
                },
                scholarship: {
                    hasScholarship: hasScholarship,
                    percentage: scholarshipPercentage,
                    type: student.admissionType || 'Regular'
                },
                academicProgress: {
                    currentSemester: currentSemester,
                    totalCreditsEarned: academicProgress.totalCreditsEarned || 0,
                    totalCreditsRequired: academicProgress.totalCreditsRequired || 133,
                    completionPercentage: academicProgress.completionPercentage || 0,
                    cumulativeGPA: academicProgress.cumulativeGPA || 0
                },
                semesters: {
                    current: inProgressSemesters.length,
                    completed: completedSemesters.length,
                    upcoming: upcomingSemesters.length,
                    total: academicProgress.semesters?.length || 0
                },
                specificData: specificData,
                aiContext: aiResult.entities,
                debug: {
                    studentId: student.studentId,
                    currentSemester: currentSemester,
                    intent: intent
                }
            };
            
        } catch (error) {
            console.error(`         ❌ Student info fetch error:`, error.message);
            return { 
                exists: false, 
                error: error.message,
                debug: { studentId: student.studentId, intent: intent }
            };
        }
    }

    async fetchBatchData(student, aiResult) {
        try {
            console.log(`       🎓 Fetching batch data...`);
            
            const batch = await Batch.findById(student.batch).lean();
            if (!batch) {
                return { 
                    exists: false, 
                    message: "Batch information not found",
                    debug: { batchId: student.batch }
                };
            }
            
            const currentSemester = student.currentSemester || 1;
            const semesterData = batch.academicCalendar?.find(s => s.semester === currentSemester);
            
            let targetSemesterData = semesterData;
            if (aiResult.entities.semester) {
                targetSemesterData = batch.academicCalendar?.find(s => s.semester === aiResult.entities.semester);
            }
            
            const admissionStartDate = batch.admissionStartDate ? 
                new Date(batch.admissionStartDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }) : 'Not specified';
            
            const admissionEndDate = batch.admissionEndDate ? 
                new Date(batch.admissionEndDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }) : 'Not specified';
            
            return {
                exists: true,
                batchName: batch.batchName,
                department: batch.departmentName,
                enrollmentYear: batch.enrollmentYear,
                graduationYear: batch.graduationYear,
                totalSemesters: batch.totalSemesters || 8,
                currentSemester: currentSemester,
                admissionStartDate: admissionStartDate,
                admissionEndDate: admissionEndDate,
                semesterStart: batch.semesterStart || 'Fall',
                semesterData: targetSemesterData || semesterData,
                allSemesters: batch.academicCalendar || [],
                aiContext: aiResult.entities,
                debug: {
                    batchId: student.batch,
                    currentSemester: currentSemester,
                    hasSemesterData: !!targetSemesterData
                }
            };
            
        } catch (error) {
            console.error(`         ❌ Batch fetch error:`, error.message);
            return { 
                exists: false, 
                error: error.message,
                debug: { studentId: student.studentId }
            };
        }
    }

    async fetchAttendanceData(student, aiResult) {
        try {
            console.log(`       📊 Fetching attendance data...`);
            
            const attendance = await StudentAttendance.findOne({ 
                studentId: student.studentId 
            }).lean();
            
            if (!attendance) {
                return { 
                    exists: false, 
                    message: "No attendance records found",
                    debug: { studentId: student.studentId }
                };
            }
            
            const currentSemester = student.currentSemester || 1;
            const targetSemester = aiResult.entities.semester || currentSemester;
            
            const semesterData = attendance.semesters?.find(s => 
                s.semesterNumber === targetSemester
            );
            
            if (!semesterData || !semesterData.courses) {
                return { 
                    exists: false, 
                    message: `No attendance records for semester ${targetSemester}`,
                    debug: { 
                        studentId: student.studentId,
                        requestedSemester: targetSemester,
                        availableSemesters: attendance.semesters?.map(s => s.semesterNumber) || []
                    }
                };
            }
            
            const courseAttendances = [];
            let overallPresent = 0;
            let overallTotal = 0;
            let overallAbsent = 0;
            
            semesterData.courses.forEach(course => {
                const presentCount = course.attendanceRecords?.filter(
                    r => r.status === 'Present'
                ).length || 0;
                
                const absentCount = course.attendanceRecords?.filter(
                    r => r.status === 'Absent'
                ).length || 0;
                
                const totalCount = course.attendanceRecords?.length || 0;
                const percentage = course.percentage || 0;
                
                courseAttendances.push({
                    courseCode: course.courseCode,
                    courseName: course.courseName,
                    percentage: percentage,
                    presentCount: presentCount,
                    absentCount: absentCount,
                    totalCount: totalCount,
                    status: percentage >= 75 ? 'Good' : 'Warning',
                    attendanceRecords: course.attendanceRecords || []
                });
                
                overallPresent += presentCount;
                overallAbsent += absentCount;
                overallTotal += totalCount;
            });
            
            const overallPercentage = overallTotal > 0 ? 
                ((overallPresent / overallTotal) * 100).toFixed(1) : '0.0';
            
            let filteredCourses = courseAttendances;
            if (aiResult.entities.courseCode) {
                filteredCourses = courseAttendances.filter(c => 
                    c.courseCode === aiResult.entities.courseCode
                );
            } else if (aiResult.entities.courseName) {
                const courseNameLower = aiResult.entities.courseName.toLowerCase();
                filteredCourses = courseAttendances.filter(c => 
                    c.courseName.toLowerCase().includes(courseNameLower)
                );
            }
            
            let absentDetails = [];
            let presentDetails = [];
            if (aiResult.intent === 'attendance.detail' || aiResult.entities.attendanceType) {
                filteredCourses.forEach(course => {
                    if (course.attendanceRecords) {
                        course.attendanceRecords.forEach(record => {
                            if (aiResult.entities.attendanceType === 'absent' && record.status === 'Absent') {
                                absentDetails.push({
                                    course: course.courseName,
                                    date: record.date,
                                    status: record.status
                                });
                            } else if (aiResult.entities.attendanceType === 'present' && record.status === 'Present') {
                                presentDetails.push({
                                    course: course.courseName,
                                    date: record.date,
                                    status: record.status
                                });
                            }
                        });
                    }
                });
            }
            
            return {
                exists: true,
                semester: targetSemester,
                overall: {
                    percentage: overallPercentage,
                    presentCount: overallPresent,
                    absentCount: overallAbsent,
                    totalCount: overallTotal
                },
                courses: filteredCourses,
                details: {
                    absent: absentDetails,
                    present: presentDetails
                },
                aiContext: aiResult.entities,
                debug: {
                    studentId: student.studentId,
                    semester: targetSemester,
                    totalCourses: courseAttendances.length,
                    filteredCourses: filteredCourses.length,
                    hasAbsentDetails: absentDetails.length > 0,
                    hasPresentDetails: presentDetails.length > 0
                }
            };
            
        } catch (error) {
            console.error(`         ❌ Attendance fetch error:`, error.message);
            return { 
                exists: false, 
                error: error.message,
                debug: { studentId: student.studentId }
            };
        }
    }

    async fetchResultsData(student, aiResult) {
        try {
            console.log(`       📈 Fetching results data...`);
            
            const results = await Result.find({
                'results.studentId': student.studentId
            }).lean();
            
            if (!results || results.length === 0) {
                return { 
                    exists: false, 
                    message: "No results found",
                    debug: { studentId: student.studentId }
                };
            }
            
            const studentResults = [];
            
            results.forEach(resultDoc => {
                const studentResult = resultDoc.results?.find(r => 
                    r.studentId === student.studentId
                );
                
                if (studentResult) {
                    studentResults.push({
                        courseCode: resultDoc.courseCode,
                        courseName: resultDoc.courseName,
                        semester: resultDoc.semester || 1,
                        grade: studentResult.grade,
                        gradePoints: studentResult.gradePoints || 0,
                        obtainedMarks: studentResult.obtainedMarks,
                        totalMarks: studentResult.totalMarks || 100,
                        percentage: studentResult.totalMarks > 0 ? 
                            ((studentResult.obtainedMarks / studentResult.totalMarks) * 100).toFixed(2) : '0.00',
                        assessments: studentResult.assessments || []
                    });
                }
            });
            
            if (studentResults.length === 0) {
                return { 
                    exists: false, 
                    message: "No results for student",
                    debug: { 
                        studentId: student.studentId,
                        totalDocuments: results.length,
                        studentResults: 0
                    }
                };
            }
            
            const currentSemester = student.currentSemester || 1;
            const targetSemester = aiResult.entities.semester || currentSemester;
            
            let filteredResults = studentResults;
            
            if (aiResult.intent === 'results.course' || aiResult.entities.courseName || aiResult.entities.courseCode) {
                if (aiResult.entities.courseCode) {
                    filteredResults = studentResults.filter(r => 
                        r.courseCode === aiResult.entities.courseCode
                    );
                } else if (aiResult.entities.courseName) {
                    const courseNameLower = aiResult.entities.courseName.toLowerCase();
                    filteredResults = studentResults.filter(r => 
                        r.courseName.toLowerCase().includes(courseNameLower)
                    );
                } else {
                    filteredResults = studentResults.filter(r => r.semester === targetSemester);
                }
            } 
            else if (aiResult.entities.semester) {
                filteredResults = studentResults.filter(r => r.semester === aiResult.entities.semester);
            } else if (aiResult.intent === 'results.all') {
                filteredResults = studentResults.filter(r => r.semester === targetSemester);
            }
            
            const totalGradePoints = filteredResults.reduce((sum, r) => sum + (r.gradePoints || 0), 0);
            const gpa = filteredResults.length > 0 ? 
                (totalGradePoints / filteredResults.length).toFixed(2) : '0.00';
            
            return {
                exists: true,
                semester: targetSemester,
                gpa: gpa,
                totalCourses: filteredResults.length,
                results: filteredResults,
                allResults: studentResults,
                aiContext: aiResult.entities,
                debug: {
                    studentId: student.studentId,
                    totalResults: studentResults.length,
                    filteredResults: filteredResults.length,
                    gpa: gpa,
                    targetSemester: targetSemester
                }
            };
            
        } catch (error) {
            console.error(`         ❌ Results fetch error:`, error.message);
            return { 
                exists: false, 
                error: error.message,
                debug: { studentId: student.studentId }
            };
        }
    }

    async fetchTimetableData(student, aiResult) {
        try {
            console.log(`       📅 Fetching timetable...`);
            
            const currentSemester = student.currentSemester || 1;
            const targetSemester = aiResult.entities.semester || currentSemester;
            const targetDay = aiResult.entities.day;
            
            console.log(`         Looking for: Semester ${targetSemester}, Day: ${targetDay || 'Any'}`);
            
            const batch = await Batch.findById(student.batch).lean();
            if (!batch) {
                console.log(`         ❌ Batch not found`);
                return { 
                    exists: false, 
                    message: "Batch information not found",
                    debug: { batchId: student.batch, semester: targetSemester }
                };
            }
            
            console.log(`         ✅ Batch found: ${batch.batchName}`);
            
            const timetableQuery = {
                batchId: student.batch,
                semester: targetSemester,
                isActive: true
            };
            
            const timetable = await Timetable.findOne(timetableQuery).lean();
            
            if (!timetable) {
                console.log(`         ❌ No active timetable found`);
                return { 
                    exists: false, 
                    message: `No timetable found for semester ${targetSemester}`,
                    debug: { query: timetableQuery, studentSection: student.section }
                };
            }
            
            console.log(`         ✅ Timetable found: ${timetable._id}`);
            console.log(`         Total slots: ${timetable.timeSlots?.length || 0}`);
            
            const filteredSlots = timetable.timeSlots?.filter(slot => 
                slot.isActive && slot.sectionName === student.section
            ) || [];
            
            console.log(`         Slots for section ${student.section}: ${filteredSlots.length}`);
            
            let resultSlots = filteredSlots;
            if (targetDay) {
                const dayLower = targetDay.toLowerCase();
                resultSlots = filteredSlots.filter(slot => 
                    slot.day.toLowerCase() === dayLower
                );
                console.log(`         Slots for ${targetDay}: ${resultSlots.length}`);
            }
            
            if (aiResult.entities.time === 'today') {
                const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                resultSlots = resultSlots.filter(slot => slot.day.toLowerCase() === today);
                console.log(`         Slots for today (${today}): ${resultSlots.length}`);
            } else if (aiResult.entities.time === 'tomorrow') {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowDay = tomorrow.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                resultSlots = resultSlots.filter(slot => slot.day.toLowerCase() === tomorrowDay);
                console.log(`         Slots for tomorrow (${tomorrowDay}): ${resultSlots.length}`);
            }
            
            const classesByDay = {};
            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            days.forEach(day => classesByDay[day] = []);
            
            resultSlots.forEach(slot => {
                const dayKey = slot.day.toLowerCase();
                if (classesByDay[dayKey]) {
                    classesByDay[dayKey].push({
                        time: `${slot.startTime} - ${slot.endTime}`,
                        course: slot.courseName,
                        code: slot.courseCode,
                        room: slot.room,
                        faculty: slot.facultyName
                    });
                }
            });
            
            console.log(`         ✅ Timetable processed successfully`);
            
            return {
                exists: true,
                semester: targetSemester,
                batchName: batch.batchName,
                section: student.section,
                totalClasses: resultSlots.length,
                classesByDay: classesByDay,
                aiContext: aiResult.entities,
                debug: {
                    query: timetableQuery,
                    filteredSlots: filteredSlots.length,
                    resultSlots: resultSlots.length,
                    targetDay: targetDay,
                    hasData: resultSlots.length > 0
                }
            };
            
        } catch (error) {
            console.error(`         ❌ Timetable fetch error:`, error.message);
            return { 
                exists: false, 
                error: error.message,
                debug: { 
                    studentId: student.studentId,
                    batchId: student.batch,
                    entities: aiResult.entities 
                }
            };
        }
    }

    async fetchFeeData(student, aiResult) {
        try {
            console.log(`       💰 Fetching fee data...`);
            
            const feeRecord = await StudentFee.findOne({ 
                studentId: student.studentId 
            }).lean();
            
            if (!feeRecord) {
                console.log(`         ❌ No fee record found`);
                return { 
                    exists: false, 
                    message: "No fee records found",
                    debug: { studentId: student.studentId, count: 0 }
                };
            }
            
            console.log(`         ✅ Fee record found`);
            
            const currentSemester = student.currentSemester || 1;
            const targetSemester = aiResult.entities.semester || currentSemester;
            
            const semesterFee = feeRecord.semesterFees?.find(f => 
                f.semester === targetSemester
            );
            
            if (!semesterFee) {
                console.log(`         ❌ No fee data for semester ${targetSemester}`);
                return { 
                    exists: false, 
                    message: `No fee data for semester ${targetSemester}`,
                    debug: { 
                        studentId: student.studentId,
                        requestedSemester: targetSemester,
                        availableSemesters: feeRecord.semesterFees?.map(f => f.semester) || []
                    }
                };
            }
            
            console.log(`         ✅ Fee data found for semester ${targetSemester}`);
            
            const totalFee = semesterFee.discountedFee || semesterFee.totalFee || 0;
            const paidAmount = semesterFee.installments?.reduce((sum, inst) => 
                sum + (inst.amountPaid || 0), 0) || 0;
            const totalDue = totalFee - paidAmount;
            
            console.log(`         Semester ${targetSemester}: Fee=${totalFee}, Paid=${paidAmount}, Due=${totalDue}`);
            
            const overallTotal = feeRecord.totalPayableAmount || feeRecord.totalFee || 0;
            const overallPaid = feeRecord.totalAmountPaid || 0;
            const overallDue = feeRecord.totalAmountDue || 0;
            
            console.log(`         Overall: Total=${overallTotal}, Paid=${overallPaid}, Due=${overallDue}`);
            
            const installments = semesterFee.installments?.map((inst, index) => ({
                number: inst.installmentNumber || index + 1,
                amount: inst.amount || 0,
                amountPaid: inst.amountPaid || 0,
                dueDate: inst.dueDate,
                status: inst.status || 'pending',
                remaining: (inst.amount || 0) - (inst.amountPaid || 0),
                fineAmount: inst.fineAmount || 0
            })) || [];
            
            let filteredInstallments = installments;
            const queryLower = aiResult.context?.previousQuery?.toLowerCase() || '';
            if (queryLower.includes('pending') || queryLower.includes('due') || 
                queryLower.includes('unpaid') || queryLower.includes('outstanding')) {
                filteredInstallments = installments.filter(i => i.remaining > 0);
                console.log(`         Filtered to ${filteredInstallments.length} unpaid installments`);
            }
            
            return {
                exists: true,
                semester: targetSemester,
                semesterData: {
                    semester: targetSemester,
                    totalFee: totalFee,
                    paid: paidAmount,
                    due: totalDue,
                    installments: installments
                },
                installments: filteredInstallments,
                overall: {
                    totalFee: overallTotal,
                    totalPaid: overallPaid,
                    totalDue: overallDue,
                    status: feeRecord.status || 'unknown'
                },
                aiContext: aiResult.entities,
                debug: {
                    studentId: student.studentId,
                    targetSemester: targetSemester,
                    hasUnpaid: filteredInstallments.some(i => i.remaining > 0),
                    scholarshipPercentage: feeRecord.scholarshipPercentage || 0
                }
            };
            
        } catch (error) {
            console.error(`         ❌ Fee fetch error:`, error.message);
            return { 
                exists: false, 
                error: error.message,
                debug: { studentId: student.studentId }
            };
        }
    }

    async fetchTasksData(student, aiResult) {
        try {
            console.log(`       📝 Fetching tasks data...`);
            
            const batch = await Batch.findById(student.batch).lean();
            if (!batch) {
                return { 
                    exists: false, 
                    message: "Batch information not found",
                    debug: { batchId: student.batch }
                };
            }
            
            const query = {};
            query.batchName = batch.batchName;
            
            if (student.section) {
                query.sectionName = student.section;
            }
            
            const tasks = await FacultyTask.find(query).lean();
            
            if (!tasks || tasks.length === 0) {
                return { 
                    exists: false, 
                    message: "No tasks or assignments found",
                    debug: { 
                        studentId: student.studentId,
                        batch: batch.batchName,
                        section: student.section,
                        count: 0
                    }
                };
            }
            
            let filteredTasks = tasks;
            
            if (aiResult.entities.courseCode) {
                filteredTasks = filteredTasks.filter(task => 
                    task.courseCode && task.courseCode.toLowerCase().includes(aiResult.entities.courseCode.toLowerCase())
                );
            } else if (aiResult.entities.courseName) {
                filteredTasks = filteredTasks.filter(task => 
                    task.courseName && task.courseName.toLowerCase().includes(aiResult.entities.courseName.toLowerCase())
                );
            }
            
            if (aiResult.entities.teacher) {
                filteredTasks = filteredTasks.filter(task => 
                    task.facultyName && task.facultyName.toLowerCase().includes(aiResult.entities.teacher.toLowerCase())
                );
            }
            
            if (aiResult.intent === 'tasks.latest' || aiResult.entities.taskType === 'latest') {
                filteredTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                filteredTasks = filteredTasks.slice(0, 5);
            } else if (aiResult.intent === 'tasks.upcoming' || aiResult.entities.taskType === 'upcoming') {
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                filteredTasks = filteredTasks.filter(task => 
                    task.createdAt && new Date(task.createdAt) > oneWeekAgo
                );
            }
            
            const currentSemester = student.currentSemester || 1;
            const targetSemester = aiResult.entities.semester || currentSemester;
            
            filteredTasks = filteredTasks.filter(task => 
                !task.semester || task.semester == targetSemester
            );
            
            const formattedTasks = filteredTasks.map((task, index) => ({
                id: task._id,
                number: index + 1,
                title: task.taskTitle || 'Untitled Task',
                description: task.taskDescription || 'No description provided',
                course: task.courseName || 'Unknown Course',
                courseCode: task.courseCode || 'N/A',
                faculty: task.facultyName || 'Unknown Faculty',
                batch: task.batchName,
                section: task.sectionName,
                semester: task.semester || targetSemester,
                createdAt: task.createdAt ? new Date(task.createdAt).toLocaleDateString() : 'Unknown',
                createdDate: task.createdAt ? new Date(task.createdAt) : null,
                hasFile: !!task.assignmentFile,
                status: 'pending'
            }));
            
            formattedTasks.sort((a, b) => {
                if (!a.createdDate) return 1;
                if (!b.createdDate) return -1;
                return b.createdDate - a.createdDate;
            });
            
            return {
                exists: true,
                semester: targetSemester,
                totalTasks: formattedTasks.length,
                tasks: formattedTasks,
                aiContext: aiResult.entities,
                debug: {
                    studentId: student.studentId,
                    batch: batch.batchName,
                    section: student.section,
                    targetSemester: targetSemester,
                    filteredTasks: formattedTasks.length,
                    originalTasks: tasks.length,
                    queryUsed: query
                }
            };
            
        } catch (error) {
            console.error(`         ❌ Tasks fetch error:`, error.message);
            return { 
                exists: false, 
                error: error.message,
                debug: { 
                    studentId: student.studentId,
                    batch: student.batch,
                    section: student.section,
                    error: error.stack
                }
            };
        }
    }

    async generateAIResponse(student, aiResult, data, query, session, isFollowUp = false) {
        const studentName = `${student.firstName} ${student.lastName}`;
        
        console.log(`   💬 Generating response for ${studentName}...`);
        
        let message = '';
        
        if (isFollowUp && this.isTrueFollowUp(query, session)) {
            message += `Following up on your previous question:\n\n`;
            console.log(`     → Added follow-up context`);
        }
        
        if (aiResult.intent.startsWith('timetable.')) {
            console.log(`     → Generating timetable response`);
            const timetableMsg = this.generateTimetableResponse(studentName, data.timetable, aiResult);
            message += timetableMsg;
        } else if (aiResult.intent.startsWith('fee.')) {
            console.log(`     → Generating fee response`);
            const feeMsg = this.generateFeeResponse(studentName, data.fee, aiResult);
            message += feeMsg;
        } else if (aiResult.intent.startsWith('attendance.')) {
            console.log(`     → Generating attendance response`);
            const attendanceMsg = this.generateAttendanceResponse(studentName, data.attendance, aiResult);
            message += attendanceMsg;
        } else if (aiResult.intent.startsWith('results.')) {
            console.log(`     → Generating results response`);
            const resultsMsg = this.generateResultsResponse(studentName, data.results, aiResult);
            message += resultsMsg;
        } else if (aiResult.intent.startsWith('tasks.')) {
            console.log(`     → Generating tasks response`);
            const tasksMsg = this.generateTasksResponse(studentName, data.tasks, aiResult);
            message += tasksMsg;
        } else if (aiResult.intent === 'batch.info') {
            console.log(`     → Generating batch response`);
            const batchMsg = this.generateBatchResponse(studentName, data.batch, aiResult);
            message += batchMsg;
        } else if (aiResult.intent.startsWith('student.')) {
            console.log(`     → Generating student info response`);
            const studentInfoMsg = this.generateStudentInfoResponse(studentName, data.studentInfo, aiResult);
            message += studentInfoMsg;
        } else if (aiResult.intent.startsWith('sidebar.guidance')) {
            console.log(`     → Generating sidebar guidance response`);
            const sidebarMsg = this.generateSidebarGuidanceResponse(studentName, aiResult);
            message += sidebarMsg;
        } else if (aiResult.intent === 'greeting') {
            console.log(`     → Generating greeting response`);
            const greetings = [
                `Hello ${studentName}! 👋 How can I assist you with your academic queries today?`,
                `Hi ${studentName}! Welcome back. What would you like to know about your academics?`,
                `Greetings ${studentName}! Ready to help with timetable, attendance, results, fees, and more!`
            ];
            message += greetings[Math.floor(Math.random() * greetings.length)];
        } else if (aiResult.intent === 'farewell') {
            console.log(`     → Generating farewell response`);
            const farewells = [
                `Goodbye ${studentName}! Have a great day ahead!`,
                `See you soon ${studentName}! Take care and study well.`,
                `Thank you ${studentName}! Feel free to ask if you need more academic help.`
            ];
            message += farewells[Math.floor(Math.random() * farewells.length)];
        } else if (aiResult.intent === 'help') {
            console.log(`     → Generating help response`);
            message += this.generateHelpResponse();
        } else if (aiResult.intent === 'identity') {
            console.log(`     → Generating identity response`);
            message += `I am your AI Academic Assistant! 🤖 I help students with timetable, attendance, results, fees, and all academic queries.`;
        } else {
            console.log(`     → Generating general response`);
            message += this.generateGeneralResponse(studentName, aiResult);
        }
        
        message = message.replace(/data loaded/gi, '');
        message = message.replace(/undefined/gi, '');
        message = message.trim();
        
        console.log(`     ✅ Response generated (${message.length} characters)`);
        
        return {
            message: message,
            data: data,
            intent: aiResult.intent,
            entities: aiResult.entities,
            confidence: aiResult.confidence
        };
    }

    generateSidebarGuidanceResponse(studentName, aiResult) {
        const entity = aiResult.entities.entity || 'information';
        const module = aiResult.entities.module || 'Dashboard';
        
        let responses = [];
        
        if (aiResult.intent === 'sidebar.guidance.howto') {
            responses = [
                `To find ${entity}, you need to check the sidebar for **"${module}"** to access ${entity} information.`,
                `You can view ${entity} by clicking on **"${module}"** in the sidebar menu.`,
                `For ${entity}, please go to the sidebar and select **"${module}"**.`,
                `You need to see the sidebar for **"${module}"** to find ${entity} details.`,
                `${entity} information is available in the **"${module}"** section of the sidebar.`
            ];
        } else if (aiResult.intent === 'sidebar.guidance.where') {
            responses = [
                `To find ${entity}, check the sidebar for **"${module}"** to access ${entity} information.`,
                `You can view ${entity} by going to the **"${module}"** section in the sidebar.`,
                `${entity} is available in the sidebar under **"${module}"**.`,
                `Look for **"${module}"** in the sidebar menu to find ${entity}.`,
                `In the sidebar, click on **"${module}"** to view ${entity}.`
            ];
        } else if (aiResult.intent === 'sidebar.guidance.show') {
            responses = [
                `To see ${entity}, check the sidebar for **"${module}"** to access ${entity} information.`,
                `You can view ${entity} by selecting **"${module}"** from the sidebar.`,
                `${entity} is displayed in the **"${module}"** section of the sidebar.`,
                `Go to **"${module}"** in the sidebar to see ${entity}.`,
                `The **"${module}"** section in the sidebar shows your ${entity}.`
            ];
        } else {
            responses = [
                `You need to check the sidebar for **"${module}"** to access ${entity} information.`,
                `Go to **"${module}"** in the sidebar to find ${entity}.`,
                `Your ${entity} is available in the **"${module}"** section.`
            ];
        }
        
        const selectedResponse = responses[Math.floor(Math.random() * responses.length)];
        
        let additionalInfo = '';
        
        if (module === 'Attendance') {
            additionalInfo = `\n\n💡 **Tip:** In the Attendance section, you can view your attendance percentage for each course and see which classes you've missed.`;
        } else if (module === 'TimeTable') {
            additionalInfo = `\n\n💡 **Tip:** The TimeTable shows your daily class schedule, room numbers, and faculty names.`;
        } else if (module === 'Result') {
            additionalInfo = `\n\n💡 **Tip:** In the Result section, you can view your grades, marks, and GPA for each semester.`;
        } else if (module === 'Invoices') {
            additionalInfo = `\n\n💡 **Tip:** The Invoices section shows your fee details, pending payments, and payment history.`;
        } else if (module === 'Tasks') {
            additionalInfo = `\n\n💡 **Tip:** In the Tasks section, you can see all your assignments, projects, and deadlines.`;
        } else if (module === 'Dashboard') {
            additionalInfo = `\n\n💡 **Tip:** The Dashboard provides an overview of your academic profile, personal information, and quick access to all features.`;
        }
        
        return `**Navigation Help - ${studentName}** 🧭\n\n${selectedResponse}${additionalInfo}`;
    }

    isTrueFollowUp(query, session) {
        const queryLower = query.toLowerCase();
        
        const followUpIndicators = [
            'and', 'also', 'what about', 'how about', 'next',
            'then', 'after that', 'following', 'too'
        ];
        
        for (const indicator of followUpIndicators) {
            if (queryLower.startsWith(indicator + ' ') || queryLower.includes(' ' + indicator + ' ')) {
                return true;
            }
        }
        
        return false;
    }

    generateStudentInfoResponse(studentName, studentInfoData, aiResult) {
        if (!studentInfoData || !studentInfoData.exists) {
            return `**Student Information - ${studentName}** 👤\n\n` +
                   `Student information not available.\n\n` +
                   `**Please:**\n` +
                   `• Check with your department\n` +
                   `• Verify your student profile\n` +
                   `• Contact administration if needed`;
        }
        
        const intent = studentInfoData.intent || aiResult.intent;
        const specificData = studentInfoData.specificData || {};
        
        let message = '';
        
        switch(intent) {
            case 'student.scholarship':
                message += `**Scholarship Status - ${studentName}** 🎓\n\n`;
                if (studentInfoData.scholarship.hasScholarship) {
                    message += `✅ **Yes, you have a scholarship!**\n`;
                    message += `• Scholarship Percentage: **${studentInfoData.scholarship.percentage}%**\n`;
                    message += `• Admission Type: ${studentInfoData.scholarship.type}\n`;
                    if (specificData.details) {
                        message += `• Details: ${specificData.details}\n`;
                    }
                } else {
                    message += `❌ **No, you do not have a scholarship.**\n`;
                    message += `• Admission Type: ${studentInfoData.scholarship.type}\n`;
                    message += `• You are a regular fee-paying student.\n`;
                }
                break;
                
            case 'student.courses':
                message += `**Assigned Courses - ${studentName}** 📚\n\n`;
                message += `**Current Semester:** ${specificData.currentSemester || studentInfoData.academicProgress.currentSemester}\n`;
                message += `**Total Courses:** ${specificData.totalCourses || 0}\n\n`;
                
                if (specificData.courses && specificData.courses.length > 0) {
                    message += `**Your Courses:**\n`;
                    specificData.courses.forEach((course, index) => {
                        message += `${index + 1}. **${course.courseCode}** - ${course.courseName}\n`;
                        message += `   Credits: ${course.credits || 'Not specified'}\n`;
                        message += `   Status: ${course.status || 'Registered'}\n\n`;
                    });
                } else {
                    message += `No courses assigned for the current semester.\n`;
                }
                break;
                
            case 'student.completed_courses':
                message += `**Completed Courses - ${studentName}** ✅\n\n`;
                message += `**Total Completed:** ${specificData.totalCompleted || 0}\n`;
                if (specificData.semesters && specificData.semesters.length > 0) {
                    message += `**Semesters:** ${specificData.semesters.join(', ')}\n`;
                }
                message += `\n`;
                
                if (specificData.courses && specificData.courses.length > 0) {
                    message += `**Completed Courses:**\n`;
                    specificData.courses.forEach((course, index) => {
                        if (index < 10) {
                            message += `${index + 1}. **${course.courseCode}** - ${course.courseName}\n`;
                            message += `   Semester: ${course.semester} | Grade: ${course.grade || 'N/A'}\n`;
                            message += `   Credits: ${course.credits}\n\n`;
                        }
                    });
                    if (specificData.courses.length > 10) {
                        message += `... and ${specificData.courses.length - 10} more courses.\n\n`;
                    }
                } else {
                    message += `No completed courses found.\n`;
                }
                break;
                
            case 'student.academic_progress':
                message += `**Academic Progress - ${studentName}** 📊\n\n`;
                message += `**Current Semester:** ${studentInfoData.academicProgress.currentSemester}\n`;
                message += `**Credits Earned:** ${specificData.totalCreditsEarned}/${specificData.totalCreditsRequired}\n`;
                message += `**Completion:** ${specificData.completionPercentage}%\n`;
                message += `**Cumulative GPA:** ${specificData.cumulativeGPA.toFixed(2)}\n`;
                message += `**Current Semester Credits:** ${specificData.currentSemesterCredits}\n\n`;
                
                if (specificData.droppedCourses && specificData.droppedCourses.length > 0) {
                    message += `**⚠️ Dropped/Failed Courses:**\n`;
                    specificData.droppedCourses.forEach((course, index) => {
                        message += `${index + 1}. **${course.courseCode}** - ${course.courseName}\n`;
                        message += `   Semester: ${course.semester} | Grade: ${course.grade}\n\n`;
                    });
                    message += `**Note:** You may need to repeat these courses.\n\n`;
                } else {
                    message += `✅ **Great! No dropped or failed courses.**\n\n`;
                }
                break;
                
            case 'student.section':
                message += `**Section Information - ${studentName}** 🏫\n\n`;
                message += `• Your Section: **${specificData.section || studentInfoData.personalInfo.section}**\n`;
                message += `• Current Semester: ${specificData.currentSemester || studentInfoData.academicProgress.currentSemester}\n`;
                break;
                
            case 'student.personal_info':
                message += `**Personal Information - ${studentName}** 👤\n\n`;
                message += `**Student Details:**\n`;
                message += `• Student ID: ${specificData.studentId}\n`;
                message += `• Name: ${specificData.name}\n`;
                message += `• Email: ${specificData.email}\n`;
                message += `• Contact: ${specificData.contact}\n`;
                message += `• Address: ${specificData.address}\n`;
                message += `• Birth Date: ${specificData.birthDate}\n`;
                if (specificData.gender) message += `• Gender: ${specificData.gender}\n`;
                if (specificData.bloodGroup) message += `• Blood Group: ${specificData.bloodGroup}\n`;
                break;
                
            default:
                message += `**Student Information - ${studentName}** 👤\n\n`;
                message += `**Quick Summary:**\n`;
                message += `• Section: ${studentInfoData.personalInfo.section}\n`;
                message += `• Scholarship: ${studentInfoData.scholarship.hasScholarship ? 
                    `Yes (${studentInfoData.scholarship.percentage}%)` : 'No'}\n`;
                message += `• Current Semester: ${studentInfoData.academicProgress.currentSemester}\n`;
                message += `• Credits Earned: ${studentInfoData.academicProgress.totalCreditsEarned}/${studentInfoData.academicProgress.totalCreditsRequired}\n`;
                message += `• GPA: ${studentInfoData.academicProgress.cumulativeGPA.toFixed(2)}\n`;
                message += `• Semesters: ${studentInfoData.semesters.current} current, ${studentInfoData.semesters.completed} completed, ${studentInfoData.semesters.upcoming} upcoming\n`;
        }
        
        return message;
    }

    generateBatchResponse(studentName, batchData, aiResult) {
        if (!batchData || !batchData.exists) {
            return `**Batch Information - ${studentName}** 🎓\n\n` +
                   `Batch information not available.\n\n` +
                   `**Please:**\n` +
                   `• Check with your department\n` +
                   `• Verify your enrollment status\n` +
                   `• Contact administration if needed`;
        }
        
        let message = `**Batch Information - ${studentName}** 🎓\n\n`;
        
        message += `**Program Details:**\n`;
        message += `• Batch: **${batchData.batchName}**\n`;
        message += `• Department: ${batchData.department}\n`;
        message += `• Enrollment Year: ${batchData.enrollmentYear}\n`;
        message += `• Graduation Year: **${batchData.graduationYear}**\n`;
        message += `• Total Semesters: ${batchData.totalSemesters}\n`;
        message += `• Current Semester: ${batchData.currentSemester}\n`;
        message += `• Semester Start: ${batchData.semesterStart}\n\n`;
        
        message += `**Admission Information:**\n`;
        message += `• Admission Start: ${batchData.admissionStartDate}\n`;
        message += `• Admission End: ${batchData.admissionEndDate}\n\n`;
        
        const queryLower = aiResult.context?.previousQuery?.toLowerCase() || '';
        if (queryLower.includes('semester end') || queryLower.includes('when will semester')) {
            if (batchData.semesterData && batchData.semesterData.endDate) {
                const endDate = new Date(batchData.semesterData.endDate);
                const formattedDate = endDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                message += `**📅 Semester End Date:**\n`;
                message += `• Current Semester (${batchData.currentSemester}) ends on: **${formattedDate}**\n\n`;
            }
        }
        
        if (batchData.semesterData) {
            message += `**Current Semester (${batchData.currentSemester}) Schedule:**\n`;
            message += `• Semester: ${batchData.semesterData.name || 'Not specified'}\n`;
            if (batchData.semesterData.startDate) {
                const startDate = new Date(batchData.semesterData.startDate);
                message += `• Start Date: ${startDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })}\n`;
            }
            if (batchData.semesterData.endDate) {
                const endDate = new Date(batchData.semesterData.endDate);
                message += `• End Date: ${endDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })}\n`;
            }
            if (batchData.semesterData.midtermStart) {
                message += `• Midterm Start: ${this.formatDate(batchData.semesterData.midtermStart)}\n`;
            }
            if (batchData.semesterData.finalStart) {
                message += `• Final Start: ${this.formatDate(batchData.semesterData.finalStart)}\n`;
            }
            
            if (batchData.semesterData.breaks && batchData.semesterData.breaks.length > 0) {
                message += `\n**Breaks:**\n`;
                batchData.semesterData.breaks.forEach((breakItem, index) => {
                    message += `${index + 1}. ${breakItem.name || 'Break'}: `;
                    if (breakItem.startDate) {
                        message += `${this.formatDate(breakItem.startDate)}`;
                    }
                    if (breakItem.endDate) {
                        message += ` to ${this.formatDate(breakItem.endDate)}`;
                    }
                    message += `\n`;
                });
            }
        }
        
        message += `\n**Based on your enrollment year (${batchData.enrollmentYear}), ` +
                   `you are expected to graduate in **${batchData.graduationYear}**.\n` +
                   `Total program duration: ${batchData.totalSemesters} semesters.\n` +
                   `You are currently in semester ${batchData.currentSemester}.\n\n` +
                   `For admission, applications are accepted from ${batchData.admissionStartDate} to ${batchData.admissionEndDate}.`;
        
        return message;
    }

    generateAttendanceResponse(studentName, attendanceData, aiResult) {
        if (!attendanceData || !attendanceData.exists) {
            return `**Attendance - ${studentName}** 📊\n\n` +
                   `Attendance records not available.\n\n` +
                   `**Please:**\n` +
                   `• Check with your department\n` +
                   `• Verify attendance is being recorded\n` +
                   `• Contact your course instructor`;
        }
        
        let message = '';
        const intent = aiResult.intent;
        
        if (intent === 'attendance.detail' || aiResult.entities.attendanceType) {
            if (aiResult.entities.attendanceType === 'absent') {
                message += `**Absent Classes - ${studentName}** ❌\n\n`;
                if (attendanceData.details.absent.length > 0) {
                    message += `You have been absent in **${attendanceData.details.absent.length}** class(es):\n\n`;
                    attendanceData.details.absent.forEach((record, index) => {
                        if (index < 10) {
                            message += `${index + 1}. ${record.course} - ${this.formatDate(record.date)}\n`;
                        }
                    });
                    if (attendanceData.details.absent.length > 10) {
                        message += `... and ${attendanceData.details.absent.length - 10} more absences.\n\n`;
                    }
                } else {
                    message += `✅ **Excellent! You have no absent classes.**\n\n`;
                }
            } else if (aiResult.entities.attendanceType === 'present') {
                message += `**Present Classes - ${studentName}** ✅\n\n`;
                message += `You have attended **${attendanceData.overall.presentCount}** out of **${attendanceData.overall.totalCount}** classes.\n\n`;
                if (attendanceData.details.present.length > 0) {
                    message += `Recent attendance:\n`;
                    attendanceData.details.present.slice(0, 5).forEach((record, index) => {
                        message += `${index + 1}. ${record.course} - ${this.formatDate(record.date)}\n`;
                    });
                    message += `\n`;
                }
            }
        } 
        else if (intent === 'attendance.course' || aiResult.entities.courseName || aiResult.entities.courseCode) {
            const courseName = aiResult.entities.courseName || 
                              (attendanceData.courses[0]?.courseName || 'Course');
            const courseCode = aiResult.entities.courseCode || 
                              (attendanceData.courses[0]?.courseCode || '');
            
            message += `**${courseName} Attendance - ${studentName}** 📊\n\n`;
            
            if (attendanceData.courses.length > 0) {
                attendanceData.courses.forEach((course, index) => {
                    message += `**${course.courseCode} - ${course.courseName}**\n`;
                    message += `• Attendance: **${course.percentage}%**\n`;
                    message += `• Present: ${course.presentCount} classes\n`;
                    message += `• Absent: ${course.absentCount} classes\n`;
                    message += `• Total: ${course.totalCount} classes\n`;
                    message += `• Status: ${course.status === 'Good' ? '✅ Good standing' : '⚠️ Needs improvement'}\n\n`;
                });
            } else {
                message += `No attendance records found for the specified course.\n`;
            }
        }
        else {
            message += `**Attendance Summary - ${studentName}** 📊\n\n`;
            message += `**Semester ${attendanceData.semester}:**\n`;
            message += `• Overall Attendance: **${attendanceData.overall.percentage}%**\n`;
            message += `• Present: ${attendanceData.overall.presentCount} classes\n`;
            message += `• Absent: ${attendanceData.overall.absentCount} classes\n`;
            message += `• Total: ${attendanceData.overall.totalCount} classes\n\n`;
            
            const overallPercentage = parseFloat(attendanceData.overall.percentage);
            if (overallPercentage >= 75) {
                message += `✅ **Good standing** (Above 75% requirement)\n\n`;
            } else {
                message += `⚠️ **Attention needed** (Below 75% requirement)\n`;
                message += `You need ${Math.ceil((75 - overallPercentage) / 100 * attendanceData.overall.totalCount)} more classes to reach 75%\n\n`;
            }
            
            if (attendanceData.courses.length > 0) {
                message += `**Course-wise Attendance:**\n`;
                attendanceData.courses.forEach((course, index) => {
                    const statusIcon = course.status === 'Good' ? '✅' : '⚠️';
                    message += `${index + 1}. ${statusIcon} **${course.courseCode}** - ${course.courseName}\n`;
                    message += `   Attendance: ${course.percentage}% (${course.presentCount}/${course.totalCount})\n\n`;
                });
            }
        }
        
        return message;
    }

    generateResultsResponse(studentName, resultsData, aiResult) {
        if (!resultsData || !resultsData.exists) {
            return `**Results - ${studentName}** 📈\n\n` +
                   `Results not available.\n\n` +
                   `**Please:**\n` +
                   `• Check with examination department\n` +
                   `• Verify results publication date\n` +
                   `• Contact your course coordinator`;
        }
        
        let message = '';
        const intent = aiResult.intent;
        
        if (intent === 'results.course' || aiResult.entities.courseName || aiResult.entities.courseCode) {
            const course = resultsData.results[0];
            if (course) {
                message += `**${course.courseName} Result - ${studentName}** 📈\n\n`;
                message += `**Course:** ${course.courseCode} - ${course.courseName}\n`;
                message += `**Semester:** ${course.semester}\n`;
                message += `**Grade:** **${course.grade}**\n`;
                message += `**Grade Points:** ${course.gradePoints}\n`;
                message += `**Marks:** ${course.obtainedMarks}/${course.totalMarks}\n`;
                message += `**Percentage:** ${course.percentage}%\n\n`;
                
                if (course.grade >= 'A') {
                    message += `🎉 **Excellent performance!** Keep up the great work!`;
                } else if (course.grade >= 'B') {
                    message += `✅ **Good performance!** You're doing well.`;
                } else if (course.grade >= 'C') {
                    message += `👍 **Satisfactory performance.**`;
                } else if (course.grade >= 'D') {
                    message += `⚠️ **Needs improvement.** Consider seeking help.`;
                } else {
                    message += `❌ **Failed.** You need to repeat this course.`;
                }
            } else {
                message += `**Course Results - ${studentName}** 📈\n\n`;
                message += `No results found for the specified course.\n`;
            }
        } else {
            message += `**Academic Results - ${studentName}** 📈\n\n`;
            message += `**Semester ${resultsData.semester} GPA:** **${resultsData.gpa}**\n`;
            message += `**Courses Completed:** ${resultsData.totalCourses}\n\n`;
            
            if (resultsData.results.length > 0) {
                message += `**Course Results:**\n`;
                resultsData.results.forEach((result, index) => {
                    let gradeEmoji = '📘';
                    if (result.grade >= 'A') gradeEmoji = '🎉';
                    else if (result.grade >= 'B') gradeEmoji = '✅';
                    else if (result.grade >= 'C') gradeEmoji = '👍';
                    else if (result.grade >= 'D') gradeEmoji = '⚠️';
                    else gradeEmoji = '❌';
                    
                    message += `${index + 1}. ${gradeEmoji} **${result.courseCode}** - ${result.courseName}\n`;
                    message += `   Grade: **${result.grade}** | GPA: ${result.gradePoints}\n`;
                    message += `   Marks: ${result.obtainedMarks}/${result.totalMarks} (${result.percentage}%)\n\n`;
                });
            }
            
            const gpa = parseFloat(resultsData.gpa);
            if (gpa >= 3.5) {
                message += `🎯 **Excellent overall performance!** Keep up the great work!`;
            } else if (gpa >= 3.0) {
                message += `👍 **Good overall performance!** You're doing well.`;
            } else if (gpa >= 2.0) {
                message += `📚 **Satisfactory overall performance.** Room for improvement.`;
            } else {
                message += `⚠️ **Needs improvement overall.** Consider seeking academic support.`;
            }
        }
        
        return message;
    }

    generateTimetableResponse(studentName, timetableData, aiResult) {
        if (!timetableData || !timetableData.exists) {
            const dayInfo = aiResult.entities.day ? `for ${aiResult.entities.day}` : '';
            const errorMsg = timetableData?.message || "Timetable data not available";
            
            return `**Schedule ${dayInfo} - ${studentName}** 📅\n\n` +
                   `${errorMsg}\n\n` +
                   `**Possible reasons:**\n` +
                   `• No classes scheduled ${dayInfo}\n` +
                   `• Timetable not yet uploaded\n` +
                   `• Check with your department\n` +
                   `• Try asking about another day`;
        }
        
        const intent = aiResult.intent;
        const day = aiResult.entities.day;
        
        if (intent === 'timetable.today' || aiResult.entities.time === 'today') {
            return this.generateTodayTimetable(studentName, timetableData);
        } else if (intent === 'timetable.day_schedule' || day) {
            return this.generateDaySchedule(studentName, timetableData, day);
        } else {
            return this.generateGeneralTimetable(studentName, timetableData);
        }
    }

    generateTodayTimetable(studentName, timetableData) {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const todayClasses = timetableData.classesByDay[today] || [];
        
        let message = `**Today's Schedule (${today.charAt(0).toUpperCase() + today.slice(1)}) - ${studentName}** 📅\n\n`;
        
        if (todayClasses.length > 0) {
            message += `You have ${todayClasses.length} class(es) today:\n\n`;
            todayClasses.forEach((cls, index) => {
                message += `${index + 1}. **${cls.course}** (${cls.code})\n`;
                message += `   ⏰ ${cls.time}\n`;
                message += `   🏫 ${cls.room}\n`;
                message += `   👨‍🏫 ${cls.faculty}\n\n`;
            });
        } else {
            message += `No classes scheduled for today. Enjoy your day!`;
        }
        
        return message;
    }

    generateDaySchedule(studentName, timetableData, day) {
        const dayLower = (day || '').toLowerCase();
        const dayClasses = timetableData.classesByDay[dayLower] || [];
        
        let message = `**Schedule for ${dayLower.charAt(0).toUpperCase() + dayLower.slice(1)} - ${studentName}** 📅\n\n`;
        
        if (dayClasses.length > 0) {
            message += `You have ${dayClasses.length} class(es) on ${dayLower}:\n\n`;
            dayClasses.forEach((cls, index) => {
                message += `${index + 1}. **${cls.course}** (${cls.code})\n`;
                message += `   ⏰ ${cls.time}\n`;
                message += `   🏫 ${cls.room}\n`;
                message += `   👨‍🏫 ${cls.faculty}\n\n`;
            });
        } else {
            message += `No classes scheduled for ${dayLower}.`;
        }
        
        return message;
    }

    generateGeneralTimetable(studentName, timetableData) {
        let message = `**Complete Timetable - ${studentName}** 📅\n\n`;
        message += `**Semester:** ${timetableData.semester}\n`;
        message += `**Batch:** ${timetableData.batchName}\n`;
        message += `**Section:** ${timetableData.section}\n`;
        message += `**Total Classes:** ${timetableData.totalClasses}\n\n`;
        
        let hasClasses = false;
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        
        days.forEach(day => {
            const classes = timetableData.classesByDay[day] || [];
            if (classes.length > 0) {
                hasClasses = true;
                message += `**${day.charAt(0).toUpperCase() + day.slice(1)}:**\n`;
                classes.forEach(cls => {
                    message += `⏰ ${cls.time} | ${cls.course} (${cls.code})\n`;
                });
                message += `\n`;
            }
        });
        
        if (!hasClasses) {
            message += `No classes found in the timetable.`;
        }
        
        return message;
    }

    generateFeeResponse(studentName, feeData, aiResult) {
        if (!feeData || !feeData.exists) {
            return `**Fee Information - ${studentName}** 💰\n\n` +
                   `Fee information not available.\n\n` +
                   `**Please:**\n` +
                   `• Check with accounts department\n` +
                   `• Verify your fee records\n` +
                   `• Contact administration if needed`;
        }
        
        let message = `**Fee Overview - ${studentName}** 💰\n\n`;
        
        if (feeData.semesterData) {
            message += `**Semester ${feeData.semesterData.semester}:**\n`;
            message += `• Total Fee: ${this.formatCurrency(feeData.semesterData.totalFee)}\n`;
            message += `• Paid: ${this.formatCurrency(feeData.semesterData.paid)}\n`;
            message += `• Due: ${this.formatCurrency(feeData.semesterData.due)}\n\n`;
            
            if (feeData.semesterData.installments && feeData.semesterData.installments.length > 0) {
                message += `**Installments:**\n`;
                feeData.semesterData.installments.forEach((inst, index) => {
                    const statusIcon = inst.status === 'paid' ? '✅' : '⏳';
                    message += `${index + 1}. ${statusIcon} Installment ${inst.number}: ${this.formatCurrency(inst.amount)}\n`;
                    if (inst.status !== 'paid') {
                        message += `   Due: ${this.formatDate(inst.dueDate)}\n`;
                        message += `   Remaining: ${this.formatCurrency(inst.remaining)}\n`;
                    }
                });
                message += `\n`;
            }
        }
        
        message += `**Overall Summary:**\n`;
        message += `• Total Fee: ${this.formatCurrency(feeData.overall.totalFee)}\n`;
        message += `• Total Paid: ${this.formatCurrency(feeData.overall.totalPaid)}\n`;
        message += `• Total Due: ${this.formatCurrency(feeData.overall.totalDue)}\n`;
        message += `• Status: ${feeData.overall.status}\n\n`;
        
        if (feeData.debug?.scholarshipPercentage > 0) {
            message += `**Scholarship:** ${feeData.debug.scholarshipPercentage}% discount applied\n\n`;
        }
        
        const unpaidInstallments = feeData.installments?.filter(i => i.remaining > 0) || [];
        if (unpaidInstallments.length > 0) {
            message += `**Attention - Unpaid Installments:**\n`;
            unpaidInstallments.forEach(installment => {
                message += `• Installment ${installment.number}: ${this.formatCurrency(installment.remaining)} due`;
                if (installment.fineAmount > 0) {
                    message += ` (Fine: ${this.formatCurrency(installment.fineAmount)})`;
                }
                if (installment.dueDate) {
                    message += ` - Due: ${this.formatDate(installment.dueDate)}`;
                }
                message += `\n`;
            });
            message += `\n`;
        } else if (feeData.overall.totalDue === 0) {
            message += ` **All fees are paid up to date!**\n\n`;
        }
        
        return message;
    }

    generateTasksResponse(studentName, tasksData, aiResult) {
        if (!tasksData || !tasksData.exists) {
            const errorMsg = tasksData?.message || "No tasks or assignments found.";
            
            return `**Tasks/Assignments - ${studentName}** 📝\n\n` +
                   `${errorMsg}\n\n` +
                   `**Possible reasons:**\n` +
                   `• No assignments given yet\n` +
                   `• Tasks not uploaded to system\n` +
                   `• Check with your course instructor`;
        }
        
        let message = '';
        
        if (aiResult.intent === 'tasks.latest') {
            message += `**Latest Tasks - ${studentName}** 📝\n\n`;
            message += `Here are your latest tasks/assignments:\n\n`;
        } else if (aiResult.intent === 'tasks.upcoming') {
            message += `**Upcoming Tasks - ${studentName}** 📝\n\n`;
            message += `Here are your upcoming tasks/assignments:\n\n`;
        } else if (aiResult.intent === 'tasks.teacher') {
            message += `**Tasks from ${aiResult.entities.teacher || 'Faculty'} - ${studentName}** 📝\n\n`;
            message += `Tasks assigned by ${aiResult.entities.teacher || 'your faculty'}:\n\n`;
        } else if (aiResult.intent === 'tasks.course') {
            const courseName = aiResult.entities.courseName || aiResult.entities.courseCode || 'Course';
            message += `**${courseName} Tasks - ${studentName}** 📝\n\n`;
            message += `Tasks for ${courseName}:\n\n`;
        } else {
            message += `**Tasks/Assignments - ${studentName}** 📝\n\n`;
            message += `Here are your tasks/assignments:\n\n`;
        }
        
        message += `**Total Tasks:** ${tasksData.totalTasks}\n`;
        message += `**Semester:** ${tasksData.semester}\n\n`;
        
        if (tasksData.tasks.length > 0) {
            tasksData.tasks.forEach((task, index) => {
                message += `${index + 1}. **${task.title}**\n`;
                message += `   Course: ${task.course} (${task.courseCode})\n`;
                if (task.description && task.description !== 'No description provided') {
                    const shortDesc = task.description.length > 100 ? 
                        task.description.substring(0, 100) + '...' : task.description;
                    message += `   Description: ${shortDesc}\n`;
                }
                message += `   Faculty: ${task.faculty}\n`;
                message += `   Assigned: ${task.createdAt}\n`;
                message += `   Status: ${task.status}\n\n`;
            });
        } else {
            message += `No tasks found matching your criteria.\n`;
        }
        
        return message;
    }

    generateHelpResponse() {
        return `**I can help you with:** 📚\n\n` +
               `**📅 Timetable & Schedule**\n` +
               `• "Show my timetable"\n` +
               `• "What classes on Monday?"\n` +
               `• "Today's schedule"\n` +
               `• "Do I have class on moday?"\n\n` +
               `**📊 Attendance Records**\n` +
               `• "My attendance"\n` +
               `• "Attendance in Calculus"\n` +
               `• "Overall attendance"\n` +
               `• "Am I below 75%?"\n` +
               `• "Absent classes"\n` +
               `• "Present classes"\n\n` +
               `**💰 Fee Information**\n` +
               `• "My fees"\n` +
               `• "Pending fees"\n` +
               `• "Fee status"\n` +
               `• "How much do I owe?"\n\n` +
               `**📈 Results & Grades**\n` +
               `• "My results"\n` +
               `• "What's my GPA?"\n` +
               `• "Grades this semester"\n` +
               `• "Marks in Programming"\n` +
               `• "Result in Physics"\n` +
               `• "My grade in Calculus"\n\n` +
               `**🎓 Batch Information**\n` +
               `• "When will I graduate?"\n` +
               `• "My batch information"\n` +
               `• "Admission dates"\n` +
               `• "How many total semesters?"\n` +
               `• "Semester start/end dates"\n` +
               `• "When will semester end?"\n\n` +
               `**👤 Student Information**\n` +
               `• "My personal info"\n` +
               `• "Do I have scholarship?"\n` +
               `• "My section"\n` +
               `• "Courses in progress"\n` +
               `• "Assigned courses"\n` +
               `• "Completed courses"\n` +
               `• "Credits earned"\n` +
               `• "Dropped courses"\n\n` +
               `**📝 Tasks & Assignments**\n` +
               `• "My tasks"\n` +
               `• "Latest assignments"\n` +
               `• "Upcoming tasks"\n` +
               `• "Tasks from Fatima"\n` +
               `• "Calculus assignments"\n\n` +
               `**🧭 Sidebar Navigation Help**\n` +
               `• "How can I find timetable?"\n` +
               `• "Where to find attendance?"\n` +
               `• "Show me fees"\n` +
               `• "How to view results?"\n` +
               `• "Where are my classes?"\n\n` +
               `**What would you like to know?**`;
    }

    generateGeneralResponse(studentName, aiResult) {
        return `Hello ${studentName}! 👋\n\n` +
               `I can help you with:\n` +
               `• 📅 Timetable and schedule\n` +
               `• 📊 Attendance records\n` +
               `• 📈 Results and grades\n` +
               `• 💰 Fee information\n` +
               `• 📚 Course details\n` +
               `• 🎓 Batch information\n` +
               `• 👤 Student profile\n` +
               `• 📝 Tasks and assignments\n` +
               `• 🧭 Sidebar navigation help\n\n` +
               `**Please ask me a specific question about your academics!**\n` +
               `For example: "What's my schedule for Monday?" or "Show my pending fees" or "How can I find attendance?"`;
    }

    
    formatCurrency(amount) {
        if (amount === undefined || amount === null || isNaN(amount)) {
            return 'Rs. 0';
        }
        
        const formatter = new Intl.NumberFormat('en-PK', {
            style: 'currency',
            currency: 'PKR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
        
        return formatter.format(amount);
    }

    formatDate(dateString) {
        if (!dateString) return 'Not specified';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            return 'Invalid date';
        }
    }

    cleanupMemory() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, session] of this.memory.entries()) {
            if (now - session.lastTimestamp > this.sessionTimeout) {
                this.memory.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`Cleaned up ${cleaned} expired sessions`);
        }
    }
}

module.exports = new AIChatbotController();