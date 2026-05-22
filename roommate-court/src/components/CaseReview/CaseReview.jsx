import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { rtdb, auth } from '../../firebase';
import './CaseReview.css';

function CaseReview() {
	const navigate = useNavigate();
	const { caseId } = useParams();
	const { state } = useLocation();
	const [caseData, setCaseData] = useState(null);
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

				setCaseData({ ...caseInfo, submission, id: caseId });
			} catch {
				navigate('/', { replace: true });
			} finally {
				setLoading(false);
			}
		}

		fetchCase();
	}, [caseId, navigate]);

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

	const plaintiffName = currentUser?.displayName || currentUser?.email || 'Plaintiff';
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
						<span className="party-name">{plaintiffName}</span>
					</div>
					<span className="versus">v.</span>
					<div className="party-block">
						<span className="party-role">DEFENDANT</span>
						<span className="party-name">Respondent</span>
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
					<button className="court-btn secondary" onClick={handleBackToDashboard}>
						Back to Dashboard
					</button>
					<button className="court-btn primary" onClick={handleOpenCourt}>
						Open the Court
					</button>
				</div>
			</div>
		</div>
	);
}

export default CaseReview;
