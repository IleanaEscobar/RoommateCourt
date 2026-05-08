import { getFirestore, collection, query, where, onSnapshot, updateDoc, doc, orderBy } from 'firebase/firestore';
import { app } from '../firebase';

const db = getFirestore(app);

/**
 * Subscribe to real-time notifications for a specific user
 * @param {string} userId - The user's ID
 * @param {function} callback - Callback function to receive notifications
 * @returns {function} Unsubscribe function
 */
export const subscribeToNotifications = (userId, callback) => {
	try {
		const notificationsRef = collection(db, 'notifications');
		const q = query(
			notificationsRef,
			where('recipientId', '==', userId),
			orderBy('createdAt', 'desc')
		);

		const unsubscribe = onSnapshot(q, (querySnapshot) => {
			const notifications = [];
			querySnapshot.forEach((doc) => {
				notifications.push({
					id: doc.id,
					...doc.data(),
				});
			});
			callback(notifications);
		});

		return unsubscribe;
	} catch (error) {
		console.error('Error subscribing to notifications:', error);
		return () => {};
	}
};

/**
 * Mark a notification as read
 * @param {string} notificationId - The notification document ID
 * @returns {Promise<void>}
 */
export const markNotificationAsRead = async (notificationId) => {
	try {
		const notificationRef = doc(db, 'notifications', notificationId);
		await updateDoc(notificationRef, { read: true });
	} catch (error) {
		console.error('Error marking notification as read:', error);
	}
};

/**
 * Get the count of unread notifications
 * @param {array} notifications - Array of notification objects
 * @returns {number} Count of unread notifications
 */
export const getUnreadCount = (notifications) => {
	return notifications.filter((notif) => !notif.read).length;
};

/**
 * Format notification message based on type
 * @param {object} notification - Notification object
 * @returns {object} Object with title and description
 */
export const formatNotificationMessage = (notification) => {
	const { type, caseTitle, accuserName } = notification;

	switch (type) {
		case 'case_filed':
			return {
				title: 'New Case Filed',
				description: `${accuserName} has filed a case against you: "${caseTitle}"`,
				icon: '⚖️',
			};
		case 'jury_selected':
			return {
				title: 'Jury Selection',
				description: `You have been selected as a juror for: "${caseTitle}"`,
				icon: '👥',
			};
		case 'verdict_delivered':
			return {
				title: 'Verdict Delivered',
				description: `A verdict has been delivered on your case: "${caseTitle}"`,
				icon: '✓',
			};
		default:
			return {
				title: 'Notification',
				description: 'You have a new notification',
				icon: '🔔',
			};
	}
};
