import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { push, ref, serverTimestamp, update } from 'firebase/database';
import { useNavigate, useParams } from 'react-router-dom';
import { auth, rtdb } from '../../firebase';
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
	const normalizedSeverity = severity?.toLowerCase();
	const questions = QUESTION_SETS[normalizedSeverity] || QUESTION_SETS.minor;
	const severityMeta = SEVERITY_META[normalizedSeverity] || SEVERITY_META.minor;
	const [answers, setAnswers] = useState(() => buildInitialAnswers(questions));
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

	const handleSubmit = async (event) => {
		event.preventDefault();
		setError('');

		const hasEmptyAnswer = Object.values(answers).some(
			({ answer }) => answer.trim().length === 0
		);

		if (hasEmptyAnswer) {
			setError('Please answer every question before continuing.');
			return;
		}

		setIsSubmitting(true);

		try {
			const caseId = push(ref(rtdb, 'cases')).key;

			if (!caseId) {
				throw new Error('Unable to generate case id');
			}

			const titleAnswer = answers.question_1?.answer?.trim() || 'Untitled Case';
			const caseSubmissionPayload = questions.reduce((payload, question, index) => {
				const questionKey = `q${index + 1}`;
				const answerKey = `question_${index + 1}`;

				payload[questionKey] = {
					question,
					answer: answers[answerKey]?.answer?.trim() || ''
				};

				return payload;
			}, {});

			const updates = {
				[`cases/${caseId}`]: {
					title: titleAnswer,
					users: {
						[uid]: true
					},
					householdId: null,
					verdict: 'pending',
					severity: normalizedSeverity,
					createdAt: serverTimestamp()
				},
				[`caseSubmissions/${caseId}`]: caseSubmissionPayload,
				[`users/${uid}/cases/${caseId}`]: true
			};

			await update(ref(rtdb), updates);

			navigate(`/dashboard/${uid}`, {
				replace: true,
				state: { createdCaseId: caseId }
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
					{questions.map((question, index) => {
						const key = `question_${index + 1}`;

						return (
							<label className="case-question-card" htmlFor={key} key={key}>
								<span className="case-question-number">Question {index + 1}</span>
								<span className="case-question-prompt">{question}</span>
								<textarea
									id={key}
									value={answers[key]?.answer || ''}
									onChange={(event) => handleChange(key, event.target.value)}
									placeholder="Type your answer here"
									rows={4}
									required
								/>
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
							disabled={isSubmitting}
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
