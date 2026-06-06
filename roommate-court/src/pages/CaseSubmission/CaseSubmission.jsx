{/* might be some issues with submission here */}
import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { get, push, ref, serverTimestamp, update } from 'firebase/database';
import { addDoc, collection, getFirestore, serverTimestamp as firestoreServerTimestamp } from 'firebase/firestore';
import { useNavigate, useParams } from 'react-router-dom';
import { app, auth, rtdb } from '../../firebase';
import './CaseSubmission.css';

const QUESTION_SETS = {
	minor: [
		'What is the title of this roommate issue?',
		'Who is involved in the disagreement?',
		'What happened?',
		'When did the problem start?',
		'How has this affected the home?',
		'What outcome would feel fair to you?'
	],
	moderate: [
		'What is the title of this roommate issue?',
		'Who is involved in the disagreement?',
		'What happened?',
		'When did the issue first appear?',
		'How often is this happening?',
		'What steps have already been taken to resolve it?',
		'What house expectations or agreements are connected to this?',
		'What outcome are you requesting?'
	],
	severe: [
		'What is the title of this roommate issue?',
		'Who is involved in the disagreement?',
		'Describe the full situation in detail.',
		'When did the issue begin?',
		'How often has this happened?',
		'What impact has this had on safety, finances, or wellbeing?',
		'Have any boundaries or house rules been violated?',
		'What evidence or examples support your claim?',
		'What attempts have been made to resolve the issue already?',
		'What action or resolution are you asking for now?'
	]
};

const SEVERITY_META = {
	minor: {
		label: 'Minor Case',
		description: 'A short filing for smaller conflicts that still need a clear record.'
	},
	moderate: {
		label: 'Moderate Case',
		description: 'A more detailed filing for repeated issues or unresolved tension.'
	},
	severe: {
		label: 'Severe Case',
		description: 'A full intake form for major disputes where context and impact matter.'
	}
};

function buildInitialAnswers(questions) {
	return questions.reduce((answers, question, index) => {
		answers[`question_${index + 1}`] = {
			prompt: question,
			answer: ''
		};

		return answers;
	}, {});
}

function CaseSubmission() {
	const navigate = useNavigate();
	const { severity, uid } = useParams();
	const firestore = getFirestore(app);
	const normalizedSeverity = severity?.toLowerCase();
	const questions = QUESTION_SETS[normalizedSeverity] || QUESTION_SETS.minor;
	const severityMeta = SEVERITY_META[normalizedSeverity] || SEVERITY_META.minor;
	const [answers, setAnswers] = useState(() => buildInitialAnswers(questions));
	const [households, setHouseholds] = useState([]);
	const [selectedHouseholdId, setSelectedHouseholdId] = useState('');
	const [householdMembers, setHouseholdMembers] = useState([]);
	const [selectedDefendantIds, setSelectedDefendantIds] = useState([]);
	const [isLoadingMembers, setIsLoadingMembers] = useState(false);
	const [isLoadingHouseholds, setIsLoadingHouseholds] = useState(true);
	const [error, setError] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isAuthorized, setIsAuthorized] = useState(false);

	useEffect(() => {
		setAnswers(buildInitialAnswers(questions));
	}, [questions]);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			if (!user || user.uid !== uid) {
				navigate('/', { replace: true });
				return;
			}

			if (!QUESTION_SETS[normalizedSeverity]) {
				navigate(`/dashboard/${uid}`, { replace: true });
				return;
			}

			setIsAuthorized(true);
		});

		return () => unsubscribe();
	}, [navigate, normalizedSeverity, uid]);

	useEffect(() => {
		if (!isAuthorized) {
			return undefined;
		}

		let isMounted = true;

		const loadHouseholds = async () => {
			setIsLoadingHouseholds(true);

			try {
				const userHouseholdsSnapshot = await get(ref(rtdb, `users/${uid}/households`));
				const householdIds = userHouseholdsSnapshot.exists()
					? Object.keys(userHouseholdsSnapshot.val())
					: [];

				const loadedHouseholds = await Promise.all(
					householdIds.map(async (householdId) => {
						const householdSnapshot = await get(ref(rtdb, `households/${householdId}`));

						if (!householdSnapshot.exists()) {
							return null;
						}

						const householdData = householdSnapshot.val();
						const isMember = Boolean(householdData.members?.[uid]);

						if (!isMember) {
							return null;
						}

						return {
							id: householdId,
							name: householdData.name?.trim() || `Household ${householdId.slice(0, 6)}`
						};
					})
				);

				const validHouseholds = loadedHouseholds
					.filter(Boolean)
					.sort((a, b) => a.name.localeCompare(b.name));

				if (!isMounted) {
					return;
				}

				setHouseholds(validHouseholds);
				setSelectedHouseholdId((currentSelection) => {
					if (currentSelection && validHouseholds.some((household) => household.id === currentSelection)) {
						return currentSelection;
					}

					if (validHouseholds.length === 1) {
						return validHouseholds[0].id;
					}

					return '';
				});
			} catch {
				if (isMounted) {
					setError('Unable to load your households right now. Please refresh and try again.');
				}
			} finally {
				if (isMounted) {
					setIsLoadingHouseholds(false);
				}
			}
		};

		loadHouseholds();

		return () => {
			isMounted = false;
		};
	}, [isAuthorized, uid]);

	useEffect(() => {
		if (!selectedHouseholdId) {
			setHouseholdMembers([]);
			setSelectedDefendantIds([]);
			return;
		}

		let isMounted = true;

		const loadHouseholdMembers = async () => {
			setIsLoadingMembers(true);

			try {
				const membersSnapshot = await get(ref(rtdb, `households/${selectedHouseholdId}/members`));
				const memberIds = membersSnapshot.exists() ? Object.keys(membersSnapshot.val()) : [];

				const loadedMembers = await Promise.all(
					memberIds.map(async (memberId) => {
						const nameSnapshot = await get(ref(rtdb, `users/${memberId}/name`));
						const resolvedName = nameSnapshot.exists()
							? nameSnapshot.val()
							: `User ${memberId.slice(0, 6)}`;

						return {
							id: memberId,
							name: resolvedName
						};
					})
				);

				const roommates = loadedMembers
					.filter((member) => member.id !== uid)
					.sort((a, b) => a.name.localeCompare(b.name));

				if (!isMounted) {
					return;
				}

				setHouseholdMembers(roommates);
				setSelectedDefendantIds((currentIds) =>
					currentIds.filter((memberId) => roommates.some((roommate) => roommate.id === memberId))
				);
			} catch {
				if (isMounted) {
					setError('Unable to load household roommates right now. Please try again.');
				}
			} finally {
				if (isMounted) {
					setIsLoadingMembers(false);
				}
			}
		};

		loadHouseholdMembers();

		return () => {
			isMounted = false;
		};
	}, [selectedHouseholdId, uid]);

	const handleChange = (key, value) => {
		setAnswers((currentAnswers) => ({
			...currentAnswers,
			[key]: {
				...currentAnswers[key],
				answer: value
			}
		}));
	};

	const handleCancel = () => {
		navigate(`/dashboard/${uid}`);
	};

	const handleDefendantToggle = (memberId) => {
		setSelectedDefendantIds((currentIds) =>
			currentIds.includes(memberId)
				? currentIds.filter((id) => id !== memberId)
				: [...currentIds, memberId]
		);
	};

	const handleSubmit = async (event) => {
		event.preventDefault();
		setError('');

		if (isLoadingHouseholds) {
			setError('Your households are still loading. Please wait a moment.');
			return;
		}

		if (!selectedHouseholdId) {
			setError('Please select a household for this case.');
			return;
		}

		if (selectedDefendantIds.length === 0) {
			setError('Please select at least one roommate involved in the disagreement.');
			return;
		}

		const selectedHousehold = households.find((household) => household.id === selectedHouseholdId);

		if (!selectedHousehold) {
			setError('Please choose a valid household that you are a member of.');
			return;
		}

		const hasEmptyAnswer = Object.entries(answers).some(
			([answerKey, { answer }]) => answerKey !== 'question_2' && answer.trim().length === 0
		);

		if (hasEmptyAnswer) {
			setError('Please answer every question before continuing.');
			return;
		}

		setIsSubmitting(true);

		try {
			const householdSnapshot = await get(ref(rtdb, `households/${selectedHousehold.id}`));

			if (!householdSnapshot.exists()) {
				setError('Selected household no longer exists. Please choose another household.');
				setIsSubmitting(false);
				return;
			}

			const householdData = householdSnapshot.val();
			const isMember = Boolean(householdData.members?.[uid]);

			if (!isMember) {
				setError('You can only file a case for a household that you are a member of.');
				setIsSubmitting(false);
				return;
			}

			const caseUsers = Object.keys(householdData.members || {}).reduce((usersMap, memberId) => {
				usersMap[memberId] = true;
				return usersMap;
			}, {});

			if (!caseUsers[uid]) {
				caseUsers[uid] = true;
			}

			const validDefendantIds = selectedDefendantIds.filter((memberId) => Boolean(householdData.members?.[memberId]));

			if (validDefendantIds.length === 0) {
				setError('Please select at least one valid defendant from your household.');
				setIsSubmitting(false);
				return;
			}

			const defendantNames = householdMembers
				.filter((member) => validDefendantIds.includes(member.id))
				.map((member) => member.name)
				.join(', ');

			const caseId = push(ref(rtdb, 'cases')).key;

			if (!caseId) {
				throw new Error('Unable to generate case id');
			}

			const titleAnswer = answers.question_1?.answer?.trim() || 'Untitled Case';
			const filerNameSnapshot = await get(ref(rtdb, `users/${uid}/name`));
			const accuserName = filerNameSnapshot.exists() ? filerNameSnapshot.val() : 'A roommate';
			const caseSubmissionPayload = questions.reduce((payload, question, index) => {
				const questionKey = `q${index + 1}`;
				const answerKey = `question_${index + 1}`;
				const isInvolvedQuestion = answerKey === 'question_2';

				payload[questionKey] = {
					question,
					answer: isInvolvedQuestion
						? defendantNames
						: answers[answerKey]?.answer?.trim() || ''
				};

				return payload;
			}, {});

			const updates = {
				[`cases/${caseId}`]: {
					title: titleAnswer,
					users: caseUsers,
					householdId: selectedHousehold.id,
					filedBy: uid,
					defendantIds: validDefendantIds,
					verdict: 'pending',
					severity: normalizedSeverity,
					createdAt: serverTimestamp()
				},
				[`caseSubmissions/${caseId}`]: caseSubmissionPayload,
				[`users/${uid}/cases/${caseId}`]: true,
				[`households/${selectedHousehold.id}/cases/${caseId}`]: true
			};

			await update(ref(rtdb), updates);

			const notifiedMemberIds = Object.keys(caseUsers).filter((memberId) => memberId !== uid);
			void Promise.allSettled(
				notifiedMemberIds.map((memberId) =>
					addDoc(collection(firestore, 'notifications'), {
						recipientId: memberId,
						type: 'case_filed',
						caseTitle: titleAnswer,
						accuserName,
						caseId,
						targetPath: `/case/${caseId}/waiting`,
						read: false,
						createdAt: firestoreServerTimestamp()
					})
				)
			);

			navigate(`/case/${caseId}/review`, {
				state: { justSubmitted: true, uid }
			});
		} catch (firebaseError) {
			setError('Unable to submit the case right now. Please try again.');
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!isAuthorized) {
		return null;
	}

	return (
		<div className="case-submission-page">
			<div className="case-submission-shell">
				<p className="case-severity-pill">{severityMeta.label}</p>

				<div className="case-submission-header">
					<h1>Submit a new roommate case</h1>
					<p>{severityMeta.description}</p>
				</div>

				<form className="case-submission-form" onSubmit={handleSubmit}>
					<label className="case-question-card" htmlFor="householdSelection">
						<span className="case-question-number">Household</span>
						<span className="case-question-prompt">Which household is this case for?</span>
						<select
							id="householdSelection"
							className="case-household-select"
							value={selectedHouseholdId}
							onChange={(event) => setSelectedHouseholdId(event.target.value)}
							disabled={isLoadingHouseholds || households.length === 0 || isSubmitting}
							required
						>
							<option value="" disabled>
								{isLoadingHouseholds ? 'Loading households...' : 'Select your household'}
							</option>
							{households.map((household) => (
								<option key={household.id} value={household.id}>
									{household.name}
								</option>
							))}
						</select>
						{!isLoadingHouseholds && households.length === 0 && (
							<span className="case-helper-text">
								You are not in any households yet. Join or create a household before filing a case.
							</span>
						)}
					</label>

					{questions.map((question, index) => {
						const key = `question_${index + 1}`;
						const isInvolvedQuestion = key === 'question_2';

						return (
							<label className="case-question-card" htmlFor={key} key={key}>
								<span className="case-question-number">Question {index + 1}</span>
								<span className="case-question-prompt">{question}</span>
								{isInvolvedQuestion ? (
									<div className="case-roommates-picker" id={key}>
										{isLoadingMembers ? (
											<p className="case-helper-text">Loading roommates...</p>
										) : householdMembers.length === 0 ? (
											<p className="case-helper-text">
												No other roommates found in this household yet.
											</p>
										) : (
											householdMembers.map((member) => (
												<label className="case-roommate-option" key={member.id}>
													<input
														type="checkbox"
														checked={selectedDefendantIds.includes(member.id)}
														onChange={() => handleDefendantToggle(member.id)}
														disabled={isSubmitting || isLoadingMembers}
													/>
													<span>{member.name}</span>
												</label>
											))
										)}
									</div>
								) : (
									<textarea
										id={key}
										value={answers[key]?.answer || ''}
										onChange={(event) => handleChange(key, event.target.value)}
										placeholder="Type your answer here"
										rows={4}
										required
									/>
								)}
							</label>
						);
					})}

					{error && <p className="case-submission-error">{error}</p>}

					<div className="case-submission-actions">
						<button
							type="button"
							className="case-action-button case-action-button-secondary"
							onClick={handleCancel}
							disabled={isSubmitting}
						>
							Cancel
						</button>
						<button
							type="submit"
							className="case-action-button case-action-button-primary"
							disabled={isSubmitting || isLoadingHouseholds || households.length === 0}
						>
							{isSubmitting ? 'Submitting...' : 'Continue'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

export default CaseSubmission;
