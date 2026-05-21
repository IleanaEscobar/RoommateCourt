import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import './OpenFloor.css';
import CourtButton from '../../components/CourtButton/CourtButton';

// const MOCK_MESSAGES = [
//   {
//     id: '1',
//     uid: '1',
//     name: 'Alex',
//     role: 'plaintiff',
//     text: 'I want to address the ongoing issue with dishes being left in the sink. This has been happening repeatedly for the past two weeks and it is affecting the whole household.',
//     time: '9:02 AM',
//   },
//   {
//     id: '2',
//     uid: '2',
//     name: 'Jordan',
//     role: 'defendant',
//     text: "I understand the concern, but I was away for work last week. I don't think it's fair to put this entirely on me.",
//     time: '9:05 AM',
//   },
//   {
//     id: '3',
//     uid: '3',
//     name: 'Sam',
//     role: 'juror',
//     text: 'For the record, I can confirm I saw dishes in the sink on Monday, Wednesday, and Friday of last week.',
//     time: '9:07 AM',
//   },
// ];

// const CURRENT_USER = { uid: '1', name: 'Alex', role: 'plaintiff' };

/* Initialize speakers */
const INITIAL_SPEAKERS = [
  { uid: '1', name: 'Alex', role: 'plaintiff', status: 'waiting', extraRequested: false },
  { uid: '2', name: 'Jordan', role: 'defendant', status: 'waiting', extraRequested: false },
  { uid: '3', name: 'Sam', role: 'juror', status: 'waiting', extraRequested: false },
  { uid: '4', name: 'Eden', role: 'juror', status: 'waiting', extraRequested: false },
];

const CURRENT_USER = { uid: '3', name: 'Sam', role: 'juror' };
const START_SECONDS = 45;
const EXTRA_SECONDS = 20;
/* END NEW SECTION */

function OpenFloor() {
  const navigate = useNavigate();
  const { caseId } = useParams();
  const { state } = useLocation();

  // const [messages, setMessages] = useState(MOCK_MESSAGES);
  // const [inputText, setInputText] = useState('');
  // const messagesEndRef = useRef(null);

  /* Create speaker objects */
  const [speakers, setSpeakers] = useState(INITIAL_SPEAKERS);
  const [currentSpeakerId, setCurrentSpeakerId] = useState(INITIAL_SPEAKERS[0].uid);
  const [secondsRemaining, setSecondsRemaining] = useState(START_SECONDS);
  const [isVoteOpen, setIsVoteOpen] = useState(false);
  const [votes, setVotes] = useState({ yes: 2, no: 1, castBy: ['1', '4'] });
  /* END NEW SECTION */

  const caseData = state?.caseData || {
    title: 'Dishes Left in Sink',
    plaintiff: 'Alex',
    defendant: 'Jordan',
  };

  // useEffect(() => {
  //   messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  // }, [messages]);

  // const handleSend = (e) => {
  //   e.preventDefault();
  //   if (!inputText.trim()) return;
  //   setMessages(prev => [
  //     ...prev,
  //     {
  //       id: Date.now().toString(),
  //       uid: CURRENT_USER.uid,
  //       name: CURRENT_USER.name,
  //       role: CURRENT_USER.role,
  //       text: inputText.trim(),
  //       time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  //     },
  //   ]);
  //   setInputText('');
  // };

  /* Declare active speaker */
  const activeSpeaker = speakers.find((speaker) => speaker.uid === currentSpeakerId);
  /* END NEW SECTION */

  const handleCloseFloor = () => {
    navigate(`/case/${caseId}/voting`, { state });
  };

  const getRoleBadgeClass = (role) => {
    if (role === 'plaintiff') return 'badge-plaintiff';
    if (role === 'defendant') return 'badge-defendant';
    return 'badge-juror';
  };

  // const getMessageClass = (role) => {
  //   if (role === 'plaintiff') return 'message-plaintiff';
  //   if (role === 'defendant') return 'message-defendant';
  //   return 'message-juror';
  // };

  /* Implement real-time timer */
  useEffect(() => {
    if (!currentSpeakerId || isVoteOpen) return;
    if (secondsRemaining <= 0) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentSpeakerId, secondsRemaining, isVoteOpen]);

  useEffect(() => {
    if (secondsRemaining === 0 && currentSpeakerId && !isVoteOpen) {
      setIsVoteOpen(true);
    }
  }, [secondsRemaining, currentSpeakerId, isVoteOpen]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${remainder.toString().padStart(2, '0')}`;
  };

  const moveToNextSpeaker = () => {
    setSpeakers((prev) => {
      const updated = prev.map((speaker) => {
        if (speaker.uid === currentSpeakerId) {
          return { ...speaker, status: 'completed', extraRequested: false };
        }
        return speaker;
      });

      const nextSpeaker = updated.find((speaker) => speaker.status === 'waiting');

      if (nextSpeaker) {
        setCurrentSpeakerId(nextSpeaker.uid);
        setSecondsRemaining(START_SECONDS);
        setIsVoteOpen(false);
        setVotes({ yes: 0, no: 0, castBy: [] });

        return updated.map((speaker) => {
          if (speaker.uid === nextSpeaker.uid) {
            return { ...speaker, status: 'speaking' };
          }
          return speaker;
        });
      }

      setCurrentSpeakerId(null);
      return updated;
    });
  };

  const handleGrantExtraTime = () => {
    setSecondsRemaining((prev) => prev + EXTRA_SECONDS);
    setIsVoteOpen(false);
    setVotes({ yes: 0, no: 0, castBy: [] });
  };

  const handleVote = (choice) => {
    if (votes.castBy.includes(CURRENT_USER.uid)) return;

    setVotes((prev) => ({
      yes: choice === 'yes' ? prev.yes + 1 : prev.yes,
      no: choice === 'no' ? prev.no + 1 : prev.no,
      castBy: [...prev.castBy, CURRENT_USER.uid],
    }));
  };

  const handleRequestExtraTurn = (uid) => {
    if (uid !== CURRENT_USER.uid || uid === currentSpeakerId) return;

    setSpeakers((prev) =>
      prev.map((speaker) =>
        speaker.uid === uid ? { ...speaker, extraRequested: true } : speaker
      )
    );
  };

  const voteThreshold = Math.ceil(speakers.length / 2);
  const canGrantExtra = votes.yes >= voteThreshold;
  /* END NEW SECTION */

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

      {/* <div className="messages-thread">
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
      </form> */}

      <div className="floor-body">
        <section className="timer-card">
          <span className="timer-label">Current Speaker</span>
          <div className="timer-display">
            {activeSpeaker ? activeSpeaker.name : 'No speaker'}
          </div>
          <div className="timer-countdown">{formatTime(secondsRemaining)}</div>
          <div className="timer-progress">
            <div
              className="timer-progress-fill"
              style={{ width: `${Math.min((secondsRemaining / START_SECONDS) * 100, 100)}%` }}
            />
          </div>
        </section>

        <section className="speaker-panel">
          <div className="speaker-panel-header">
            <h2>Speaker Queue</h2>
            <span className="speaker-count">{speakers.length} participants</span>
          </div>

          <div className="speaker-list">
            {speakers.map((speaker) => (
              <div
                key={speaker.uid}
                className={`speaker-row ${speaker.status} ${speaker.uid === currentSpeakerId ? 'active' : ''}`}
              >
                <div className="speaker-info">
                  <div className="speaker-avatar">{speaker.name[0]}</div>
                  <div>
                    <div className="speaker-name">
                      {speaker.name} {speaker.uid === CURRENT_USER.uid ? '(You)' : ''}
                    </div>
                    <div className="speaker-status">
                      {speaker.status === 'speaking' && 'Speaking now'}
                      {speaker.status === 'waiting' && 'Waiting'}
                      {speaker.status === 'completed' && 'Completed'}
                    </div>
                  </div>
                </div>

                <div className="speaker-actions">
                  {speaker.extraRequested && <span className="speaker-requested">+ Requested</span>}
                  {speaker.uid === CURRENT_USER.uid &&
                    speaker.status === 'waiting' &&
                    !speaker.extraRequested && (
                      <button
                        type="button"
                        className="request-extra-btn"
                        onClick={() => handleRequestExtraTurn(speaker.uid)}
                      >
                        +
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {isVoteOpen && activeSpeaker && (
          <section className="vote-panel">
            <div className="vote-header">
              <h3>Vote to add extra time</h3>
              <p>When {activeSpeaker.name}'s 45 seconds ends, everyone can vote to add 10 more seconds.</p>
            </div>

            <div className="vote-controls">
              <CourtButton variant="secondary" onClick={() => handleVote('yes')} disabled={votes.castBy.includes(CURRENT_USER.uid)}>
                Vote Yes
              </CourtButton>
              <CourtButton variant="secondary" onClick={() => handleVote('no')} disabled={votes.castBy.includes(CURRENT_USER.uid)}>
                Vote No
              </CourtButton>
              <CourtButton variant="primary" onClick={handleGrantExtraTime} disabled={!canGrantExtra}>
                Grant +20 seconds
              </CourtButton>
              <CourtButton variant="secondary" onClick={moveToNextSpeaker}>
                End Turn
              </CourtButton>
            </div>

            <div className="vote-summary">
              <span>YES Votes: {votes.yes}</span>
              <span>NO Votes: {votes.no}</span>
              <span>*Need {voteThreshold} yes votes to grant extra time</span>
              {votes.castBy.includes(CURRENT_USER.uid) && (
                <span className="vote-note">You have already voted.</span>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default OpenFloor;
