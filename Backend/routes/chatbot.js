const express = require('express');
const router = express.Router();
const ChatbotController = require('../controllers/ChatbotController');

router.post('/chat', ChatbotController.handleQuery);

router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Chatbot API is working',
        timestamp: new Date().toISOString()
    });
});

router.post('/cleanup', (req, res) => {
    ChatbotController.cleanupContexts();
    res.json({
        success: true,
        message: 'Contexts cleaned up'
    });
});

router.get('/debug-session', (req, res) => {
    res.json({
        session: req.session ? req.session.user : null,
        cookies: req.cookies,
        headers: req.headers
    });
});

module.exports = router;