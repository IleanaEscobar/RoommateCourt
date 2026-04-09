import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
	signInWithEmailAndPassword,
	signInWithPopup
} from 'firebase/auth';
import { auth, googleProvider } from '../../firebase';
import './LoginPage.css';

function LoginPage() {
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
			navigate(`/dashboard/${result.user.uid}`);
		} catch (firebaseError) {
			setError('Unable to sign in with Google. Please try again.');
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

export default LoginPage;
