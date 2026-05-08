// ==========================================================
//  PASTE YOUR FIREBASE CONFIG VALUES BELOW
//  Firebase Console -> Project Settings -> Your apps -> SDK setup
// ==========================================================
import { initializeApp }       from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore }      from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDllRhxbJQMP3GnTBnEemNhhP7sNM_0ZfA",
  authDomain: "outingplanner-5d2fa.firebaseapp.com",
  projectId: "outingplanner-5d2fa",
  storageBucket: "outingplanner-5d2fa.firebasestorage.app",
  messagingSenderId: "992263825988",
  appId: "1:992263825988:web:4e2b4d58153a008a48ea11",
  measurementId: "G-92CKZ0XKL1"
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

export { db };
