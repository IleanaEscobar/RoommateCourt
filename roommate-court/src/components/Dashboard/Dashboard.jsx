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
				<h1>Roommate Court</h1>
				<p className="dashboard-subtitle">Resolve disputes fairly, one case at a time.</p>
				<button className="dashboard-file-case-btn" onClick={() => navigate('/case/new')}>
					File a New Case
				</button>
				<Link to="/" className="dashboard-back-button">
					Sign Out
				</Link>
			</div>
		</div>
	);
}

export default Dashboard;
