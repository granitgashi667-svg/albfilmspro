import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 🔥 VENDOS KONFIGURIMIN TËND PERSONAL TË FIREBASE KËTU!
// Mund t'i gjeni këto të dhëna në Firebase Console > Project Settings
const firebaseConfig = {
    apiKey: "AIzaSyB2...", // Zëvendëso me çelësin e vërtetë
    authDomain: "albfilmspro.firebaseapp.com", // Zëvendëso me emrin e projektit
    projectId: "albfilmspro", // Zëvendëso me ID-në e projektit
    storageBucket: "albfilmspro.appspot.com", // Zëvendëso me storage bucket
    messagingSenderId: "123456789", // Zëvendëso me sender ID
    appId: "1:123456789:web:abc123" // Zëvendëso me App ID
};

// Inicializimi i Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
