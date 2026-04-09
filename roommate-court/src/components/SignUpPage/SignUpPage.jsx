import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../../firebase';
import './SignUpPage.css';

function SignUpPage() {
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
			navigate(`/dashboard/${result.user.uid}`);
		} catch (firebaseError) {
			setError('Unable to sign up with Google. Please try again.');
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

export default SignUpPage;
