import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Zëvendëso me të dhënat e tua
const firebaseConfig = {
    apiKey: "AIzaSyDummyReplaceWithYourRealKey",
    authDomain: "albfilms24.firebaseapp.com",
    projectId: "albfilms24",
    storageBucket: "albfilms24.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
