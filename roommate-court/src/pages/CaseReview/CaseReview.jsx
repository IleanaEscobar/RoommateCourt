import React, { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import './CaseReview.css';

const MOCK_MEMBERS = [
  { uid: '2', name: 'Jordan' },
  { uid: '3', name: 'Sam' },
];

function CaseReview() {
  const navigate = useNavigate();
  const { caseId } = useParams();
  const { state } = useLocation();

  const [title, setTitle] = useState('');
  const [defendant, setDefendant] = useState(MOCK_MEMBERS[0].uid);
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState('');

  const isReviewMode = Boolean(caseId);

  const handleSubmit = (e) => {
    e.preventDefault();
    const selectedDefendant = MOCK_MEMBERS.find(m => m.uid === defendant);
    navigate('/case/mock-case-123/review', {
      state: {
        caseData: {
          id: 'mock-case-123',
          title,
          description,
          evidence,
          plaintiff: 'Alex (You)',
          defendant: selectedDefendant.name,
        },
      },
    });
  };

  const handleOpenCourt = () => {
    navigate(`/case/${caseId}/waiting`, { state });
  };

  if (isReviewMode) {
    const data = state?.caseData || {
      id: caseId,
      title: 'Dishes Left in Sink',
      description: 'The dishes have been sitting in the sink for 5 days with no action taken.',
      evidence: 'Photo evidence + timestamps from group chat.',
      plaintiff: 'Alex',
      defendant: 'Jordan',
    };

    return (
      <div className="case-review-page">
        <div className="docket-panel">
          <div className="docket-header">
            <div className="docket-header-top">
              <span className="court-title">ROOMMATE COURT</span>
              <span className="status-badge">PENDING — AWAITING REVIEW</span>
            </div>
            <div className="docket-case-id">Case No. {data.id.toUpperCase()}</div>
          </div>

          <div className="docket-caption">
            <div className="party-block">
              <span className="party-role">PLAINTIFF</span>
              <span className="party-name">{data.plaintiff}</span>
            </div>
            <span className="versus">v.</span>
            <div className="party-block">
              <span className="party-role">DEFENDANT</span>
              <span className="party-name">{data.defendant}</span>
            </div>
          </div>

          <div className="docket-section">
            <span className="docket-section-label">CASE TITLE</span>
            <p>{data.title}</p>
          </div>

          <div className="docket-section">
            <span className="docket-section-label">STATEMENT OF FACTS</span>
            <p>{data.description}</p>
          </div>

          {data.evidence && (
            <div className="docket-section">
              <span className="docket-section-label">SUPPORTING EVIDENCE</span>
              <p>{data.evidence}</p>
            </div>
          )}

          <button className="court-btn primary" onClick={handleOpenCourt}>
            Open the Court
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="case-review-page">
      <div className="case-form-card">
        <h1>File a Case</h1>
        <p className="form-subtitle">State your grievance before the Roommate Court</p>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label>Case Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Dishes left in sink for 5 days"
              required
            />
          </div>

          <div className="form-field">
            <label>Defendant</label>
            <select value={defendant} onChange={e => setDefendant(e.target.value)} required>
              {MOCK_MEMBERS.map(m => (
                <option key={m.uid} value={m.uid}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>State Your Case</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the dispute in detail..."
              rows={5}
              required
            />
          </div>

          <div className="form-field">
            <label>
              Supporting Evidence <span className="optional">(optional)</span>
            </label>
            <textarea
              value={evidence}
              onChange={e => setEvidence(e.target.value)}
              placeholder="Screenshots, timestamps, witness accounts..."
              rows={3}
            />
          </div>

          <button type="submit" className="court-btn primary full-width">
            Submit Case
          </button>
        </form>
      </div>
    </div>
  );
}

export default CaseReview;
