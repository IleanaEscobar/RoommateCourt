import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { get, onValue, ref, serverTimestamp, set } from 'firebase/database';
import { auth, rtdb } from '../../firebase';
import { generateJuryOpinion } from '../../utils/geminiService';
import './JuryVoting.css';
import CourtButton from '../../components/CourtButton/CourtButton';

const VERDICT_LABELS = {
  guilty: 'Guilty',
  not_guilty: 'Not Guilty',
  no_fault: 'No Fault',
};

function resolveCaseParties(caseInfo, currentUserId, routeStateUid, memberProfiles) {
  const memberIds = Object.keys(memberProfiles);
  const fallbackPlaintiffId = routeStateUid || currentUserId || memberIds[0] || '';
  const plaintiffId = caseInfo.filedBy || fallbackPlaintiffId;
  const configuredDefendantIds = Array.isArray(caseInfo.defendantIds)
    ? caseInfo.defendantIds.filter((memberId) => memberId !== plaintiffId)
    : [];
  const fallbackDefendantId = memberIds.find((memberId) => memberId !== plaintiffId) || plaintiffId;
  const defendantIds = configuredDefendantIds.length > 0 ? configuredDefendantIds : [fallbackDefendantId];
  const defendantNames = defendantIds
    .map((defendantId) => memberProfiles[defendantId]?.name || `User ${defendantId.slice(0, 6)}`)
    .join(', ');

  return {
    plaintiffName: memberProfiles[plaintiffId]?.name || 'Plaintiff',
    defendantName: defendantNames || 'Defendant',
  };
}

function JuryVoting() {
  const navigate = useNavigate();
  const { caseId } = useParams();
  const { state } = useLocation();
  const [phase, setPhase] = useState('voting');
  const [votesByUid, setVotesByUid] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [householdSeverity, setHouseholdSeverity] = useState('moderate');
  const [aiOpinion, setAiOpinion] = useState('');
  const [isLoadingOpinion, setIsLoadingOpinion] = useState(false);
  const [opinionError, setOpinionError] = useState('');
  const [caseData, setCaseData] = useState({
    title: 'Untitled Case',
    plaintiff: 'Plaintiff',
    defendant: 'Defendant',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate('/', { replace: true });
        return;
      }

      if (isMounted) {
        setCurrentUser(user);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (!currentUser) {
      return undefined;
    }

    let isMounted = true;
    let unsubscribeVotes = () => {};

    const loadVotingContext = async () => {
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
              uid: memberId,
              name: memberNameSnapshot.exists() ? memberNameSnapshot.val() : `User ${memberId.slice(0, 6)}`,
            };
          })
        );

        const memberProfiles = memberProfilesArray.reduce((acc, member) => {
          acc[member.uid] = member;
          return acc;
        }, {});

        const parties = resolveCaseParties(caseInfo, currentUser.uid, state?.uid, memberProfiles);
        let resolvedHouseholdSeverity = 'moderate';

        if (caseInfo.householdId) {
          const householdSeveritySnapshot = await get(ref(rtdb, `households/${caseInfo.householdId}/sentencingSeverity`));
          if (householdSeveritySnapshot.exists()) {
            resolvedHouseholdSeverity = householdSeveritySnapshot.val() || 'moderate';
          }
        }

        if (isMounted) {
          setParticipants(memberProfilesArray);
          setHouseholdSeverity(resolvedHouseholdSeverity);
          setCaseData({
            title: caseInfo.title || 'Untitled Case',
            plaintiff: parties.plaintiffName,
            defendant: parties.defendantName,
          });
        }

        const votesRef = ref(rtdb, `caseVotes/${caseId}`);
        unsubscribeVotes = onValue(votesRef, (snapshot) => {
          if (!isMounted) {
            return;
          }

          setVotesByUid(snapshot.exists() ? snapshot.val() : {});
        });
      } catch {
        if (isMounted) {
          setError('Unable to load jury members.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadVotingContext();

    return () => {
      isMounted = false;
      unsubscribeVotes();
    };
  }, [caseId, currentUser, state?.uid]);

  const votes = Object.entries(votesByUid)
    .map(([voterUid, voteData]) => {
      const participant = participants.find((entry) => entry.uid === voterUid);
      return {
        uid: voterUid,
        name: participant?.name || voteData?.name || `User ${voterUid.slice(0, 6)}`,
        verdict: voteData?.verdict || 'no_fault',
        createdAt: voteData?.createdAt || 0,
      };
    })
    .sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0));

  const totalVoters = participants.length;
  const myVote = currentUser ? votesByUid[currentUser.uid]?.verdict || null : null;

  const tally = Object.fromEntries(
    Object.keys(VERDICT_LABELS).map((key) => [key, votes.filter((vote) => vote.verdict === key).length])
  );

  const allVoted = totalVoters > 0 && votes.length >= totalVoters;

  const winningVerdict = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || 'no_fault';

  const handleVote = (verdict) => {
    if (!currentUser || myVote) return;

    const currentVoter = participants.find((participant) => participant.uid === currentUser.uid);
    const voterName = currentVoter?.name || currentUser.displayName || 'You';

    set(ref(rtdb, `caseVotes/${caseId}/${currentUser.uid}`), {
      verdict,
      name: `${voterName} (You)`,
      createdAt: serverTimestamp(),
    }).catch(() => {
      setError('Unable to save your vote right now. Please try again.');
    });
  };

  const handleGetAIOpinion = async () => {
    setOpinionError('');
    setAiOpinion('');
    setIsLoadingOpinion(true);

    try {
      const opinion = await generateJuryOpinion({
        caseTitle: caseData.title,
        plaintiffName: caseData.plaintiff,
        defendantName: caseData.defendant,
        householdSeverity,
        verdictCounts: tally,
        totalVoters,
      });

      setAiOpinion(opinion);
    } catch (geminiError) {
      setOpinionError(geminiError.message || 'Unable to get an AI opinion right now.');
    } finally {
      setIsLoadingOpinion(false);
    }
  };

  const handleReturnToDashboard = () => {
    const uid = currentUser?.uid;

    if (uid) {
      navigate(`/dashboard/${uid}`);
      return;
    }

    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="jury-voting-page">
        <div className="voting-card">
          <h1>Loading jury...</h1>
          <CourtButton variant="secondary" onClick={handleReturnToDashboard}>
            Return to Dashboard
          </CourtButton>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="jury-voting-page">
        <div className="voting-card">
          <h1>{error}</h1>
          <CourtButton variant="secondary" onClick={handleReturnToDashboard}>
            Return to Dashboard
          </CourtButton>
        </div>
      </div>
    );
  }

  if (phase === 'verdict') {
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
            {votes.map((vote) => (
              <div key={vote.uid} className="breakdown-row">
                <span className="breakdown-name">{vote.name}</span>
                <span className={`verdict-chip chip-${vote.verdict}`}>
                  {VERDICT_LABELS[vote.verdict]}
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
                  style={{ width: `${totalVoters > 0 ? (tally[key] / totalVoters) * 100 : 0}%` }}
                />
              </div>
              <span className="tally-count">{tally[key]}</span>
            </div>
          ))}
          <p className="voting-progress">
            {votes.length} of {totalVoters} roommates have voted
          </p>
        </div>

        <div className="ai-opinion-panel">
          <div className="ai-opinion-header">
            <h3>AI Opinion</h3>
            <p>Uses the household sentencing severity: {householdSeverity}</p>
          </div>
          <CourtButton variant="secondary" onClick={handleGetAIOpinion} disabled={isLoadingOpinion}>
            {isLoadingOpinion ? 'Asking Gemini...' : 'Get AI Opinion'}
          </CourtButton>
          {opinionError && <p className="ai-opinion-error">{opinionError}</p>}
          {aiOpinion && <div className="ai-opinion-result">{aiOpinion}</div>}
        </div>

        <CourtButton variant="secondary" onClick={handleReturnToDashboard}>
          Return to Dashboard
        </CourtButton>

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
