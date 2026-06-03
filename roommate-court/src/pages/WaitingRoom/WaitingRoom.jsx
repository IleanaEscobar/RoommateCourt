import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { get, onValue, ref, set } from 'firebase/database';
import { auth, rtdb } from '../../firebase';
import './WaitingRoom.css';
import CourtButton from '../../components/CourtButton/CourtButton';

function WaitingRoom() {
  const navigate = useNavigate();
  const { caseId } = useParams();
  const { state } = useLocation();
  const [members, setMembers] = useState([]);
  const [presenceByUid, setPresenceByUid] = useState({});
  const [currentUserUid, setCurrentUserUid] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    let unsubscribePresence = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      const loadWaitingRoom = async () => {
        if (!user) {
          navigate('/', { replace: true });
          return;
        }

        unsubscribePresence();
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

          const caseData = caseSnapshot.val();
          const householdId = caseData.householdId;

          if (!householdId) {
            if (isMounted) {
              setError('This case is not linked to a household.');
            }
            return;
          }

          const householdSnapshot = await get(ref(rtdb, `households/${householdId}`));

          if (!householdSnapshot.exists()) {
            if (isMounted) {
              setError('The linked household could not be found.');
            }
            return;
          }

          const householdData = householdSnapshot.val();
          const memberIds = Object.keys(householdData.members || {});

          if (!householdData.members?.[user.uid]) {
            if (isMounted) {
              setError('You are not a member of this household.');
            }
            return;
          }

          if (memberIds.length === 0) {
            if (isMounted) {
              setError('This household has no members to display.');
            }
            return;
          }

          const loadedMembers = await Promise.all(
            memberIds.map(async (memberId) => {
              const memberNameSnapshot = await get(ref(rtdb, `users/${memberId}/name`));
              const memberName = memberNameSnapshot.exists()
                ? memberNameSnapshot.val()
                : `User ${memberId.slice(0, 6)}`;

              return {
                uid: memberId,
                name: memberName
              };
            })
          );

          if (isMounted) {
            setMembers(loadedMembers);
            setPresenceByUid({});
          }

          const presenceRef = ref(rtdb, `casePresence/${caseId}`);
          unsubscribePresence = onValue(presenceRef, (snapshot) => {
            if (!isMounted) {
              return;
            }

            const livePresence = snapshot.exists() ? snapshot.val() : {};
            setPresenceByUid(livePresence);
          });
        } catch {
          if (isMounted) {
            setError('Unable to load household members right now.');
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      };

      loadWaitingRoom();
    });

    return () => {
      isMounted = false;
      unsubscribePresence();
      unsubscribeAuth();
    };
  }, [caseId, navigate]);

  const presentCount = members.filter((member) => Boolean(presenceByUid[member.uid])).length;
  const totalMembers = members.length;
  const allPresent = totalMembers > 0 && presentCount === totalMembers;
  const hasJoined = currentUserUid ? Boolean(presenceByUid[currentUserUid]) : false;

  const handleJoin = async () => {
    if (!currentUserUid) {
      return;
    }

    try {
      await set(ref(rtdb, `casePresence/${caseId}/${currentUserUid}`), true);
    } catch {
      setError('Unable to check in right now. Please try again.');
    }
  };

  const handleBeginFloor = () => {
    navigate(`/case/${caseId}/floor`, { state });
  };

  const handleBack = () => {
    if (currentUserUid) {
      navigate(`/dashboard/${currentUserUid}`);
      return;
    }

    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="waiting-room-page">
        <div className="waiting-room-card">
          <div className="waiting-room-header">
            <h1>All Rise</h1>
            <p>Loading household members...</p>
          </div>

          <div className="waiting-room-actions">
            <CourtButton variant="secondary" onClick={handleBack}>
              Back to Dashboard
            </CourtButton>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="waiting-room-page">
        <div className="waiting-room-card">
          <div className="waiting-room-header">
            <h1>All Rise</h1>
            <p>{error}</p>
          </div>

          <div className="waiting-room-actions">
            <CourtButton variant="secondary" onClick={handleBack}>
              Back to Dashboard
            </CourtButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="waiting-room-page">
      <div className="waiting-room-card">
        <div className="waiting-room-header">
          <div className="gavel-icon"></div>
          <h1>All Rise</h1>
          <p>Waiting for the Court to Convene</p>
        </div>

        <div className="presence-counter">
          <span className="counter-text">{presentCount} of {totalMembers} roommates present</span>
          <div className="presence-bar">
            <div
              className="presence-fill"
              style={{ width: `${totalMembers > 0 ? (presentCount / totalMembers) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="roster">
          {members.map((member) => (
            <div
              key={member.uid}
              className={`roster-item ${presenceByUid[member.uid] ? 'present' : 'absent'}`}
            >
              <div className="roster-avatar">{member.name.charAt(0).toUpperCase()}</div>
              <span className="roster-name">
                {member.name}{member.uid === currentUserUid ? ' (You)' : ''}
              </span>
              <span className="roster-status">
                {presenceByUid[member.uid] ? 'Present' : 'Waiting'}
              </span>
            </div>
          ))}
        </div>

        <div className="waiting-room-actions">
          <CourtButton variant="secondary" onClick={handleBack}>
            Back to Dashboard
          </CourtButton>

          {!hasJoined && (
            <CourtButton variant="secondary" onClick={handleJoin}>
              Check In to Court
            </CourtButton>
          )}

          <CourtButton variant="primary" onClick={handleBeginFloor} disabled={!allPresent}>
            Begin Open Floor
          </CourtButton>
        </div>

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
