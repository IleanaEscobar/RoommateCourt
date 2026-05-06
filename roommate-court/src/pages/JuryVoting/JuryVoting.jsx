import React, { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { auth } from '../../firebase';
import './JuryVoting.css';
import CourtButton from '../../components/CourtButton/CourtButton';

const INITIAL_VOTES = [
  { uid: '2', name: 'Jordan', verdict: 'not_guilty' },
  { uid: '3', name: 'Sam', verdict: 'guilty' },
];
const TOTAL_VOTERS = 3;

const VERDICT_LABELS = {
  guilty: 'Guilty',
  not_guilty: 'Not Guilty',
  no_fault: 'No Fault',
};

function JuryVoting() {
  const navigate = useNavigate();
  const { caseId } = useParams();
  const { state } = useLocation();
  const [phase, setPhase] = useState('voting');
  const [votes, setVotes] = useState(INITIAL_VOTES);
  const [myVote, setMyVote] = useState(null);

  const caseData = state?.caseData || {
    title: 'Dishes Left in Sink',
    plaintiff: 'Alex',
    defendant: 'Jordan',
  };

  const tally = Object.fromEntries(
    Object.keys(VERDICT_LABELS).map(k => [k, votes.filter(v => v.verdict === k).length])
  );

  const allVoted = votes.length >= TOTAL_VOTERS;

  const winningVerdict = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];

  const handleVote = (verdict) => {
    if (myVote) return;
    setMyVote(verdict);
    setVotes(prev => [...prev, { uid: '1', name: 'Alex (You)', verdict }]);
  };

  const handleReturnToDashboard = () => {
    const uid = auth.currentUser?.uid || 'demo';
    navigate(`/dashboard/${uid}`);
  };

  if (phase === 'verdict') {
    const verdictDescriptions = {
      guilty: `${caseData.defendant} is found at fault.`,
      not_guilty: `${caseData.defendant} is found not at fault.`,
      no_fault: 'Both parties share responsibility.',
    };

    return (
      <div className="verdict-page">
        <div className="verdict-panel">
          <p className="verdict-pre-label">THE COURT FINDS</p>
          <p className="verdict-description">{caseData.defendant}</p>
          <div className={`verdict-stamp stamp-${winningVerdict}`}>
            {VERDICT_LABELS[winningVerdict].toUpperCase()}
          </div>
          <div className="verdict-breakdown">
            <h3>Vote Breakdown</h3>
            {votes.map(v => (
              <div key={v.uid} className="breakdown-row">
                <span className="breakdown-name">{v.name}</span>
                <span className={`verdict-chip chip-${v.verdict}`}>
                  {VERDICT_LABELS[v.verdict]}
                </span>
              </div>
            ))}
          </div>

          <CourtButton variant="secondary" onClick={handleReturnToDashboard}>
            Return to Dashboard
          </CourtButton>
        </div>
      </div>
    );
  }

  return (
    <div className="jury-voting-page">
      <div className="voting-card">
        <h1>The Jury Will Now Deliberate</h1>

        <div className="case-summary">
          <span className="summary-title">{caseData.title}</span>
          <span className="summary-caption">{caseData.plaintiff} v. {caseData.defendant}</span>
        </div>

        <p className="voting-instruction">Cast your verdict:</p>

        <div className="verdict-buttons">
          <button
            className={`verdict-btn btn-guilty ${myVote === 'guilty' ? 'selected' : ''}`}
            onClick={() => handleVote('guilty')}
            disabled={!!myVote}
          >
            Guilty
          </button>
          <button
            className={`verdict-btn btn-not-guilty ${myVote === 'not_guilty' ? 'selected' : ''}`}
            onClick={() => handleVote('not_guilty')}
            disabled={!!myVote}
          >
            Not Guilty
          </button>
          <button
            className={`verdict-btn btn-no-fault ${myVote === 'no_fault' ? 'selected' : ''}`}
            onClick={() => handleVote('no_fault')}
            disabled={!!myVote}
          >
            No Fault
          </button>
        </div>

        {myVote && (
          <p className="vote-confirmed">
            Your vote has been recorded: <strong>{VERDICT_LABELS[myVote]}</strong>
          </p>
        )}

        <div className="tally-panel">
          <h3>Current Tally</h3>
          {Object.entries(VERDICT_LABELS).map(([key, label]) => (
            <div key={key} className="tally-row">
              <span className="tally-label">{label}</span>
              <div className="tally-bar-wrap">
                <div
                  className={`tally-bar tally-${key}`}
                  style={{ width: `${TOTAL_VOTERS > 0 ? (tally[key] / TOTAL_VOTERS) * 100 : 0}%` }}
                />
              </div>
              <span className="tally-count">{tally[key]}</span>
            </div>
          ))}
          <p className="voting-progress">
            {votes.length} of {TOTAL_VOTERS} roommates have voted
          </p>
        </div>

        {allVoted && (
          <CourtButton variant="primary" onClick={() => setPhase('verdict')}>
            Reveal Verdict
          </CourtButton>
        )}
      </div>
    </div>
  );
}

export default JuryVoting;
