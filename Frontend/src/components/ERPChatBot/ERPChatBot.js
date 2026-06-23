import React, { useState, useEffect, useRef } from 'react';
import axiosInstance  from '../../axiosConfig';
import { 
  Send, 
  Bot, 
  X, 
  Minimize2, 
  Maximize2,
  MessageCircle,
  Loader2,
  ChevronRight,
  BookOpen,
  Calendar,
  DollarSign,
  ClipboardList,
  BarChart,
  GraduationCap,
  HelpCircle
} from 'lucide-react';
import API_URL from '../../config';
// const api = axios.create({
//   baseURL: `${API_URL}/api`,
//   withCredentials: true,
//   headers: {
//     'Content-Type': 'application/json'
//   }
// });

const AIChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const messagesEndRef = useRef(null);

  const quickQuestions = [
    { text: "What's my attendance in Calculus?", icon: <BarChart size={16} />, category: "attendance" },
    { text: "Do I have class on Monday?", icon: <Calendar size={16} />, category: "timetable" },
    { text: "Show my pending fees", icon: <DollarSign size={16} />, category: "fee" },
    { text: "What did I get in Physics?", icon: <GraduationCap size={16} />, category: "results" },
    { text: "My enrolled courses", icon: <BookOpen size={16} />, category: "courses" },
    { text: "Pending assignments", icon: <ClipboardList size={16} />, category: "tasks" },
  ];

  useEffect(() => {
    const storedId = localStorage.getItem('studentId') || sessionStorage.getItem('studentId');
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    
    if (storedId) {
      setStudentId(storedId);
    }
    
    if (userInfo.fullName) {
      setStudentName(userInfo.fullName);
    }

    setMessages([
      {
        id: 1,
        text: `👋 Hello${studentName ? ` ${studentName}` : ''}! I'm your AI Academic Assistant. I can help you with attendance, fees, results, timetable, courses, and assignments. Ask me anything!`,
        sender: 'bot',
        timestamp: new Date(),
        type: 'welcome'
      }
    ]);
  }, [studentName]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = {
      id: Date.now(),
      text: input,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.post('/api/chatbot/chat', {
        query: input,
        studentId: studentId || localStorage.getItem('studentId')
      });

      const botMessage = {
        id: Date.now() + 1,
        text: response.data.response || "I couldn't process that request.",
        sender: 'bot',
        timestamp: new Date(),
        data: response.data.data,
        aiAnalysis: response.data.aiAnalysis
      };

      setMessages(prev => [...prev, botMessage]);
      
      if (response.data.aiAnalysis?.intent) {
        updateSuggestions(response.data.aiAnalysis.intent);
      }
    } catch (error) {
      console.error('Chatbot error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        text: "Sorry, I'm having trouble connecting. Please try again later.",
        sender: 'bot',
        timestamp: new Date(),
        type: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const updateSuggestions = (intent) => {
    const baseIntent = intent.split('.')[0];
    const relatedSuggestions = quickQuestions.filter(q => 
      q.category === baseIntent || baseIntent === 'general'
    );
    
    if (relatedSuggestions.length > 0) {
      setSuggestions(relatedSuggestions.slice(0, 3));
    } else {
      setSuggestions(quickQuestions.slice(0, 3));
    }
  };

  const handleQuickQuestion = (question) => {
    setInput(question);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setIsMinimized(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: Date.now(),
        text: `👋 Hello${studentName ? ` ${studentName}` : ''}! I'm your AI Academic Assistant. How can I help you today?`,
        sender: 'bot',
        timestamp: new Date(),
        type: 'welcome'
      }
    ]);
  };

  const formatMessage = (text) => {
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br />');
    
    return { __html: formatted };
  };

  const renderMessage = (msg) => {
    if (msg.type === 'welcome') {
      return (
        <div className="welcome-message">
          <div className="welcome-header">
            <Bot size={20} />
            <h4>Academic Assistant</h4>
          </div>
          <p>{msg.text}</p>
          <div className="welcome-tips">
            <p><strong>💡 Quick tips:</strong></p>
            <ul>
              <li>Ask about specific courses</li>
              <li>Mention semester numbers</li>
              <li>Use "and" for multiple questions</li>
              <li>Ask for "only time" or "only room"</li>
            </ul>
          </div>
        </div>
      );
    }

    return (
      <div className={`message ${msg.sender}`}>
        <div className="message-content">
          <div 
            className="message-text"
            dangerouslySetInnerHTML={formatMessage(msg.text)}
          />
          <div className="message-time">
            {new Date(msg.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </div>
        </div>
        {msg.sender === 'bot' && msg.data && (
          <div className="message-data-preview">
            {msg.data.fee && (
              <div className="data-item fee">
                <DollarSign size={12} />
                <span>Fee data loaded</span>
              </div>
            )}
            {msg.data.attendance && (
              <div className="data-item attendance">
                <BarChart size={12} />
                <span>Attendance data loaded</span>
              </div>
            )}
            {msg.data.results && (
              <div className="data-item results">
                <GraduationCap size={12} />
                <span>Results data loaded</span>
              </div>
            )}
            {msg.data.timetable && (
              <div className="data-item timetable">
                <Calendar size={12} />
                <span>Timetable data loaded</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      
      {!isOpen && (
        <button 
          className="chatbot-launcher" 
          onClick={toggleChat}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 1000
          }}
        >
          <MessageCircle size={24} />
          <span>AI Assistant</span>
        </button>
      )}

      {isOpen && (
        <div 
          className={`chatbot-container ${isMinimized ? 'minimized' : ''}`}
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '20px',
            zIndex: 1001
          }}
        >
          <div className="chatbot-header">
            <div className="header-left">
              <div className="ai-avatar">
                <Bot size={20} />
              </div>
              <div className="header-info">
                <h4>Academic Assistant</h4>
                <p className="status">
                  <span className="status-dot online" />
                  Ready to help
                </p>
              </div>
            </div>
            <div className="header-actions">
              <button 
                className="icon-btn" 
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "Maximize" : "Minimize"}
              >
                {isMinimized ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
              </button>
              <button 
                className="icon-btn" 
                onClick={clearChat}
                title="Clear chat"
              >
                <HelpCircle size={18} />
              </button>
              <button 
                className="icon-btn close" 
                onClick={toggleChat}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              <div className="chatbot-messages">
                {messages.map(msg => (
                  <div key={msg.id} className="message-wrapper">
                    {renderMessage(msg)}
                  </div>
                ))}
                
                {loading && (
                  <div className="message bot">
                    <div className="message-content">
                      <div className="typing-indicator">
                        <Loader2 className="spin" size={16} />
                        <span>AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {suggestions.length > 0 && (
                <div className="quick-suggestions">
                  <p className="suggestions-title">Try asking:</p>
                  <div className="suggestions-grid">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        className="suggestion-btn"
                        onClick={() => handleQuickQuestion(suggestion.text)}
                      >
                        {suggestion.icon}
                        <span>{suggestion.text}</span>
                        <ChevronRight size={14} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="chatbot-input">
                <div className="input-wrapper">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask about attendance, fees, results, timetable..."
                    disabled={loading}
                  />
                  <button 
                    className="send-btn" 
                    onClick={handleSend}
                    disabled={!input.trim() || loading}
                  >
                    {loading ? (
                      <Loader2 className="spin" size={18} />
                    ) : (
                      <Send size={18} />
                    )}
                  </button>
                </div>
              
              </div>
            </>
          )}
        </div>
      )}

      <style jsx>{`
        .chatbot-launcher {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 50px;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
          transition: all 0.3s ease;
          animation: pulse 2s infinite;
        }

        .chatbot-launcher:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(102, 126, 234, 0.4);
        }

        @keyframes pulse {
          0% { box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3); }
          50% { box-shadow: 0 8px 32px rgba(102, 126, 234, 0.6); }
          100% { box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3); }
        }

        .chatbot-container {
          width: 400px;
          height: 600px;
          background: white;
          border-radius: 20px;
          box-shadow: 0 20px 80px rgba(0, 0, 0, 0.2);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: all 0.3s ease;
          border: 1px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
        }

        .chatbot-container.minimized {
          height: 60px;
        }

        .chatbot-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-radius: 20px 20px 0 0;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ai-avatar {
          width: 40px;
          height: 40px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(5px);
        }

        .header-info h4 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
        }

        .status {
          margin: 0;
          font-size: 11px;
          display: flex;
          align-items: center;
          gap: 6px;
          opacity: 0.9;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10b981;
        }

        .status-dot.online {
          background: #10b981;
        }

        .header-actions {
          display: flex;
          gap: 8px;
        }

        .icon-btn {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: white;
          transition: all 0.2s ease;
        }

        .icon-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.1);
        }

        .icon-btn.close:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        .chatbot-messages {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          background: #f8fafc;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .message-wrapper {
          display: flex;
          flex-direction: column;
        }

        .message {
          max-width: 85%;
          animation: messageAppear 0.3s ease-out;
        }

        @keyframes messageAppear {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .message.user {
          align-self: flex-end;
        }

        .message.bot {
          align-self: flex-start;
        }

        .message-content {
          padding: 12px 16px;
          border-radius: 18px;
          position: relative;
          word-wrap: break-word;
        }

        .message.user .message-content {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
          border-bottom-right-radius: 4px;
        }

        .message.bot .message-content {
          background: white;
          color: #1e293b;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
          border-bottom-left-radius: 4px;
          border: 1px solid #e2e8f0;
        }

        .message-text {
          font-size: 14px;
          line-height: 1.5;
        }

        .message-text strong {
          font-weight: 700;
        }

        .message-text code {
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 13px;
        }

        .message-time {
          font-size: 11px;
          opacity: 0.7;
          margin-top: 4px;
          text-align: right;
        }

        .message.user .message-time {
          color: rgba(255, 255, 255, 0.8);
        }

        .message.bot .message-time {
          color: #64748b;
        }

        .message-data-preview {
          display: flex;
          gap: 8px;
          margin-top: 8px;
          flex-wrap: wrap;
        }

        .data-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
        }

        .data-item.fee {
          background: #dbeafe;
          color: #1e40af;
        }

        .data-item.attendance {
          background: #dcfce7;
          color: #166534;
        }

        .data-item.results {
          background: #fef3c7;
          color: #92400e;
        }

        .data-item.timetable {
          background: #e0e7ff;
          color: #3730a3;
        }

        .welcome-message {
          background: white;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
          margin-bottom: 16px;
        }

        .welcome-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }

        .welcome-header h4 {
          margin: 0;
          color: #1e293b;
          font-size: 16px;
        }

        .welcome-tips {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
        }

        .welcome-tips ul {
          margin: 8px 0 0 0;
          padding-left: 20px;
          font-size: 13px;
          color: #475569;
        }

        .welcome-tips li {
          margin-bottom: 4px;
        }

        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #64748b;
          font-size: 13px;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0); }
          to { transform: rotate(360deg); }
        }

        .quick-suggestions {
          padding: 0 20px 12px 20px;
          border-top: 1px solid #e2e8f0;
          background: white;
        }

        .suggestions-title {
          margin: 12px 0 8px 0;
          font-size: 12px;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .suggestions-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .suggestion-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          cursor: pointer;
          font-size: 13px;
          color: #475569;
          text-align: left;
          transition: all 0.2s ease;
        }

        .suggestion-btn:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
          transform: translateY(-1px);
        }

        .suggestion-btn svg {
          flex-shrink: 0;
          color: #64748b;
        }

        .chatbot-input {
          padding: 16px 20px;
          border-top: 1px solid #e2e8f0;
          background: white;
          border-radius: 0 0 20px 20px;
        }

        .input-wrapper {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
        }

        .input-wrapper input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          font-size: 14px;
          outline: none;
          transition: all 0.2s ease;
        }

        .input-wrapper input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .input-wrapper input:disabled {
          background: #f1f5f9;
          cursor: not-allowed;
        }

        .send-btn {
          width: 46px;
          height: 46px;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .send-btn:hover:not(:disabled) {
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .input-hints {
          display: flex;
          gap: 8px;
          font-size: 11px;
          color: #94a3b8;
          flex-wrap: wrap;
        }

        /* Responsive design */
        @media (max-width: 480px) {
          .chatbot-container {
            width: calc(100vw - 40px);
            height: 70vh;
          }
          
          .chatbot-container.minimized {
            height: 60px;
          }
          
          .chatbot-launcher {
            padding: 12px 16px;
          }
          
          .chatbot-launcher span {
            display: inline;
          }
        }
      `}</style>
    </>
  );
};

export default AIChatbot;