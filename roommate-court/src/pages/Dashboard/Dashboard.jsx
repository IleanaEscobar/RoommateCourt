import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { get, push, ref, set, update } from 'firebase/database';
import { auth, rtdb } from '../../firebase';
import './Dashboard.css';

function deriveDisplayName(emailValue) {
	const localPart = emailValue.split('@')[0] || 'Roommate';
	if (!localPart) {
		return 'Roommate';
	}

	return localPart.charAt(0).toUpperCase() + localPart.slice(1);
}

function Dashboard() {
	const navigate = useNavigate();
	const { uid } = useParams();
	const [isAuthorized, setIsAuthorized] = useState(false);
	const [mustCreateHousehold, setMustCreateHousehold] = useState(false);
	const [showHouseholdSuccess, setShowHouseholdSuccess] = useState(false);
	const [householdName, setHouseholdName] = useState('');
	const [sentencingSeverity, setSentencingSeverity] = useState('moderate');
	const [householdError, setHouseholdError] = useState('');
	const [isSavingHousehold, setIsSavingHousehold] = useState(false);
	const [isLoadingProfile, setIsLoadingProfile] = useState(true);
	const [modalTab, setModalTab] = useState('create');
	const [joinCode, setJoinCode] = useState('');
	const [joinError, setJoinError] = useState('');
	const [isSavingJoin, setIsSavingJoin] = useState(false);
	const [createdHouseholdCode, setCreatedHouseholdCode] = useState('');

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			const loadUserState = async () => {
			if (!user || user.uid !== uid) {
				navigate('/', { replace: true });
				return;
			}

			try {
				const userRef = ref(rtdb, `users/${uid}`);
				const userSnapshot = await get(userRef);

				if (!userSnapshot.exists()) {
					await set(userRef, {
						name: user.displayName || deriveDisplayName(user.email || ''),
						households: {},
						cases: {}
					});
					setMustCreateHousehold(true);
				} else {
					const userData = userSnapshot.val();
					const households = userData.households || {};
					setMustCreateHousehold(Object.keys(households).length === 0);
				}

				setIsAuthorized(true);
			} catch (error) {
				navigate('/', { replace: true });
			} finally {
				setIsLoadingProfile(false);
			}
		};

		loadUserState();
		});

		return () => unsubscribe();
	}, [navigate, uid]);

	useEffect(() => {
		if (!showHouseholdSuccess) {
			return undefined;
		}

		const timeoutId = setTimeout(() => {
			setShowHouseholdSuccess(false);
		}, 4500);

		return () => clearTimeout(timeoutId);
	}, [showHouseholdSuccess]);

	function generateHouseholdCode() {
		const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
		let code = '';
		for (let i = 0; i < 6; i++) {
			code += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return code;
	}

	const handleCreateHousehold = async (event) => {
		event.preventDefault();
		setHouseholdError('');

		if (!householdName.trim()) {
			setHouseholdError('Please provide a household name.');
			return;
		}

		setIsSavingHousehold(true);

		try {
			const householdId = push(ref(rtdb, 'households')).key;

			if (!householdId) {
				throw new Error('Unable to create household id.');
			}

			const code = generateHouseholdCode();

			await update(ref(rtdb), {
				[`households/${householdId}`]: {
					name: householdName.trim(),
					members: { [uid]: true },
					sentencingSeverity,
					code
				},
				[`householdCodes/${code}`]: householdId,
				[`users/${uid}/households/${householdId}`]: true
			});

			setCreatedHouseholdCode(code);
			setMustCreateHousehold(false);
			setShowHouseholdSuccess(true);
			setHouseholdName('');
		} catch (error) {
			setHouseholdError('Unable to create household. Please try again.');
		} finally {
			setIsSavingHousehold(false);
		}
	};

	const handleJoinHousehold = async (event) => {
		event.preventDefault();
		setJoinError('');

		const normalizedCode = joinCode.trim().toUpperCase();

		if (!normalizedCode) {
			setJoinError('Please enter a household code.');
			return;
		}

		setIsSavingJoin(true);

		try {
			const codeSnapshot = await get(ref(rtdb, `householdCodes/${normalizedCode}`));

			if (!codeSnapshot.exists()) {
				setJoinError('Household code not found. Please check and try again.');
				return;
			}

			const householdId = codeSnapshot.val();
			const memberSnapshot = await get(ref(rtdb, `households/${householdId}/members/${uid}`));

			if (memberSnapshot.exists()) {
				setJoinError('You are already a member of this household.');
				return;
			}

			await update(ref(rtdb), {
				[`households/${householdId}/members/${uid}`]: true,
				[`users/${uid}/households/${householdId}`]: true
			});

			setCreatedHouseholdCode('');
			setMustCreateHousehold(false);
			setShowHouseholdSuccess(true);
			setJoinCode('');
		} catch (error) {
			setJoinError('Unable to join household. Please try again.');
		} finally {
			setIsSavingJoin(false);
		}
	};

	if (!isAuthorized || isLoadingProfile) {
		return null;
	}

	return (
		<div className="dashboard-page">
			{mustCreateHousehold && (
				<div className="household-modal-overlay" role="dialog" aria-modal="true">
					<div className="household-modal-card">
						<h2>Set up your household</h2>
						<p>Create a new household or join an existing one with a code.</p>
						<div className="household-modal-tabs">
							<button
								type="button"
								className={`household-modal-tab${modalTab === 'create' ? ' active' : ''}`}
								onClick={() => { setModalTab('create'); setHouseholdError(''); setJoinError(''); }}
							>
								Create
							</button>
							<button
								type="button"
								className={`household-modal-tab${modalTab === 'join' ? ' active' : ''}`}
								onClick={() => { setModalTab('join'); setHouseholdError(''); setJoinError(''); }}
							>
								Join
							</button>
						</div>

						{modalTab === 'create' && (
							<form className="household-modal-form" onSubmit={handleCreateHousehold}>
								<label htmlFor="householdName">Household Name</label>
								<input
									id="householdName"
									type="text"
									value={householdName}
									onChange={(event) => setHouseholdName(event.target.value)}
									placeholder="e.g. Escobar Household"
									required
								/>

								<label htmlFor="sentencingSeverity">Household Sentencing Severity</label>
								<select
									id="sentencingSeverity"
									value={sentencingSeverity}
									onChange={(event) => setSentencingSeverity(event.target.value)}
								>
									<option value="mild">Mild</option>
									<option value="moderate">Moderate</option>
									<option value="severe">Severe</option>
								</select>

								{householdError && <p className="household-modal-error">{householdError}</p>}

								<button type="submit" disabled={isSavingHousehold}>
									{isSavingHousehold ? 'Creating...' : 'Create Household'}
								</button>
							</form>
						)}

						{modalTab === 'join' && (
							<form className="household-modal-form" onSubmit={handleJoinHousehold}>
								<label htmlFor="joinCode">Household Code</label>
								<input
									id="joinCode"
									type="text"
									value={joinCode}
									onChange={(event) => setJoinCode(event.target.value)}
									placeholder="e.g. ABC123"
									maxLength={6}
									autoCapitalize="characters"
									required
								/>

								{joinError && <p className="household-modal-error">{joinError}</p>}

								<button type="submit" disabled={isSavingJoin}>
									{isSavingJoin ? 'Joining...' : 'Join Household'}
								</button>
							</form>
						)}
					</div>
				</div>
			)}
			<div className="dashboard-card">
				{showHouseholdSuccess && (
					<div className="dashboard-success-banner" role="status" aria-live="polite">
						<span>
							{createdHouseholdCode
								? <>Household created! Share this code with your roommates: <strong>{createdHouseholdCode}</strong></>
								: 'You have joined the household successfully.'
							}
						</span>
						<button
							type="button"
							className="dashboard-success-dismiss"
							onClick={() => setShowHouseholdSuccess(false)}
						>
							Dismiss
						</button>
					</div>
				)}
				<h1>Welcome to RoommateCourt!</h1>
				<p className="dashboard-subtitle">Where disputes are resolved fairly and whimsically, one case at a time.</p>
				<div className="dashboard-actions">
					<Link to={`/dashboard/${uid}/case-submission/minor`} className="dashboard-case-button">
						Start Minor Case
					</Link>
					<Link to={`/dashboard/${uid}/case-submission/moderate`} className="dashboard-case-button">
						Start Moderate Case
					</Link>
					<Link to={`/dashboard/${uid}/case-submission/severe`} className="dashboard-case-button">
						Start Severe Case
					</Link>
				</div>
			</div>
		</div>
	);
}

export default Dashboard;
