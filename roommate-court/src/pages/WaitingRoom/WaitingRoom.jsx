import React, { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import './WaitingRoom.css';

const MOCK_MEMBERS = [
  { uid: '1', name: 'Alex', present: true },
  { uid: '2', name: 'Jordan', present: true },
  { uid: '3', name: 'Sam', present: false },
];

const CURRENT_USER_UID = '3';

function WaitingRoom() {
  const navigate = useNavigate();
  const { caseId } = useParams();
  const { state } = useLocation();
  const [members, setMembers] = useState(MOCK_MEMBERS);

  const presentCount = members.filter(m => m.present).length;
  const allPresent = presentCount === members.length;
  const hasJoined = members.find(m => m.uid === CURRENT_USER_UID)?.present;

  const handleJoin = () => {
    setMembers(prev =>
      prev.map(m => m.uid === CURRENT_USER_UID ? { ...m, present: true } : m)
    );
  };

  const handleBeginFloor = () => {
    navigate(`/case/${caseId}/floor`, { state });
  };

  return (
    <div className="waiting-room-page">
      <div className="waiting-room-card">
        <div className="waiting-room-header">
          <div className="gavel-icon"></div>
          <h1>All Rise</h1>
          <p>Waiting for the Court to Convene</p>
        </div>

        <div className="presence-counter">
          <span className="counter-text">{presentCount} of {members.length} roommates present</span>
          <div className="presence-bar">
            <div
              className="presence-fill"
              style={{ width: `${(presentCount / members.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="roster">
          {members.map(m => (
            <div key={m.uid} className={`roster-item ${m.present ? 'present' : 'absent'}`}>
              <div className="roster-avatar">{m.name[0]}</div>
              <span className="roster-name">
                {m.name}{m.uid === CURRENT_USER_UID ? ' (You)' : ''}
              </span>
              <span className="roster-status">
                {m.present ? 'Present' : 'Waiting'}
              </span>
            </div>
          ))}
        </div>

        {!hasJoined && (
          <button className="court-btn secondary" onClick={handleJoin}>
            Check In to Court
          </button>
        )}

        <button
          className="court-btn primary"
          onClick={handleBeginFloor}
          disabled={!allPresent}
        >
          Begin Open Floor
        </button>

        {!allPresent && (
          <p className="waiting-note">
            Waiting for all roommates to check in before proceedings can begin.
          </p>
        )}
      </div>
    </div>
  );
}

export default WaitingRoom;
