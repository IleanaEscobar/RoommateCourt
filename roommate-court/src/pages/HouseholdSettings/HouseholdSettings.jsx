import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { get, ref, update } from 'firebase/database';
import { auth, rtdb } from '../../firebase';
import './HouseholdSettings.css';

function HouseholdSettings() {
	const navigate = useNavigate();
	const { uid } = useParams();

	const [isAuthorized, setIsAuthorized] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [households, setHouseholds] = useState([]);
	const [showJoinForm, setShowJoinForm] = useState(false);
	const [joinCode, setJoinCode] = useState('');
	const [joinError, setJoinError] = useState('');
	const [joinSuccess, setJoinSuccess] = useState('');
	const [isJoining, setIsJoining] = useState(false);

	const hydrateHousehold = async (householdId) => {
		const snap = await get(ref(rtdb, `households/${householdId}`));
		if (!snap.exists()) return null;

		const data = snap.val();
		const memberIds = Object.keys(data.members || {});

		const members = await Promise.all(
			memberIds.map(async (memberId) => {
				const memberSnap = await get(ref(rtdb, `users/${memberId}/name`));
				return {
					id: memberId,
					name: memberSnap.exists() ? memberSnap.val() : memberId,
				};
			})
		);

		return {
			id: householdId,
			name: data.name || '',
			sentencingSeverity: data.sentencingSeverity || 'moderate',
			code: data.code || '',
			members,
			isSaving: false,
			saveError: '',
			saveSuccess: false,
		};
	};

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			const loadHouseholds = async () => {
				if (!user || user.uid !== uid) {
					navigate('/', { replace: true });
					return;
				}

				try {
					const userSnapshot = await get(ref(rtdb, `users/${uid}/households`));
					const householdIds = userSnapshot.exists()
						? Object.keys(userSnapshot.val())
						: [];

					const loaded = await Promise.all(
						householdIds.map((householdId) => hydrateHousehold(householdId))
					);

					setHouseholds(loaded.filter(Boolean));
					setIsAuthorized(true);
				} catch (error) {
					console.log('Failed to load households', error);
					navigate('/', { replace: true });
				} finally {
					setIsLoading(false);
				}
			};

			loadHouseholds();
		});

		return () => unsubscribe();
	}, [navigate, uid]);

	const updateHousehold = (householdId, fields) => {
		setHouseholds((prev) =>
			prev.map((h) => (h.id === householdId ? { ...h, ...fields } : h))
		);
	};

	const handleSave = async (event, household) => {
		event.preventDefault();
		updateHousehold(household.id, { isSaving: true, saveError: '', saveSuccess: false });

		try {
			await update(ref(rtdb, `households/${household.id}`), {
				name: household.name.trim(),
				sentencingSeverity: household.sentencingSeverity,
			});

			updateHousehold(household.id, { isSaving: false, saveSuccess: true });

			setTimeout(() => {
				updateHousehold(household.id, { saveSuccess: false });
			}, 4000);
		} catch {
			updateHousehold(household.id, {
				isSaving: false,
				saveError: 'Unable to save changes. Please try again.',
			});
		}
	};

	const handleCopyCode = (code) => {
		navigator.clipboard.writeText(code).catch(() => {});
	};

	const handleJoinHouseholdByCode = async (event) => {
		event.preventDefault();
		setJoinError('');
		setJoinSuccess('');

		const normalizedCode = joinCode.trim().toUpperCase();
		if (!normalizedCode) {
			setJoinError('Please enter a household code.');
			return;
		}

		setIsJoining(true);

		try {
			const codeSnapshot = await get(ref(rtdb, `householdCodes/${normalizedCode}`));

			if (!codeSnapshot.exists()) {
				setJoinError('Household code not found. Please check and try again.');
				return;
			}

			const householdId = codeSnapshot.val();
			const existingMembershipSnapshot = await get(ref(rtdb, `households/${householdId}/members/${uid}`));

			if (existingMembershipSnapshot.exists()) {
				setJoinError('You are already a member of this household.');
				return;
			}

			await update(ref(rtdb), {
				[`households/${householdId}/members/${uid}`]: true,
				[`users/${uid}/households/${householdId}`]: true
			});

			const joinedHousehold = await hydrateHousehold(householdId);

			if (joinedHousehold) {
				setHouseholds((prev) => {
					if (prev.some((household) => household.id === householdId)) {
						return prev;
					}

					return [...prev, joinedHousehold];
				});
			}

			setJoinSuccess('Joined household successfully.');
			setJoinCode('');
			setShowJoinForm(false);
		} catch {
			setJoinError('Unable to join household. Please try again.');
		} finally {
			setIsJoining(false);
		}
	};

	if (!isAuthorized || isLoading) return null;

	return (
		<div className="hs-page">
			<nav className="top-nav">
				<Link
					to={`/dashboard/${uid}/household-settings`}
					className="top-nav-icon active"
					aria-label="Household Settings"
					title="Household Settings"
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
					</svg>
				</Link>
				<Link
					to={`/dashboard/${uid}/settings`}
					className="top-nav-icon"
					aria-label="Settings"
					title="Settings"
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<circle cx="12" cy="8" r="4" />
						<path d="M12 14c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z" />
					</svg>
				</Link>
			</nav>

			<div className="hs-main">
				<div className="hs-header">
					<Link to={`/dashboard/${uid}`} className="hs-back-link">
						&#8592; Back to Dashboard
					</Link>
					<h1>Household Settings</h1>
					<p className="hs-subtitle">Changes apply to all members of the household.</p>
					<div className="hs-join-controls">
						<button
							type="button"
							className="hs-join-toggle-btn"
							onClick={() => {
								setShowJoinForm((prev) => !prev);
								setJoinError('');
								setJoinSuccess('');
							}}
						>
							Join Household by Code
						</button>
					</div>

					{showJoinForm && (
						<form className="hs-join-form" onSubmit={handleJoinHouseholdByCode}>
							<label htmlFor="hsJoinCode">Household Code</label>
							<input
								id="hsJoinCode"
								type="text"
								value={joinCode}
								onChange={(event) => setJoinCode(event.target.value)}
								placeholder="e.g. ABC123"
								maxLength={6}
								autoCapitalize="characters"
								required
							/>

							{joinError && <p className="hs-error">{joinError}</p>}
							{joinSuccess && <p className="hs-join-success">{joinSuccess}</p>}

							<button type="submit" className="hs-join-submit" disabled={isJoining}>
								{isJoining ? 'Joining...' : 'Join'}
							</button>
						</form>
					)}
				</div>

				{households.length === 0 && (
					<div className="hs-empty">
						<p>You are not part of any household yet.</p>
						<Link to={`/dashboard/${uid}`} className="hs-back-link">
							Go to Dashboard to create or join one.
						</Link>
					</div>
				)}

				{households.map((household) => (
					<div key={household.id} className="hs-card">
						{household.saveSuccess && (
							<div className="hs-success-banner" role="status" aria-live="polite">
								Household updated successfully.
							</div>
						)}

						<form onSubmit={(e) => handleSave(e, household)} className="hs-form">
							<div className="hs-section">
								<h2 className="hs-section-title">General</h2>

								<label htmlFor={`name-${household.id}`}>Household Name</label>
								<input
									id={`name-${household.id}`}
									type="text"
									value={household.name}
									onChange={(e) => updateHousehold(household.id, { name: e.target.value })}
									placeholder="e.g. Escobar Household"
									required
								/>

								<label htmlFor={`severity-${household.id}`}>Sentencing Severity</label>
								<select
									id={`severity-${household.id}`}
									value={household.sentencingSeverity}
									onChange={(e) => updateHousehold(household.id, { sentencingSeverity: e.target.value })}
								>
									<option value="mild">Mild</option>
									<option value="moderate">Moderate</option>
									<option value="severe">Severe</option>
								</select>
							</div>

							<div className="hs-section">
								<h2 className="hs-section-title">Invite Code</h2>
								<div className="hs-code-row">
									<span className="hs-code">{household.code}</span>
									<button
										type="button"
										className="hs-copy-btn"
										onClick={() => handleCopyCode(household.code)}
									>
										Copy
									</button>
								</div>
								<p className="hs-code-hint">Share this code with roommates to let them join.</p>
							</div>

							<div className="hs-section">
								<h2 className="hs-section-title">Members</h2>
								<ul className="hs-members-list">
									{household.members.map((member) => (
										<li key={member.id} className="hs-member-item">
											<div className="hs-member-avatar" aria-hidden="true">
												{member.name.charAt(0).toUpperCase()}
											</div>
											<span>{member.name}</span>
											{member.id === uid && (
												<span className="hs-member-you">You</span>
											)}
										</li>
									))}
								</ul>
							</div>

							{household.saveError && (
								<p className="hs-error">{household.saveError}</p>
							)}

							<button type="submit" className="hs-save-btn" disabled={household.isSaving}>
								{household.isSaving ? 'Saving...' : 'Save Changes'}
							</button>
						</form>

						<Link
							to={`/dashboard/${uid}/household/${household.id}/punishments`}
							className="hs-punishments-btn"
						>
							Edit Courtroom Punishments
						</Link>
					</div>
				))}
			</div>
		</div>
	);
}

export default HouseholdSettings;
