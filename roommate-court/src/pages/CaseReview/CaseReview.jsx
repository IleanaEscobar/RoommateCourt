import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { rtdb, auth } from '../../firebase';
import CourtButton from '../../components/CourtButton/CourtButton';
import './CaseReview.css';

function formatCasePeople(caseInfo, currentUserId, routeStateUid, memberProfiles) {
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

	return {
		plaintiffName: memberProfiles[plaintiffId]?.name || 'Plaintiff',
		defendantNames
	};
}

function CaseReview() {
	const navigate = useNavigate();
	const { caseId } = useParams();
	const { state } = useLocation();
	const [caseData, setCaseData] = useState(null);
	const [partyNames, setPartyNames] = useState({ plaintiffName: 'Plaintiff', defendantNames: [] });
	const [loading, setLoading] = useState(true);
	const [currentUser, setCurrentUser] = useState(null);

	const justSubmitted = state?.justSubmitted ?? false;

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			if (!user) {
				navigate('/', { replace: true });
				return;
			}
			setCurrentUser(user);
		});
		return () => unsubscribe();
	}, [navigate]);

	useEffect(() => {
		if (!caseId) return;
		if (!currentUser) return;

		async function fetchCase() {
			try {
				const [caseSnap, submissionSnap] = await Promise.all([
					get(ref(rtdb, `cases/${caseId}`)),
					get(ref(rtdb, `caseSubmissions/${caseId}`))
				]);

				if (!caseSnap.exists()) {
					navigate('/', { replace: true });
					return;
				}

				const caseInfo = caseSnap.val();
				const submission = submissionSnap.exists() ? submissionSnap.val() : {};
				let memberIds = [];

				if (caseInfo.householdId) {
					const householdSnap = await get(ref(rtdb, `households/${caseInfo.householdId}/members`));
					if (householdSnap.exists()) {
						memberIds = Object.keys(householdSnap.val());
					}
				}

				if (memberIds.length === 0) {
					memberIds = Object.keys(caseInfo.users || {});
				}

				const memberProfilesArray = await Promise.all(
					memberIds.map(async (memberId) => {
						const nameSnapshot = await get(ref(rtdb, `users/${memberId}/name`));
						const name = nameSnapshot.exists() ? nameSnapshot.val() : `User ${memberId.slice(0, 6)}`;
						return { id: memberId, name };
					})
				);

				const memberProfiles = memberProfilesArray.reduce((acc, member) => {
					acc[member.id] = member;
					return acc;
				}, {});

				const resolvedPartyNames = formatCasePeople(
					caseInfo,
					currentUser.uid,
					state?.uid,
					memberProfiles
				);

				setPartyNames(resolvedPartyNames);
				setCaseData({ ...caseInfo, submission, id: caseId });
			} catch {
				navigate('/', { replace: true });
			} finally {
				setLoading(false);
			}
		}

		fetchCase();
	}, [caseId, currentUser, navigate, state?.uid]);

	const handleOpenCourt = () => {
		navigate(`/case/${caseId}/waiting`, { state });
	};

	const handleBackToDashboard = () => {
		const uid = state?.uid || currentUser?.uid;
		navigate(`/dashboard/${uid}`);
	};

	if (loading) {
		return (
			<div className="case-review-page">
				<div className="docket-loading">Loading case...</div>
			</div>
		);
	}

	const severityLabel = caseData?.severity
		? caseData.severity.charAt(0).toUpperCase() + caseData.severity.slice(1)
		: 'Unknown';

	return (
		<div className="case-review-page">
			{justSubmitted && (
				<div className="submission-success-banner">
					Case filed successfully — your submission has been saved.
				</div>
			)}

			<div className="docket-panel">
				<div className="docket-header">
					<div className="docket-header-top">
						<span className="court-title">ROOMMATE COURT</span>
						<span className="status-badge">PENDING — AWAITING REVIEW</span>
					</div>
					<div className="docket-case-id">Case No. {caseData.id.toUpperCase()}</div>
				</div>

				<div className="docket-caption">
					<div className="party-block">
						<span className="party-role">PLAINTIFF</span>
						<span className="party-name">{partyNames.plaintiffName}</span>
					</div>
					<span className="versus">v.</span>
					<div className="party-block">
						<span className="party-role">DEFENDANT(S)</span>
						<div className="party-defendant-list">
							{partyNames.defendantNames.length > 0 ? (
								partyNames.defendantNames.map((name) => (
									<span className="party-defendant-chip" key={name}>
										{name}
									</span>
								))
							) : (
								<span className="party-name">Defendant</span>
							)}
						</div>
					</div>
				</div>

				<div className="docket-section">
					<span className="docket-section-label">CASE TITLE</span>
					<p>{caseData.title}</p>
				</div>

				<div className="docket-section">
					<span className="docket-section-label">SEVERITY</span>
					<p>{severityLabel}</p>
				</div>

				{caseData.submission && Object.keys(caseData.submission).length > 0 && (
					<div className="docket-section">
						<span className="docket-section-label">STATEMENT OF FACTS</span>
						{Object.values(caseData.submission).map((entry, i) => (
							<div className="docket-qa" key={i}>
								<p className="docket-question">{entry.question}</p>
								<p className="docket-answer">{entry.answer}</p>
							</div>
						))}
					</div>
				)}

				<div className="docket-actions">
					<CourtButton variant="secondary" onClick={handleBackToDashboard}>
						Back to Dashboard
					</CourtButton>
					<CourtButton variant="primary" onClick={handleOpenCourt}>
						Open the Court
					</CourtButton>
				</div>
			</div>
		</div>
	);
}

export default CaseReview;
