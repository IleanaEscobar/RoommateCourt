import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
	signInWithEmailAndPassword,
	signInWithPopup
} from 'firebase/auth';
import { get, ref, set, update } from 'firebase/database';
import { auth, googleProvider, rtdb } from '../../firebase';
import './Login.css';

function getAuthErrorMessage(firebaseError) {
	const errorCode = firebaseError?.code || '';

	if (errorCode === 'auth/popup-closed-by-user') {
		return 'Google sign-in was canceled before completion.';
	}

	if (errorCode === 'auth/popup-blocked') {
		return 'Google sign-in popup was blocked by your browser. Please allow popups and try again.';
	}

	if (errorCode === 'auth/account-exists-with-different-credential') {
		return 'An account already exists with this email using a different sign-in method. Try logging in with email/password first.';
	}

	if (errorCode === 'auth/unauthorized-domain') {
		return 'This domain is not authorized for Google sign-in in Firebase settings.';
	}

	return 'Unable to sign in with Google. Please try again.';
}

function deriveDisplayName(emailValue) {
	const localPart = emailValue.split('@')[0] || 'Roommate';
	if (!localPart) {
		return 'Roommate';
	}

	return localPart.charAt(0).toUpperCase() + localPart.slice(1);
}

async function ensureUserProfile(user) {
	const userRef = ref(rtdb, `users/${user.uid}`);
	const existingProfile = await get(userRef);
	const resolvedName = user.displayName || deriveDisplayName(user.email || '');

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

function Login() {
	const navigate = useNavigate();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (event) => {
		event.preventDefault();
		setError('');
		setIsLoading(true);

		try {
			const userCredential = await signInWithEmailAndPassword(
				auth,
				email.trim(),
				password
			);
			await ensureUserProfile(userCredential.user);
			navigate(`/dashboard/${userCredential.user.uid}`);
		} catch (firebaseError) {
			setError('Unable to sign in. Please check your email and password.');
		} finally {
			setIsLoading(false);
		}
	};

	const handleGoogleSignIn = async () => {
		setError('');
		setIsLoading(true);

		try {
			const result = await signInWithPopup(auth, googleProvider);
			try {
				await ensureUserProfile(result.user);
			} catch (profileError) {
				console.error('Google sign-in profile sync failed:', profileError);
			}
			navigate(`/dashboard/${result.user.uid}`);
		} catch (firebaseError) {
			setError(getAuthErrorMessage(firebaseError));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="login-page">
			<div className="login-card">
				<h1>Roommate Court</h1>
				<p>Sign in to continue</p>

				<form onSubmit={handleSubmit} className="login-form">
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
						placeholder="Enter your password"
						required
					/>

					{error && <p className="login-error">{error}</p>}

					<button type="submit" disabled={isLoading}>
						{isLoading ? 'Signing in...' : 'Log In'}
					</button>

					<button
						type="button"
						className="google-signin-button"
						onClick={handleGoogleSignIn}
						disabled={isLoading}
					>
						{isLoading ? 'Please wait...' : 'Sign in with Google'}
					</button>
				</form>

				<p className="signup-link-text">
					Need an account? <Link to="/sign-up">Create one</Link>
				</p>
			</div>
		</div>
	);
}

export default Login;
