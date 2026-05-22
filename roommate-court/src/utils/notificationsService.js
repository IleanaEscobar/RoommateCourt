import { getFirestore, collection, query, where, onSnapshot, updateDoc, doc, orderBy } from 'firebase/firestore';
import { app } from '../firebase';

const db = getFirestore(app);

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
			querySnapshot.forEach((document) => {
				notifications.push({ id: document.id, ...document.data() });
			});
			callback(notifications);
		});

		return unsubscribe;
	} catch (error) {
		console.error('Error subscribing to notifications:', error);
		return () => {};
	}
};

export const markNotificationAsRead = async (notificationId) => {
	try {
		const notificationRef = doc(db, 'notifications', notificationId);
		await updateDoc(notificationRef, { read: true });
	} catch (error) {
		console.error('Error marking notification as read:', error);
	}
};

export const getUnreadCount = (notifications) => {
	return notifications.filter((n) => !n.read).length;
};

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
