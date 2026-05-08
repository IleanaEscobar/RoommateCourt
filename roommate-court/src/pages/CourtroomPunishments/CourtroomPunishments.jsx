import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { get, ref, set } from 'firebase/database';
import { auth, rtdb } from '../../firebase';
import './CourtroomPunishments.css';

const SEVERITIES = [
	{ key: 'minor',    label: 'Minor',    hint: 'Light consequences for small offences.' },
	{ key: 'moderate', label: 'Moderate', hint: 'Meaningful consequences for recurring issues.' },
	{ key: 'severe',   label: 'Severe',   hint: 'Serious consequences for major violations.' },
];

function CourtroomPunishments() {
	const navigate = useNavigate();
	const { uid, householdId } = useParams();

	const [isAuthorized, setIsAuthorized] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [householdName, setHouseholdName] = useState('');

	// punishments: { minor: string[], moderate: string[], severe: string[] }
	const [punishments, setPunishments] = useState({ minor: [], moderate: [], severe: [] });
	const [inputs, setInputs] = useState({ minor: '', moderate: '', severe: '' });

	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState('');
	const [saveSuccess, setSaveSuccess] = useState(false);

	const inputRefs = {
		minor: useRef(null),
		moderate: useRef(null),
		severe: useRef(null),
	};

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			const load = async () => {
				if (!user || user.uid !== uid) {
					navigate('/', { replace: true });
					return;
				}

				try {
					// Verify the user is a member of this household
					const memberSnap = await get(ref(rtdb, `households/${householdId}/members/${uid}`));
					if (!memberSnap.exists()) {
						navigate(`/dashboard/${uid}/household-settings`, { replace: true });
						return;
					}

					const [householdSnap, punishmentsSnap] = await Promise.all([
						get(ref(rtdb, `households/${householdId}/name`)),
						get(ref(rtdb, `households/${householdId}/punishments`)),
					]);

					setHouseholdName(householdSnap.exists() ? householdSnap.val() : '');

					if (punishmentsSnap.exists()) {
						const data = punishmentsSnap.val();
						setPunishments({
							minor:    Array.isArray(data.minor)    ? data.minor    : [],
							moderate: Array.isArray(data.moderate) ? data.moderate : [],
							severe:   Array.isArray(data.severe)   ? data.severe   : [],
						});
					}

					setIsAuthorized(true);
				} catch {
					navigate('/', { replace: true });
				} finally {
					setIsLoading(false);
				}
			};

			load();
		});

		return () => unsubscribe();
	}, [navigate, uid, householdId]);

	useEffect(() => {
		if (!saveSuccess) return undefined;
		const id = setTimeout(() => setSaveSuccess(false), 4000);
		return () => clearTimeout(id);
	}, [saveSuccess]);

	const handleAdd = (severity) => {
		const text = inputs[severity].trim();
		if (!text) return;
		setPunishments((prev) => ({
			...prev,
			[severity]: [...prev[severity], text],
		}));
		setInputs((prev) => ({ ...prev, [severity]: '' }));
		inputRefs[severity].current?.focus();
	};

	const handleInputKeyDown = (e, severity) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleAdd(severity);
		}
	};

	const handleRemove = (severity, index) => {
		setPunishments((prev) => ({
			...prev,
			[severity]: prev[severity].filter((_, i) => i !== index),
		}));
	};

	const handleSave = async () => {
		setSaveError('');
		setSaveSuccess(false);
		setIsSaving(true);

		try {
			await set(ref(rtdb, `households/${householdId}/punishments`), {
				minor:    punishments.minor,
				moderate: punishments.moderate,
				severe:   punishments.severe,
			});
			setSaveSuccess(true);
		} catch {
			setSaveError('Unable to save punishments. Please try again.');
		} finally {
			setIsSaving(false);
		}
	};

	if (!isAuthorized || isLoading) return null;

	return (
		<div className="cp-page">
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

			<div className="cp-main">
				<div className="cp-header">
					<Link to={`/dashboard/${uid}/household-settings`} className="cp-back-link">
						&#8592; Back to Household Settings
					</Link>
					<h1>Courtroom Punishments</h1>
					{householdName && (
						<p className="cp-subtitle">{householdName} &mdash; shared with all members.</p>
					)}
				</div>

				{saveSuccess && (
					<div className="cp-success-banner" role="status" aria-live="polite">
						Punishments saved successfully.
					</div>
				)}

				<div className="cp-sections">
					{SEVERITIES.map(({ key, label, hint }) => (
						<div key={key} className={`cp-section cp-section--${key}`}>
							<div className="cp-section-header">
								<h2 className="cp-section-title">{label}</h2>
								<p className="cp-section-hint">{hint}</p>
							</div>

							<ul className="cp-list">
								{punishments[key].length === 0 && (
									<li className="cp-list-empty">No punishments added yet.</li>
								)}
								{punishments[key].map((text, index) => (
									<li key={index} className="cp-list-item">
										<span className="cp-list-item-text">{text}</span>
										<button
											type="button"
											className="cp-remove-btn"
											onClick={() => handleRemove(key, index)}
											aria-label={`Remove "${text}"`}
										>
											&times;
										</button>
									</li>
								))}
							</ul>

							<div className="cp-add-row">
								<input
									ref={inputRefs[key]}
									type="text"
									className="cp-add-input"
									placeholder={`Add a ${label.toLowerCase()} punishment…`}
									value={inputs[key]}
									onChange={(e) => setInputs((prev) => ({ ...prev, [key]: e.target.value }))}
									onKeyDown={(e) => handleInputKeyDown(e, key)}
								/>
								<button
									type="button"
									className="cp-add-btn"
									onClick={() => handleAdd(key)}
									disabled={!inputs[key].trim()}
								>
									Add
								</button>
							</div>
						</div>
					))}
				</div>

				{saveError && <p className="cp-error">{saveError}</p>}

				<button
					type="button"
					className="cp-save-btn"
					onClick={handleSave}
					disabled={isSaving}
				>
					{isSaving ? 'Saving...' : 'Save Punishments'}
				</button>
			</div>
		</div>
	);
}

export default CourtroomPunishments;
