// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 🔥 VENDOS KONFIGURIMIN TËND TË VËRTETË TË FIREBASE KËTU!
const firebaseConfig = {
    apiKey: "AIzaSyDummyReplaceWithYourRealKey", // <-- VENDOS ÇELËSIN E VËRTETË
    authDomain: "albfilms24.firebaseapp.com",    // <-- VENDOS DOMAIN-IN E VËRTETË
    projectId: "albfilms24",                     // <-- VENDOS PROJECT ID-NË E VËRTETË
    storageBucket: "albfilms24.appspot.com",     // <-- VENDOS BUCKET-IN E VËRTETË
    messagingSenderId: "123456789",              // <-- VENDOS SENDER ID-NË E VËRTETË
    appId: "1:123456789:web:abc123"              // <-- VENDOS APP ID-NË E VËRTETË
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
