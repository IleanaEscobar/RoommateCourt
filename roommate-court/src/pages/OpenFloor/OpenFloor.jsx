import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import './OpenFloor.css';

const MOCK_MESSAGES = [
  {
    id: '1',
    uid: '1',
    name: 'Alex',
    role: 'plaintiff',
    text: 'I want to address the ongoing issue with dishes being left in the sink. This has been happening repeatedly for the past two weeks and it is affecting the whole household.',
    time: '9:02 AM',
  },
  {
    id: '2',
    uid: '2',
    name: 'Jordan',
    role: 'defendant',
    text: "I understand the concern, but I was away for work last week. I don't think it's fair to put this entirely on me.",
    time: '9:05 AM',
  },
  {
    id: '3',
    uid: '3',
    name: 'Sam',
    role: 'juror',
    text: 'For the record, I can confirm I saw dishes in the sink on Monday, Wednesday, and Friday of last week.',
    time: '9:07 AM',
  },
];

const CURRENT_USER = { uid: '1', name: 'Alex', role: 'plaintiff' };

function OpenFloor() {
  const navigate = useNavigate();
  const { caseId } = useParams();
  const { state } = useLocation();
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  const caseData = state?.caseData || {
    title: 'Dishes Left in Sink',
    plaintiff: 'Alex',
    defendant: 'Jordan',
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        uid: CURRENT_USER.uid,
        name: CURRENT_USER.name,
        role: CURRENT_USER.role,
        text: inputText.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setInputText('');
  };

  const handleCloseFloor = () => {
    navigate(`/case/${caseId}/voting`, { state });
  };

  const getRoleBadgeClass = (role) => {
    if (role === 'plaintiff') return 'badge-plaintiff';
    if (role === 'defendant') return 'badge-defendant';
    return 'badge-juror';
  };

  const getMessageClass = (role) => {
    if (role === 'plaintiff') return 'message-plaintiff';
    if (role === 'defendant') return 'message-defendant';
    return 'message-juror';
  };

  return (
    <div className="open-floor-page">
      <div className="floor-header">
        <div className="floor-caption">
          <span className="case-vs">{caseData.plaintiff} v. {caseData.defendant}</span>
          <span className="case-id-label">Case #{caseId?.toUpperCase()}</span>
        </div>
        <h1 className="floor-title">Speak your truth!</h1>
        <button className="close-floor-btn" onClick={handleCloseFloor}>
          Close the Floor
        </button>
      </div>

      <div className="messages-thread">
        {messages.map(msg => (
          <div key={msg.id} className={`message-bubble ${getMessageClass(msg.role)}`}>
            <div className="message-meta">
              <span className="message-avatar">{msg.name[0]}</span>
              <span className="message-name">{msg.name}</span>
              <span className={`role-badge ${getRoleBadgeClass(msg.role)}`}>
                {msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}
              </span>
              <span className="message-time">{msg.time}</span>
            </div>
            <p className="message-text">{msg.text}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="testimony-input" onSubmit={handleSend}>
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="State your testimony..."
          autoComplete="off"
        />
        <button type="submit" className="send-btn">
          Submit Testimony
        </button>
      </form>
    </div>
  );
}

export default OpenFloor;
