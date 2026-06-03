import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { get, push, ref, set, update } from 'firebase/database';
import { auth, rtdb } from '../../firebase';
import {
	subscribeToNotifications,
	markNotificationAsRead,
	getUnreadCount,
	formatNotificationMessage,
} from '../../utils/notificationsService';
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
	const [showCreateHouseholdModal, setShowCreateHouseholdModal] = useState(false);
	const [notifications, setNotifications] = useState([]);
	const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
	const unreadCount = getUnreadCount(notifications);

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

	useEffect(() => {
		if (!isAuthorized || !uid) return;
		const unsubscribeNotifications = subscribeToNotifications(uid, setNotifications);
		return () => unsubscribeNotifications();
	}, [isAuthorized, uid]);

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
			setShowCreateHouseholdModal(false);
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

	const handleNotificationClick = async (notification) => {
		await markNotificationAsRead(notification.id);

		if (notification.targetPath) {
			setShowNotificationDropdown(false);
			navigate(notification.targetPath, { state: { uid } });
		}
	};

	if (!isAuthorized || isLoadingProfile) {
		return null;
	}

	const shouldShowHouseholdModal = mustCreateHousehold || showCreateHouseholdModal;
	const showJoinTab = mustCreateHousehold;

	return (
		<div className="dashboard-page">
			<div className="notification-bell-container">
				<button
					className="notification-bell"
					onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
					aria-label="Notifications"
				>
					🔔
					{unreadCount > 0 && (
						<span className="notification-badge">{unreadCount}</span>
					)}
				</button>

				{showNotificationDropdown && (
					<div className="notification-dropdown">
						<div className="notification-dropdown-header">
							<h3>Notifications</h3>
							<button
								className="close-dropdown"
								onClick={() => setShowNotificationDropdown(false)}
								aria-label="Close notifications"
							>
								✕
							</button>
						</div>
						<div className="notification-dropdown-content">
							{notifications.length === 0 ? (
								<div className="no-notifications">
									<p>No notifications yet</p>
								</div>
							) : (
								<ul className="notifications-list">
									{notifications.map((notification) => {
										const { title, description, icon } =
											formatNotificationMessage(notification);
										return (
											<li
												key={notification.id}
												className={`notification-item ${notification.read ? 'read' : 'unread'}`}
												onClick={() => handleNotificationClick(notification)}
												onKeyDown={(event) => {
													if (event.key === 'Enter' || event.key === ' ') {
														event.preventDefault();
														handleNotificationClick(notification);
													}
												}}
												role="button"
												tabIndex={0}
											>
												<div className="notification-icon">{icon}</div>
												<div className="notification-content">
													<h4>{title}</h4>
													<p>{description}</p>
													{notification.targetPath && (
														<small className="notification-link-hint">Open waiting room</small>
													)}
													<small className="notification-time">
														{notification.createdAt &&
															new Date(
																notification.createdAt.toDate
																	? notification.createdAt.toDate()
																	: notification.createdAt
															).toLocaleString()}
													</small>
												</div>
											</li>
										);
									})}
								</ul>
							)}
						</div>
					</div>
				)}
			</div>

			<nav className="top-nav">
				<Link
					to={`/dashboard/${uid}/household-settings`}
					className="top-nav-icon"
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
			{shouldShowHouseholdModal && (
				<div className="household-modal-overlay" role="dialog" aria-modal="true">
					<div className="household-modal-card">
						{!mustCreateHousehold && (
							<button
								type="button"
								className="household-modal-close"
								onClick={() => {
									setShowCreateHouseholdModal(false);
									setHouseholdError('');
								}}
								aria-label="Close create household modal"
							>
								x
							</button>
						)}
						<h2>{mustCreateHousehold ? 'Set up your household' : 'Create a household'}</h2>
						<p>
							{mustCreateHousehold
								? 'Create a new household or join an existing one with a code.'
								: 'Choose the sentencing severity for your household.'
							}
						</p>
						{showJoinTab && (
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
						)}

						{(!showJoinTab || modalTab === 'create') && (
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
			<div className="dashboard-main">
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
					<button
						type="button"
						className="dashboard-case-button dashboard-create-household-btn"
						onClick={() => {
							setModalTab('create');
							setHouseholdError('');
							setJoinError('');
							setHouseholdName('');
							setShowCreateHouseholdModal(true);
						}}
					>
						Create Household
					</button>
				</div>

				<div className="dashboard-divider" />
				<Link to="/" className="dashboard-signout-btn">Sign Out</Link>
			</div>
			</div>
		</div>
	);
}

export default Dashboard;
