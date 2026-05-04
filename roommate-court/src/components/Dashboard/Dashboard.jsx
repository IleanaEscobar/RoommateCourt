import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../firebase';
import './Dashboard.css';

function Dashboard() {
	const navigate = useNavigate();
	const { uid } = useParams();
	const [isAuthorized, setIsAuthorized] = useState(false);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			if (!user || user.uid !== uid) {
				navigate('/', { replace: true });
				return;
			}

			setIsAuthorized(true);
		});

		return () => unsubscribe();
	}, [navigate, uid]);

	if (!isAuthorized) {
		return null;
	}

	return (
		<div className="dashboard-page">
			<div className="dashboard-card">
				<h1>Welcome to Roommate Court</h1>
				<p className="dashboard-subtitle">What would you like to do?</p>
				<div className="dashboard-buttons">
					<button className="btn-create-household">
						🏠 Create Household
					</button>
					<button className="btn-open-case">
						⚖️ Open Case
					</button>
				</div>
				<Link to="/" className="dashboard-back-button">
					Back to Login
				</Link>
			</div>
		</div>
	);
}

export default Dashboard;
