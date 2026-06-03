import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { get, ref } from 'firebase/database';
import { auth, rtdb } from '../../firebase';
import './OpenFloor.css';
import CourtButton from '../../components/CourtButton/CourtButton';

const START_SECONDS = 45;
const EXTRA_SECONDS = 20;

function resolveCaseMembers(caseInfo, currentUserId, routeStateUid, memberProfiles) {
  const memberIds = Object.keys(memberProfiles);
  const fallbackPlaintiffId = routeStateUid || currentUserId || memberIds[0] || '';
  const plaintiffId = caseInfo.filedBy || fallbackPlaintiffId;
  const configuredDefendantIds = Array.isArray(caseInfo.defendantIds)
    ? caseInfo.defendantIds.filter((memberId) => memberId !== plaintiffId)
    : [];
  const fallbackDefendantId = memberIds.find((memberId) => memberId !== plaintiffId) || plaintiffId;
  const defendantIds = configuredDefendantIds.length > 0 ? configuredDefendantIds : [fallbackDefendantId];
  const defendantNames = defendantIds.map(
    (defendantId) => memberProfiles[defendantId]?.name || `User ${defendantId.slice(0, 6)}`
  );

  const orderedIds = [
    plaintiffId,
    ...defendantIds,
    ...memberIds.filter((id) => id !== plaintiffId && !defendantIds.includes(id))
  ];

  const speakers = orderedIds.map((memberId, index) => ({
    uid: memberId,
    name: memberProfiles[memberId]?.name || `User ${memberId.slice(0, 6)}`,
    role: memberId === plaintiffId ? 'plaintiff' : defendantIds.includes(memberId) ? 'defendant' : 'juror',
    status: index === 0 ? 'speaking' : 'waiting',
    extraRequested: false,
  }));

  return {
    speakers,
    caseData: {
      title: caseInfo.title || 'Untitled Case',
      plaintiff: memberProfiles[plaintiffId]?.name || 'Plaintiff',
      defendants: defendantNames,
    },
  };
}

function OpenFloor() {
  const navigate = useNavigate();
  const { caseId } = useParams();
  const { state } = useLocation();

  const [currentUserUid, setCurrentUserUid] = useState('');
  const [speakers, setSpeakers] = useState([]);
  const [currentSpeakerId, setCurrentSpeakerId] = useState(null);
  const [secondsRemaining, setSecondsRemaining] = useState(START_SECONDS);
  const [isVoteOpen, setIsVoteOpen] = useState(false);
  const [votes, setVotes] = useState({ yes: 0, no: 0, castBy: [] });
  const [caseData, setCaseData] = useState({
    title: 'Untitled Case',
    plaintiff: 'Plaintiff',
    defendants: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const loadOpenFloor = async () => {
        if (!user) {
          navigate('/', { replace: true });
          return;
        }

        setCurrentUserUid(user.uid);
        setIsLoading(true);
        setError('');

        try {
          const caseSnapshot = await get(ref(rtdb, `cases/${caseId}`));

          if (!caseSnapshot.exists()) {
            if (isMounted) {
              setError('Case not found.');
            }
            return;
          }

          const caseInfo = caseSnapshot.val();
          let memberIds = [];

          if (caseInfo.householdId) {
            const householdMembersSnapshot = await get(ref(rtdb, `households/${caseInfo.householdId}/members`));
            if (householdMembersSnapshot.exists()) {
              memberIds = Object.keys(householdMembersSnapshot.val());
            }
          }

          if (memberIds.length === 0) {
            memberIds = Object.keys(caseInfo.users || {});
          }

          if (memberIds.length === 0) {
            if (isMounted) {
              setError('No roommates found for this case.');
            }
            return;
          }

          const memberProfilesArray = await Promise.all(
            memberIds.map(async (memberId) => {
              const memberNameSnapshot = await get(ref(rtdb, `users/${memberId}/name`));
              return {
                id: memberId,
                name: memberNameSnapshot.exists() ? memberNameSnapshot.val() : `User ${memberId.slice(0, 6)}`,
              };
            })
          );

          const memberProfiles = memberProfilesArray.reduce((acc, member) => {
            acc[member.id] = member;
            return acc;
          }, {});

          const resolved = resolveCaseMembers(caseInfo, user.uid, state?.uid, memberProfiles);

          if (isMounted) {
            setSpeakers(resolved.speakers);
            setCurrentSpeakerId(resolved.speakers[0]?.uid || null);
            setCaseData(resolved.caseData);
          }
        } catch {
          if (isMounted) {
            setError('Unable to load courtroom participants.');
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      };

      loadOpenFloor();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [caseId, navigate, state?.uid]);

  const activeSpeaker = speakers.find((speaker) => speaker.uid === currentSpeakerId);

  const handleCloseFloor = () => {
    navigate(`/case/${caseId}/voting`, { state });
  };

  const handleBackToDashboard = () => {
    if (currentUserUid) {
      navigate(`/dashboard/${currentUserUid}`);
      return;
    }

    navigate('/');
  };

  useEffect(() => {
    if (!currentSpeakerId || isVoteOpen || isLoading || error) return;
    if (secondsRemaining <= 0) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentSpeakerId, secondsRemaining, isVoteOpen, isLoading, error]);

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
    if (!currentUserUid || votes.castBy.includes(currentUserUid)) return;

    setVotes((prev) => ({
      yes: choice === 'yes' ? prev.yes + 1 : prev.yes,
      no: choice === 'no' ? prev.no + 1 : prev.no,
      castBy: [...prev.castBy, currentUserUid],
    }));
  };

  const handleRequestExtraTurn = (uid) => {
    if (uid !== currentUserUid || uid === currentSpeakerId) return;

    setSpeakers((prev) =>
      prev.map((speaker) =>
        speaker.uid === uid ? { ...speaker, extraRequested: true } : speaker
      )
    );
  };

  const voteThreshold = Math.ceil(speakers.length / 2);
  const canGrantExtra = votes.yes >= voteThreshold;

  if (isLoading) {
    return (
      <div className="open-floor-page">
        <div className="floor-header">
          <h1 className="floor-title">Loading courtroom...</h1>
          <CourtButton variant="secondary" onClick={handleBackToDashboard}>
            Back to Dashboard
          </CourtButton>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="open-floor-page">
        <div className="floor-header">
          <h1 className="floor-title">{error}</h1>
          <CourtButton variant="secondary" onClick={handleBackToDashboard}>
            Back to Dashboard
          </CourtButton>
        </div>
      </div>
    );
  }

  return (
    <div className="open-floor-page">
      <div className="floor-header">
        <div className="floor-caption">
          <span className="case-vs">{caseData.plaintiff} v.</span>
          <div className="case-defendant-list">
            {caseData.defendants.length > 0 ? (
              caseData.defendants.map((name) => (
                <span className="case-defendant-chip" key={name}>
                  {name}
                </span>
              ))
            ) : (
              <span className="case-defendant-chip">Defendant</span>
            )}
          </div>
          <span className="case-id-label">Case #{caseId?.toUpperCase()}</span>
        </div>
        <h1 className="floor-title">Speak your truth!</h1>
        <div className="floor-header-actions">
          <CourtButton variant="secondary" onClick={handleBackToDashboard}>
            Back to Dashboard
          </CourtButton>
          <button className="close-floor-btn" onClick={handleCloseFloor}>
            Close the Floor
          </button>
        </div>
      </div>

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
                      {speaker.name} {speaker.uid === currentUserUid ? '(You)' : ''}
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
                  {speaker.uid === currentUserUid &&
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
              <CourtButton variant="secondary" onClick={() => handleVote('yes')} disabled={votes.castBy.includes(currentUserUid)}>
                Vote Yes
              </CourtButton>
              <CourtButton variant="secondary" onClick={() => handleVote('no')} disabled={votes.castBy.includes(currentUserUid)}>
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
              {votes.castBy.includes(currentUserUid) && (
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
