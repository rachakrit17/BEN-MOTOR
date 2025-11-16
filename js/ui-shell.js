// BEN MOTOR POS – UI Shell (Section Switching + Auto-lock)

import { auth, signOut } from "./firebase-init.js";

// -----------------------------
// Section Metadata
// -----------------------------
const SECTION_META = {
  dashboard: {
    title: "แดชบอร์ด BEN MOTOR",
    subtitle: "ภาพรวมวันนี้จากข้อมูลในระบบ"
  },
  pos: {
    title: "เปิดบิล / ใบรับรถ",
    subtitle: "บันทึกงานซ่อมให้ครบในใบเดียว"
  },
  jobs: {
    title: "งานซ่อมทั้งหมด",
    subtitle: "ติดตามสถานะงานซ่อมทุกคันในอู่"
  },
  vehicles: {
    title: "รถซื้อ–ขาย BEN MOTOR",
    subtitle: "ดูรถที่รับซื้อเข้า ค้างสต็อก และขายแล้ว"
  },
  stock: {
    title: "สต็อก & อะไหล่",
    subtitle: "คุมของในร้านให้ไม่ขาด ไม่ล้น"
  },
  reports: { // NEW SECTION
    title: "รายงาน / สถิติ",
    subtitle: "สรุปยอดขาย กำไร และภาพรวมข้อมูลสำคัญ"
  },
  settings: {
    title: "ตั้งค่าร้านและระบบ",
    subtitle: "ข้อมูลร้าน, theme, auto-lock และ export ข้อมูล"
  }
};

const LAST_SECTION_KEY = "bm_last_section";
const AUTO_LOCK_ENABLED_KEY = "bm_auto_lock_enabled";
const AUTO_LOCK_MINUTES_KEY = "bm_auto_lock_minutes";

let autoLockTimerId = null;

// -----------------------------
// Helpers
// -----------------------------
function $(id) {
  return document.getElementById(id);
}

function getAutoLockConfig() {
  let enabled = false;
  let minutes = 5;
  try {
    enabled = localStorage.getItem(AUTO_LOCK_ENABLED_KEY) === "true";
    minutes = Number(localStorage.getItem(AUTO_LOCK_MINUTES_KEY) || "5");
    if (!Number.isFinite(minutes) || minutes <= 0) minutes = 5;
  } catch (e) {
    // ignore
  }
  return { enabled, minutes };
}

function redirectToLogin() {
  window.location.href = "index.html";
}

// -----------------------------
// Core Section Switching
// -----------------------------
function showSection(targetSection) {
  const meta = SECTION_META[targetSection];
  if (!meta) return;

  // 1. Update title
  const mainTitleEl = $("appTitleMain");
  const subTitleEl = $("appTitleSub");
  if (mainTitleEl) mainTitleEl.textContent = meta.title;
  if (subTitleEl) subTitleEl.textContent = meta.subtitle;

  // 2. Update active status on all nav buttons
  const allNavButtons = document.querySelectorAll(
    "[data-section-target]"
  );
  allNavButtons.forEach((btn) => {
    if (btn.dataset.sectionTarget === targetSection) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // 3. Switch section content
  const allSections = document.querySelectorAll(".bm-section");
  allSections.forEach((section) => {
    if (section.dataset.section === targetSection) {
      section.classList.add("active");
      // Trigger data load event for the active section
      section.dispatchEvent(new Event("data-loaded"));
    } else {
      section.classList.remove("active");
    }
  });

  // 4. Save last active section
  try {
    localStorage.setItem(LAST_SECTION_KEY, targetSection);
  } catch (e) {
    // ignore
  }
}

// -----------------------------
// Auto-lock feature
// -----------------------------
function lockScreen() {
  if (!document.body.classList.contains("bm-app")) return; // Only lock app page

  // ใช้ Bootstrap Modal ใน app.html
  const modalEl = $("autoLockModal");
  if (!modalEl) {
    // ถ้าไม่พบ modal ให้ล็อคแบบง่าย
    redirectToLogin();
    return;
  }

  const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
  
  // ให้ปุ่มใน modal ลิงค์ไปหน้า login
  const loginBtn = $("autoLockLoginBtn");
  if(loginBtn) {
      loginBtn.onclick = redirectToLogin;
  }
  
  // Clear any existing timer
  if (autoLockTimerId) {
    clearTimeout(autoLockTimerId);
    autoLockTimerId = null;
  }
}

function scheduleAutoLock() {
  // Clear previous timer
  if (autoLockTimerId) {
    clearTimeout(autoLockTimerId);
  }

  const { enabled, minutes } = getAutoLockConfig();
  if (!enabled || minutes <= 0) {
    return;
  }

  // Set new timer
  const delayMs = minutes * 60 * 1000;
  autoLockTimerId = setTimeout(lockScreen, delayMs);
}

function initAutoLockMonitor() {
  const { enabled, minutes } = getAutoLockConfig();
  if (!enabled || minutes <= 0) {
    return;
  }

  const reset = () => {
    scheduleAutoLock();
  };

  // กิจกรรมที่ถือว่า "ขยับเมาส์ / ใช้งาน"
  const events = ["click", "keydown", "mousemove", "touchstart"];
  events.forEach((evt) => {
    document.addEventListener(evt, reset, { passive: true });
  });

  scheduleAutoLock();
}

// -----------------------------
// Init Navigation Shell
// -----------------------------
function initShell() {
  if (!document.body.classList.contains("bm-app")) {
    return;
  }

  // ติด event ให้ทุกปุ่มที่มี data-section-target
  const navButtons = document.querySelectorAll(
    "[data-section-target]"
  );
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.sectionTarget;
      if (!target) return;
      showSection(target);
    });
  });

  // เปิด section เริ่มต้น: จาก localStorage ถ้ามี / ไม่งั้น dashboard
  let initialSection = "dashboard";
  try {
    const stored = localStorage.getItem(LAST_SECTION_KEY);
    // ตรวจสอบว่า section ที่เก็บไว้มีอยู่ใน SECTION_META หรือไม่ (ป้องกันบั๊กถ้า section ถูกลบ)
    if (stored && SECTION_META[stored]) {
      initialSection = stored;
    }
  } catch (e) {
    // ignore
  }
  
  // Fix for old 'settings' section saved in local storage
  if (initialSection === 'settings') {
      initialSection = 'dashboard';
  }

  showSection(initialSection);
  initAutoLockMonitor();
}

// -----------------------------
// Start Time Ticker
// -----------------------------
function startDateTimeTicker() {
  const updateTime = () => {
    const el = $("currentDateTime");
    if (el) {
      el.textContent = new Date().toLocaleString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      });
    }
  };

  updateTime();
  setInterval(updateTime, 1000);
}

// -----------------------------
// Export (Called by auth.js after login check)
// -----------------------------
export function initAppShell() {
    initShell();
    startDateTimeTicker();
}
