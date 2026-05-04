import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyB_mgaiTNtP0A-rBs5DOGmL38XW-rsiNcY",
    authDomain: "swim-note-a5dc4.firebaseapp.com",
    projectId: "swim-note-a5dc4",
    storageBucket: "swim-note-a5dc4.firebasestorage.app",
    messagingSenderId: "154077115658",
    appId: "1:154077115658:web:ee1f3909d1a672558c76f3",
    measurementId: "G-FE7P82K59S",
};

// Check if API key is missing
if (!firebaseConfig.apiKey) {
    console.error("Firebase API Key is missing. Check your .env.local file.");
}

import { getStorage } from "firebase/storage";

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };