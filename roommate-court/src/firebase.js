import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
	apiKey: 'AIzaSyD9tKNKQg1qyOjnticAtI6zDALCHyZN_Ig',
	authDomain: 'roommate-court.firebaseapp.com',
	projectId: 'roommate-court',
	storageBucket: 'roommate-court.firebasestorage.app',
	messagingSenderId: '351689798811',
	appId: '1:351689798811:web:edf56fee634ff356bcc23e',
	measurementId: 'G-2TNXPQJ300'
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, analytics, auth, googleProvider };