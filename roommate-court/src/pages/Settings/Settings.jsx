import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { onAuthStateChanged, updateEmail, updateProfile } from 'firebase/auth';
import { get, ref, update } from 'firebase/database';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { auth, rtdb, storage } from '../../firebase';
import './Settings.css';

function Settings() {
	const navigate = useNavigate();
	const { uid } = useParams();
	const fileInputRef = useRef(null);

	const [isAuthorized, setIsAuthorized] = useState(false);
	const [isLoading, setIsLoading] = useState(true);

	const [displayName, setDisplayName] = useState('');
	const [username, setUsername] = useState('');
	const [email, setEmail] = useState('');
	const [photoURL, setPhotoURL] = useState('');
	const [photoFile, setPhotoFile] = useState(null);
	const [photoPreview, setPhotoPreview] = useState('');

	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState('');
	const [saveSuccess, setSaveSuccess] = useState(false);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			const loadProfile = async () => {
				if (!user || user.uid !== uid) {
					navigate('/', { replace: true });
					return;
				}

				try {
					const snapshot = await get(ref(rtdb, `users/${uid}`));
					const userData = snapshot.val() || {};

					setDisplayName(userData.name || user.displayName || '');
					setUsername(userData.username || '');
					setEmail(user.email || '');
					setPhotoURL(user.photoURL || userData.photoURL || '');
					setIsAuthorized(true);
				} catch {
					navigate('/', { replace: true });
				} finally {
					setIsLoading(false);
				}
			};

			loadProfile();
		});

		return () => unsubscribe();
	}, [navigate, uid]);

	useEffect(() => {
		if (!saveSuccess) return undefined;
		const id = setTimeout(() => setSaveSuccess(false), 4000);
		return () => clearTimeout(id);
	}, [saveSuccess]);

	const handlePhotoChange = (event) => {
		const file = event.target.files[0];
		if (!file) return;
		setPhotoFile(file);
		setPhotoPreview(URL.createObjectURL(file));
	};

	const handleSave = async (event) => {
		event.preventDefault();
		setSaveError('');
		setSaveSuccess(false);
		setIsSaving(true);

		try {
			const user = auth.currentUser;
			if (!user) throw new Error('Not authenticated.');

			let resolvedPhotoURL = photoURL;

			if (photoFile) {
				const photoRef = storageRef(storage, `profilePhotos/${uid}`);
				await uploadBytes(photoRef, photoFile);
				resolvedPhotoURL = await getDownloadURL(photoRef);
			}

			await updateProfile(user, {
				displayName: displayName.trim(),
				photoURL: resolvedPhotoURL || null,
			});

			if (email.trim() !== user.email) {
				await updateEmail(user, email.trim());
			}

			await update(ref(rtdb, `users/${uid}`), {
				name: displayName.trim(),
				username: username.trim(),
				photoURL: resolvedPhotoURL || null,
			});

			setPhotoURL(resolvedPhotoURL);
			setPhotoFile(null);
			setPhotoPreview('');
			setSaveSuccess(true);
		} catch (error) {
			if (error.code === 'auth/requires-recent-login') {
				setSaveError('Updating your email requires a recent sign-in. Please sign out and sign back in, then try again.');
			} else if (error.code === 'auth/email-already-in-use') {
				setSaveError('That email address is already in use by another account.');
			} else if (error.code === 'auth/invalid-email') {
				setSaveError('Please enter a valid email address.');
			} else {
				setSaveError('Unable to save changes. Please try again.');
			}
		} finally {
			setIsSaving(false);
		}
	};

	if (!isAuthorized || isLoading) return null;

	const avatarSrc = photoPreview || photoURL;

	return (
		<div className="settings-page">
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
					className="top-nav-icon active"
					aria-label="Settings"
					title="Settings"
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<circle cx="12" cy="8" r="4" />
						<path d="M12 14c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z" />
					</svg>
				</Link>
			</nav>

			<div className="settings-main">
				<div className="settings-card">
					<div className="settings-header">
						<Link to={`/dashboard/${uid}`} className="settings-back-link">
							&#8592; Back to Dashboard
						</Link>
						<h1>Settings</h1>
						<p className="settings-subtitle">Manage your profile and account details.</p>
					</div>

					{saveSuccess && (
						<div className="settings-success-banner" role="status" aria-live="polite">
							Profile updated successfully.
						</div>
					)}

					<form onSubmit={handleSave} className="settings-form">
						<div className="settings-photo-section">
							<button
								type="button"
								className="settings-avatar-btn"
								onClick={() => fileInputRef.current?.click()}
								aria-label="Change profile photo"
								title="Change profile photo"
							>
								{avatarSrc ? (
									<img src={avatarSrc} alt="Profile" className="settings-avatar-img" />
								) : (
									<svg className="settings-avatar-placeholder" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
										<circle cx="12" cy="8" r="4" />
										<path d="M12 14c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z" />
									</svg>
								)}
								<div className="settings-avatar-overlay" aria-hidden="true">Change</div>
							</button>
							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								onChange={handlePhotoChange}
								className="settings-photo-input"
								aria-label="Upload profile photo"
							/>
							<p className="settings-photo-hint">Click your photo to upload a new one</p>
						</div>

						<div className="settings-fields">
							<label htmlFor="displayName">Display Name</label>
							<input
								id="displayName"
								type="text"
								value={displayName}
								onChange={(e) => setDisplayName(e.target.value)}
								placeholder="Your display name"
							/>

							<label htmlFor="username">Username</label>
							<input
								id="username"
								type="text"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								placeholder="e.g. roommate_joe"
							/>

							<label htmlFor="email">Email</label>
							<input
								id="email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="you@example.com"
								required
							/>
						</div>

						{saveError && <p className="settings-error">{saveError}</p>}

						<button type="submit" className="settings-save-btn" disabled={isSaving}>
							{isSaving ? 'Saving...' : 'Save Changes'}
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}

export default Settings;
