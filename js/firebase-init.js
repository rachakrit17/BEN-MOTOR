// BEN MOTOR POS – Firebase Initialization (ES Modules via CDN)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// -----------------------------
// Firebase Config (จากโปรเจกต์ ben-motor)
// -----------------------------
const firebaseConfig = {
  apiKey: "AIzaSyBZuJ0Gpsz61oF0yrmKcreBsOfpJqPffYo",
  authDomain: "ben-motor.firebaseapp.com",
  projectId: "ben-motor",
  storageBucket: "ben-motor.firebasestorage.app",
  messagingSenderId: "814162692446",
  appId: "1:814162692446:web:7753156248d76938fce7cf",
  measurementId: "G-TVDDW82Q5B"
};

// -----------------------------
// Initialize core services
// -----------------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (err) {
  // ถ้ารันในสภาพแวดล้อมที่ไม่รองรับ analytics ให้ข้ามเฉย ๆ
  analytics = null;
}

// -----------------------------
// Export ให้ไฟล์อื่นใช้ผ่าน firebase-init.js ที่เดียว
// -----------------------------
export {
  app,
  analytics,
  auth,
  db,
  // Auth helpers
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  // Firestore helpers
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
};