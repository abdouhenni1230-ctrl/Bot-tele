// Importing Firebase
const firebase = require('firebase/app');
const { getDatabase } = require('firebase/database');

// Firebase configuration
const firebaseConfig = {
    apiKey: process.env.FIREBASE_KEY,
    authDomain: 'your-auth-domain.firebaseapp.com',
    databaseURL: 'your-database-url',
    projectId: 'your-project-id',
    storageBucket: 'your-storage-bucket.appspot.com',
    messagingSenderId: 'your-sender-id',
    appId: 'your-app-id'
};

// Initialize Firebase with error handling
try {
    if (!firebaseConfig.apiKey) {
        throw new Error('FIREBASE_KEY is not defined');
    }
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
    // Handle error gracefully
}

// Your bot logic here

// Ensure the bot continues running even if Firebase initialization fails
setInterval(() => {
    console.log('Bot is running...');
}, 5000);