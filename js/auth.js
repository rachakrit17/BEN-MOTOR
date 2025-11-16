// BEN MOTOR POS – Auth & Session Logic

import {
  auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "./firebase-init.js";

// -----------------------------
// Helpers
// -----------------------------

const LAST_EMAIL_KEY = "bm_last_email";

function isLoginPage() {
  return !!document.getElementById("loginForm");
}

function isAppPage() {
  return document.body.classList.contains("bm-app");
}

function redirectToApp() {
  window.location.href = "app.html";
}

function redirectToLogin() {
  window.location.href = "index.html";
}

function loadLastEmail() {
  try {
    const email = localStorage.getItem(LAST_EMAIL_KEY);
    return email || "";
  } catch (e) {
    return "";
  }
}

function saveLastEmail(email) {
  try {
    if (email) {
      localStorage.setItem(LAST_EMAIL_KEY, email);
    }
  } catch (e) {
    // ignore
  }
}

// Bootstrap toast (เฉพาะ index.html ใช้ #globalToast / #globalToastMessage)
function showToast(message, type = "error") {
  const toastEl = document.getElementById("globalToast");
  const msgEl = document.getElementById("globalToastMessage");
  if (!toastEl || !msgEl) return;

  msgEl.textContent = message || "";

  toastEl.classList.remove("text-bg-danger", "text-bg-success", "text-bg-info");
  if (type === "success") {
    toastEl.classList.add("text-bg-success");
  } else if (type === "info") {
    toastEl.classList.add("text-bg-info");
  } else {
    toastEl.classList.add("text-bg-danger");
  }

  const toast = bootstrap.Toast.getOrCreateInstance(toastEl);
  toast.show();
}

// แปลง error code ของ Firebase เป็นข้อความไทยสั้น ๆ
function getAuthErrorMessage(error) {
  if (!error || !error.code) return "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง";

  switch (error.code) {
    case "auth/invalid-email":
      return "รูปแบบอีเมลไม่ถูกต้อง";
    case "auth/user-disabled":
      return "บัญชีนี้ถูกปิดการใช้งาน";
    case "auth/user-not-found":
      return "ไม่พบบัญชีผู้ใช้นี้";
    case "auth/wrong-password":
      return "รหัสผ่านไม่ถูกต้อง";
    case "auth/popup-closed-by-user":
      return "ยกเลิกการเข้าสู่ระบบด้วย Google";
    case "auth/network-request-failed":
      return "มีปัญหาการเชื่อมต่ออินเทอร์เน็ต";
    default:
      return "เกิดข้อผิดพลาดในการเข้าสู่ระบบ (" + error.code + ")";
  }
}

// อัปเดตข้อมูลผู้ใช้ใน app.html
function updateUserInfo(user) {
  const sidebarEmail = document.getElementById("sidebarUserEmail");
  const shortEmail = document.getElementById("currentUserShortEmail");
  const fullEmail = document.getElementById("currentUserFullEmail");

  // เปลี่ยนการแสดงอีเมลทั้งหมดเป็น "Admin" ตามที่ผู้ใช้ร้องขอ
  const displayName = "Admin";
  const defaultText = "–";

  if (user) {
    if (sidebarEmail) sidebarEmail.textContent = displayName;
    if (shortEmail) shortEmail.textContent = displayName;
    if (fullEmail) fullEmail.textContent = displayName; 
  } else {
    // Clear display if not logged in
    if (sidebarEmail) sidebarEmail.textContent = defaultText;
    if (shortEmail) shortEmail.textContent = "ผู้ใช้";
    if (fullEmail) fullEmail.textContent = defaultText; 
  }
}

// -----------------------------\
// Index Page Logic (index.html)
// -----------------------------\
function initLoginPage() {
  const loginForm = document.getElementById("loginForm");
  const emailInput = document.getElementById("emailInput");
  const passwordInput = document.getElementById("passwordInput");
  const rememberMeInput = document.getElementById("rememberMeInput");
  const googleLoginBtn = document.getElementById("googleLoginBtn");
  const forgotPasswordLink = document.getElementById("forgotPasswordLink");

  if (!loginForm || !emailInput || !passwordInput) {
    return;
  }

  // เติมผู้ใช้ล่าสุด
  const lastEmail = loadLastEmail();
  if (lastEmail) {
    emailInput.value = lastEmail;
    if (rememberMeInput) {
      rememberMeInput.checked = true;
    }
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showToast("กรุณากรอกอีเมลและรหัสผ่านให้ครบ", "error");
      return;
    }

    try {
      const btn = document.getElementById("emailLoginBtn");
      if (btn) {
        btn.disabled = true;
      }
      
      const userCred = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      // บันทึก email ถ้าเลือก remember me
      if (rememberMeInput && rememberMeInput.checked) {
        saveLastEmail(email);
      } else {
        saveLastEmail(null);
      }

      showToast("เข้าสู่ระบบสำเร็จ! กำลังไปที่แดชบอร์ด...", "success");
      // ไม่ต้องเรียก redirectToApp() ตรงนี้ เพราะ onAuthStateChanged จะจัดการเอง
    } catch (error) {
      console.error("Login failed:", error);
      showToast(getAuthErrorMessage(error), "error");
    } finally {
      const btn = document.getElementById("emailLoginBtn");
      if (btn) {
        btn.disabled = false;
      }
    }
  });

  if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", async () => {
      try {
        googleLoginBtn.disabled = true;
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        // onAuthStateChanged จะจัดการการเปลี่ยนหน้าเอง
      } catch (error) {
        console.error("Google login failed:", error);
        showToast(getAuthErrorMessage(error), "error");
      } finally {
        googleLoginBtn.disabled = false;
      }
    });
  }

  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", (e) => {
      e.preventDefault();
      showToast(
        "สามารถรีเซ็ตรหัสผ่านผ่าน Firebase Console หรือใช้เข้าสู่ระบบด้วย Google",
        "info"
      );
    });
  }
}

// -----------------------------\
// App Page Logic (app.html)
// -----------------------------\
function initAppPage() {
  const sidebarLogoutBtn = document.getElementById("sidebarLogoutBtn");
  const userLogoutBtn = document.getElementById("userLogoutBtn");

  const handleLogout = async () => {
    try {
      await signOut(auth);
      redirectToLogin();
    } catch (error) {
      alert("ออกจากระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  };

  if (sidebarLogoutBtn) {
    sidebarLogoutBtn.addEventListener("click", handleLogout);
  }
  if (userLogoutBtn) {
    userLogoutBtn.addEventListener("click", handleLogout);
  }
}

// -----------------------------\
// Global auth state handler
// -----------------------------\
onAuthStateChanged(auth, (user) => {
  if (isLoginPage()) {
    if (user) {
      // ถ้าล็อกอินแล้วแต่ยังอยู่หน้า index ให้ส่งไป app.html
      redirectToApp();
    } else {
      // ยังไม่ล็อกอิน แสดงหน้า login ตามปกติ
      initLoginPage();
    }
    return;
  }

  if (isAppPage()) {
    if (!user) {
      // ถ้ายังไม่ล็อกอิน ให้ส่งไปหน้า login
      redirectToLogin();
    } else {
      // ล็อกอินแล้ว อัปเดตข้อมูลผู้ใช้
      updateUserInfo(user);
    }
    initAppPage();
  }
});
