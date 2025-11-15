// js/firebase-init.js
// Initial Firebase setup for BEN MOTOR POS (ES Modules + CDN)

// ใช้ Firebase v10+ Modular ผ่าน CDN ES Modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-analytics.js";

// Your web app's Firebase configuration
// จากโปรเจกต์ ben-motor ของคุณ
const firebaseConfig = {
  apiKey: "AIzaSyBZuJ0Gpsz61oF0yrmKcreBsOfpJqPffYo",
  authDomain: "ben-motor.firebaseapp.com",
  projectId: "ben-motor",
  storageBucket: "ben-motor.firebasestorage.app",
  messagingSenderId: "814162692446",
  appId: "1:814162692446:web:7753156248d76938fce7cf",
  measurementId: "G-TVDDW82Q5B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Analytics บางทีใช้ไม่ได้ถ้าไม่รันบน https/localhost เลยหุ้ม try ไว้
let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (error) {
  // ไม่ต้องทำอะไร ปล่อย analytics เป็น null ไป
  console.warn("Analytics is not available in this environment:", error?.message || error);
}

// Services หลักที่เราจะใช้ในโปรเจกต์
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);
const storage = getStorage(app);

// export ไปให้ไฟล์อื่นใช้
export {
  app,
  analytics,
  auth,
  googleProvider,
  db,
  storage
};