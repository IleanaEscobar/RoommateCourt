import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../firebase';
import {
	subscribeToNotifications,
	markNotificationAsRead,
	getUnreadCount,
	formatNotificationMessage,
} from '../../utils/notificationsService';
import './Dashboard.css';

function Dashboard() {
	const navigate = useNavigate();
	const { uid } = useParams();
	const [isAuthorized, setIsAuthorized] = useState(false);
	const [notifications, setNotifications] = useState([]);
	const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
	const unreadCount = getUnreadCount(notifications);

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

	useEffect(() => {
		if (!isAuthorized || !uid) return;

		const unsubscribeNotifications = subscribeToNotifications(uid, (newNotifications) => {
			setNotifications(newNotifications);
		});

		return () => unsubscribeNotifications();
	}, [isAuthorized, uid]);

	const handleNotificationClick = (notificationId) => {
		markNotificationAsRead(notificationId);
	};

	if (!isAuthorized) {
		return null;
	}

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
												className={`notification-item ${
													notification.read
														? 'read'
														: 'unread'
												}`}
												onClick={() =>
													handleNotificationClick(
														notification.id
													)
												}
											>
												<div className="notification-icon">
													{icon}
												</div>
												<div className="notification-content">
													<h4>{title}</h4>
													<p>{description}</p>
													<small className="notification-time">
														{notification.createdAt &&
															new Date(
																notification.createdAt
																	.toDate
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
