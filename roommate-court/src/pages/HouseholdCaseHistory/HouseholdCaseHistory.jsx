import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { get, ref } from 'firebase/database';
import { auth, rtdb } from '../../firebase';
import './HouseholdCaseHistory.css';

const VERDICT_LABELS = {
	guilty: 'Guilty',
	not_guilty: 'Not Guilty',
	no_fault: 'No Fault',
	pending: 'Pending',
};

function resolveVerdict(caseData, votesByUid) {
	if (caseData?.verdict && caseData.verdict !== 'pending') {
		return caseData.verdict;
	}

	const voteEntries = Object.values(votesByUid || {});
	if (voteEntries.length === 0) {
		return 'pending';
	}

	const tally = { guilty: 0, not_guilty: 0, no_fault: 0 };
	voteEntries.forEach((vote) => {
		if (tally[vote?.verdict] !== undefined) {
			tally[vote.verdict] += 1;
		}
	});

	const winner = Object.entries(tally).sort((left, right) => right[1] - left[1])[0]?.[0];
	return winner || 'pending';
}

function formatCreatedAt(rawCreatedAt) {
	if (typeof rawCreatedAt !== 'number') {
		return 'Unknown date';
	}

	const parsed = new Date(rawCreatedAt);
	if (Number.isNaN(parsed.getTime())) {
		return 'Unknown date';
	}

	return parsed.toLocaleString();
}

function HouseholdCaseHistory() {
	const navigate = useNavigate();
	const { uid, householdId } = useParams();
	const [isLoading, setIsLoading] = useState(true);
	const [isAuthorized, setIsAuthorized] = useState(false);
	const [error, setError] = useState('');
	const [householdName, setHouseholdName] = useState('Household');
	const [cases, setCases] = useState([]);

	useEffect(() => {
		let isMounted = true;

		const unsubscribe = onAuthStateChanged(auth, (user) => {
			const loadHistory = async () => {
				if (!user || user.uid !== uid) {
					navigate('/', { replace: true });
					return;
				}

				setIsLoading(true);
				setError('');

				try {
					const householdSnapshot = await get(ref(rtdb, `households/${householdId}`));
					if (!householdSnapshot.exists()) {
						if (isMounted) {
							setError('Household not found.');
						}
						return;
					}

					const householdData = householdSnapshot.val();
					if (!householdData?.members?.[uid]) {
						if (isMounted) {
							setError('You are not authorized to view this household history.');
						}
						return;
					}

					const householdCasesSnapshot = await get(ref(rtdb, `households/${householdId}/cases`));
					const householdCaseIds = householdCasesSnapshot.exists() ? Object.keys(householdCasesSnapshot.val()) : [];

					const caseEntries = await Promise.all(
						householdCaseIds.map(async (caseId) => {
							const caseSnapshot = await get(ref(rtdb, `cases/${caseId}`));
							if (!caseSnapshot.exists()) {
								return null;
							}

							return { caseId, caseData: caseSnapshot.val() };
						})
					);

					const householdCases = caseEntries
						.filter(Boolean)
						.filter(({ caseData }) => caseData?.householdId === householdId);

					const allRelevantUserIds = new Set();
					householdCases.forEach((entry) => {
						const caseData = entry.caseData || {};
						if (caseData.filedBy) {
							allRelevantUserIds.add(caseData.filedBy);
						}

						Object.keys(caseData.users || {}).forEach((memberId) => {
							allRelevantUserIds.add(memberId);
						});

						(caseData.defendantIds || []).forEach((defendantId) => {
							allRelevantUserIds.add(defendantId);
						});
					});

					const nameMap = {};
					await Promise.all(
						Array.from(allRelevantUserIds).map(async (memberId) => {
							const userNameSnapshot = await get(ref(rtdb, `users/${memberId}/name`));
							nameMap[memberId] = userNameSnapshot.exists()
								? userNameSnapshot.val()
								: `User ${memberId.slice(0, 6)}`;
						})
					);

					const resolvedCases = await Promise.all(
						householdCases.map(async ({ caseId, caseData }) => {
							const votesSnapshot = await get(ref(rtdb, `caseVotes/${caseId}`));
							const votesByUid = votesSnapshot.exists() ? votesSnapshot.val() : {};
							const resolvedVerdict = resolveVerdict(caseData, votesByUid);

							const plaintiffName = caseData?.filedBy
								? nameMap[caseData.filedBy] || 'Unknown'
								: 'Unknown';

							const defendantIds = Array.isArray(caseData?.defendantIds)
								? caseData.defendantIds
								: [];
							const defendantNames = defendantIds.length > 0
								? defendantIds.map((defendantId) => nameMap[defendantId] || 'Unknown').join(', ')
								: 'Not specified';

							return {
								id: caseId,
								title: caseData?.title || 'Untitled Case',
								plaintiffName,
								defendantNames,
								verdict: resolvedVerdict,
								createdAt: typeof caseData?.createdAt === 'number' ? caseData.createdAt : 0,
							};
						})
					);

					resolvedCases.sort((left, right) => right.createdAt - left.createdAt);

					if (isMounted) {
						setHouseholdName(householdData?.name || 'Household');
						setCases(resolvedCases);
						setIsAuthorized(true);
					}
				} catch {
					if (isMounted) {
						setError('Unable to load case history right now.');
					}
				} finally {
					if (isMounted) {
						setIsLoading(false);
					}
				}
			};

			loadHistory();
		});

		return () => {
			isMounted = false;
			unsubscribe();
		};
	}, [householdId, navigate, uid]);

	const headerSubtitle = useMemo(() => {
		if (cases.length === 1) {
			return '1 case filed in this household';
		}

		return `${cases.length} cases filed in this household`;
	}, [cases.length]);

	if (isLoading) {
		return (
			<div className="household-history-page">
				<div className="household-history-main">
					<h1>Loading household case history...</h1>
				</div>
			</div>
		);
	}

	if (!isAuthorized || error) {
		return (
			<div className="household-history-page">
				<div className="household-history-main">
					<Link to={`/dashboard/${uid}/household-settings`} className="history-back-link">
						&larr; Back to Household Settings
					</Link>
					<h1>{error || 'Unable to view history.'}</h1>
				</div>
			</div>
		);
	}

	return (
		<div className="household-history-page">
			<div className="household-history-main">
				<Link to={`/dashboard/${uid}/household-settings`} className="history-back-link">
					&larr; Back to Household Settings
				</Link>

				<header className="household-history-header">
					<h1>{householdName} Case History</h1>
					<p>{headerSubtitle}</p>
				</header>

				{cases.length === 0 ? (
					<div className="history-empty-state">
						<p>No previous cases found for this household yet.</p>
					</div>
				) : (
					<ul className="history-list">
						{cases.map((caseItem) => (
							<li key={caseItem.id} className="history-case-card">
								<div className="history-case-top">
									<h2>{caseItem.title}</h2>
									<span className={`history-verdict verdict-${caseItem.verdict}`}>
										{VERDICT_LABELS[caseItem.verdict] || VERDICT_LABELS.pending}
									</span>
								</div>
								<p className="history-meta"><strong>Plaintiff:</strong> {caseItem.plaintiffName}</p>
								<p className="history-meta"><strong>Defendant(s):</strong> {caseItem.defendantNames}</p>
								<p className="history-meta"><strong>Filed:</strong> {formatCreatedAt(caseItem.createdAt)}</p>
								{caseItem.verdict === 'pending' && (
									<Link
										to={`/case/${caseItem.id}/voting`}
										state={{ uid }}
										className="history-vote-btn"
									>
										Go to Voting
									</Link>
								)}
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

export default HouseholdCaseHistory;
