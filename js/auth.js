// js/auth.js
// Auth helper สำหรับ BEN MOTOR POS (ใช้ร่วมได้ทุกหน้า)
// - จัดการเข้าสู่ระบบด้วยอีเมล/รหัสผ่าน และ Google
// - ฟังก์ชันส่งลิงก์รีเซ็ตรหัสผ่าน
// - ฟังก์ชัน requireAuth บังคับให้ต้องล็อกอินก่อนใช้งานหน้า
// - เก็บ/ดึงอีเมลผู้ใช้ล่าสุดจาก localStorage

import { auth, googleProvider } from "./firebase-init.js";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

const LAST_USER_EMAIL_KEY = "ben_motor_last_user_email";

// ---------- LocalStorage helper ----------

function getLastUserEmail() {
  try {
    const value = localStorage.getItem(LAST_USER_EMAIL_KEY);
    return value || "";
  } catch (error) {
    console.warn("Cannot read last user email from localStorage:", error);
    return "";
  }
}

function setLastUserEmail(email) {
  if (!email) return;
  try {
    localStorage.setItem(LAST_USER_EMAIL_KEY, email);
  } catch (error) {
    console.warn("Cannot write last user email to localStorage:", error);
  }
}

// ---------- Error message mapping (ภาษาไทย) ----------

function mapAuthErrorCodeToMessage(code) {
  switch (code) {
    case "auth/invalid-email":
      return "รูปแบบอีเมลไม่ถูกต้อง";
    case "auth/user-disabled":
      return "บัญชีนี้ถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ";
    case "auth/user-not-found":
      return "ไม่พบบัญชีผู้ใช้นี้ในระบบ";
    case "auth/wrong-password":
      return "รหัสผ่านไม่ถูกต้อง";
    case "auth/too-many-requests":
      return "พยายามเข้าสู่ระบบผิดพลาดหลายครั้ง โปรดลองใหม่ภายหลัง";
    case "auth/popup-closed-by-user":
      return "คุณปิดหน้าต่างเข้าสู่ระบบก่อนเสร็จสิ้น";
    default:
      return "เกิดข้อผิดพลาดในการเข้าสู่ระบบ (" + (code || "unknown") + ")";
  }
}

// ---------- Core auth actions ----------

/**
 * เข้าสู่ระบบด้วยอีเมล/รหัสผ่าน
 * @param {string} email
 * @param {string} password
 * @param {{ rememberDevice?: boolean }} options
 * @returns {Promise<{ user, credential }>}
 */
async function loginWithEmailPassword(email, password, options = {}) {
  const trimmedEmail = (email || "").trim();
  const trimmedPassword = (password || "").trim();
  const rememberDevice = options.rememberDevice ?? true;

  if (!trimmedEmail || !trimmedPassword) {
    const error = new Error("กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน");
    error.code = "bm/missing-email-password";
    throw error;
  }

  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      trimmedEmail,
      trimmedPassword
    );
    const user = credential.user;

    if (rememberDevice && user?.email) {
      setLastUserEmail(user.email);
    }

    return { user, credential };
  } catch (error) {
    const readableMessage = mapAuthErrorCodeToMessage(error?.code);
    const wrapped = new Error(readableMessage);
    wrapped.original = error;
    wrapped.code = error?.code || "bm/email-login-error";
    throw wrapped;
  }
}

/**
 * เข้าสู่ระบบด้วย Google
 * @param {{ rememberDevice?: boolean }} options
 * @returns {Promise<{ user, credential }>}
 */
async function loginWithGoogle(options = {}) {
  const rememberDevice = options.rememberDevice ?? true;

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    if (rememberDevice && user?.email) {
      setLastUserEmail(user.email);
    }

    return { user, credential: result };
  } catch (error) {
    // ถ้าปิด popup เอง ไม่ต้องถือว่าเป็น error ร้ายแรง
    if (error?.code === "auth/popup-closed-by-user") {
      const softError = new Error("คุณปิดหน้าต่างเข้าสู่ระบบก่อนเสร็จสิ้น");
      softError.code = error.code;
      softError.original = error;
      throw softError;
    }

    const readableMessage = mapAuthErrorCodeToMessage(error?.code);
    const wrapped = new Error(readableMessage);
    wrapped.original = error;
    wrapped.code = error?.code || "bm/google-login-error";
    throw wrapped;
  }
}

/**
 * ส่งอีเมลสำหรับรีเซ็ตรหัสผ่าน
 * (ให้หน้า UI จัดการข้อความแจ้งผู้ใช้เอง)
 * @param {string} email
 */
async function sendPasswordReset(email) {
  const trimmedEmail = (email || "").trim();
  if (!trimmedEmail) {
    const error = new Error("กรุณากรอกอีเมลก่อนขอรีเซ็ตรหัสผ่าน");
    error.code = "bm/missing-email";
    throw error;
  }

  try {
    await sendPasswordResetEmail(auth, trimmedEmail);
  } catch (error) {
    const readableMessage = mapAuthErrorCodeToMessage(error?.code);
    const wrapped = new Error(readableMessage);
    wrapped.original = error;
    wrapped.code = error?.code || "bm/reset-password-error";
    throw wrapped;
  }
}

/**
 * ออกจากระบบ (เลือกได้ว่าจะ redirect ไปไหนหลังออก)
 * @param {string|null} redirectUrl
 */
async function logout(redirectUrl = "index.html") {
  try {
    await signOut(auth);
    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  } catch (error) {
    const wrapped = new Error("ออกจากระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    wrapped.original = error;
    wrapped.code = "bm/logout-error";
    throw wrapped;
  }
}

/**
 * บังคับให้ต้องล็อกอินก่อนถึงจะใช้หน้าได้
 * - ถ้าไม่ล็อกอินจะ redirect ไปหน้า index.html (หรือ redirectUrl ที่ส่งมา)
 * - ถ้าล็อกอินแล้ว resolve user ให้
 * @param {string} redirectUrl
 * @returns {Promise<import("firebase/auth").User>}
 */
function requireAuth(redirectUrl = "index.html") {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsub();
        resolve(user);
      } else {
        if (redirectUrl) {
          window.location.href = redirectUrl;
        }
      }
    });
  });
}

/**
 * สมัคร callback เวลา user login/logout เปลี่ยน
 * ใช้บนหน้าที่ต้อง sync UI ตามสถานะ auth
 * @param {(user: import("firebase/auth").User|null)=>void} callback
 * @returns {() => void} unsubscribe
 */
function onAuthUserChanged(callback) {
  return onAuthStateChanged(auth, callback);
}

// ---------- Export ----------

export {
  auth,
  googleProvider,
  LAST_USER_EMAIL_KEY,
  getLastUserEmail,
  setLastUserEmail,
  mapAuthErrorCodeToMessage,
  loginWithEmailPassword,
  loginWithGoogle,
  sendPasswordReset,
  logout,
  requireAuth,
  onAuthUserChanged
};