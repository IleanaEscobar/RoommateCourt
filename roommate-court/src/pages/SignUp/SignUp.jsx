import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { get, ref, set, update } from 'firebase/database';
import { auth, googleProvider, rtdb } from '../../firebase';
import './SignUp.css';

function getAuthErrorMessage(firebaseError) {
	const errorCode = firebaseError?.code || '';

	if (errorCode === 'auth/popup-closed-by-user') {
		return 'Google sign-up was canceled before completion.';
	}

	if (errorCode === 'auth/popup-blocked') {
		return 'Google sign-up popup was blocked by your browser. Please allow popups and try again.';
	}

	if (errorCode === 'auth/account-exists-with-different-credential') {
		return 'An account already exists with this email using a different sign-in method. Try logging in with email/password first.';
	}

	if (errorCode === 'auth/unauthorized-domain') {
		return 'This domain is not authorized for Google sign-in in Firebase settings.';
	}

	return 'Unable to sign up with Google. Please try again.';
}

function deriveDisplayName(emailValue) {
	const localPart = emailValue.split('@')[0] || 'Roommate';
	if (!localPart) {
		return 'Roommate';
	}

	return localPart.charAt(0).toUpperCase() + localPart.slice(1);
}

async function ensureUserProfile(user, fallbackName) {
	const userRef = ref(rtdb, `users/${user.uid}`);
	const existingProfile = await get(userRef);
	const resolvedName = user.displayName || fallbackName || deriveDisplayName(user.email || '');

	if (!existingProfile.exists()) {
		await set(userRef, {
			name: resolvedName,
			households: {},
			cases: {}
		});
		return;
	}

	await update(userRef, {
		name: resolvedName
	});
}

function SignUp() {
	const navigate = useNavigate();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [error, setError] = useState('');
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (event) => {
		event.preventDefault();
		setError('');

		if (password !== confirmPassword) {
			setError('Passwords do not match.');
			return;
		}

		setIsLoading(true);

		try {
			const userCredential = await createUserWithEmailAndPassword(
				auth,
				email.trim(),
				password
			);
			await ensureUserProfile(userCredential.user, deriveDisplayName(email.trim()));
			navigate(`/dashboard/${userCredential.user.uid}`);
		} catch (firebaseError) {
			setError('Unable to create account. Please try again.');
		} finally {
			setIsLoading(false);
		}
	};

	const handleGoogleSignUp = async () => {
		setError('');

		setIsLoading(true);

		try {
			const result = await signInWithPopup(auth, googleProvider);
			try {
				await ensureUserProfile(result.user, result.user.displayName || 'Roommate');
			} catch (profileError) {
				console.error('Google sign-up profile sync failed:', profileError);
			}
			navigate(`/dashboard/${result.user.uid}`);
		} catch (firebaseError) {
			setError(getAuthErrorMessage(firebaseError));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="signup-page">
			<div className="signup-card">
				<h1>Create Account</h1>
				<p>Join Roommate Court</p>

				<form onSubmit={handleSubmit} className="signup-form">
					<label htmlFor="email">Email</label>
					<input
						id="email"
						type="email"
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						placeholder="you@example.com"
						required
					/>

					<label htmlFor="password">Password</label>
					<input
						id="password"
						type="password"
						value={password}
						onChange={(event) => setPassword(event.target.value)}
						placeholder="At least 6 characters"
						required
					/>

					<label htmlFor="confirmPassword">Confirm Password</label>
					<input
						id="confirmPassword"
						type="password"
						value={confirmPassword}
						onChange={(event) => setConfirmPassword(event.target.value)}
						placeholder="Re-enter your password"
						required
					/>

					{error && <p className="signup-error">{error}</p>}

					<button type="submit" disabled={isLoading}>
						{isLoading ? 'Creating account...' : 'Sign Up'}
					</button>

					<button
						type="button"
						className="google-signup-button"
						onClick={handleGoogleSignUp}
						disabled={isLoading}
					>
						{isLoading ? 'Please wait...' : 'Sign up with Google'}
					</button>
				</form>

				<p className="login-link-text">
					Already have an account? <Link to="/">Log in</Link>
				</p>
			</div>
		</div>
	);
}

export default SignUp;
