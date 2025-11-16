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
// Section Switching
// -----------------------------
export function showSection(sectionKey) {
  const sections = document.querySelectorAll(".bm-section");
  if (!sections.length) return;

  let targetKey = sectionKey || "dashboard";

  // ถ้า sectionKey ไม่ตรงกับที่มีอยู่ ให้ fallback เป็น dashboard
  const exists = Array.from(sections).some(
    (sec) => sec.dataset.section === targetKey
  );
  if (!exists) {
    targetKey = "dashboard";
  }

  sections.forEach((sec) => {
    if (sec.dataset.section === targetKey) {
      sec.classList.add("active");
    } else {
      sec.classList.remove("active");
    }
  });

  // อัปเดตปุ่มใน sidebar + bottom nav + ปุ่ม home
  const navButtons = document.querySelectorAll(
    "[data-section-target]"
  );
  navButtons.forEach((btn) => {
    if (btn.dataset.sectionTarget === targetKey) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // อัปเดต title / subtitle บน top bar
  const titleEl = document.getElementById("currentSectionTitle");
  const subtitleEl = document.querySelector(".bm-topbar-subtitle");
  const meta = SECTION_META[targetKey] || SECTION_META.dashboard;

  if (titleEl) {
    titleEl.textContent = meta.title;
  }
  if (subtitleEl) {
    subtitleEl.textContent = meta.subtitle;
  }

  // จำ section ล่าสุดไว้ใน localStorage
  try {
    localStorage.setItem(LAST_SECTION_KEY, targetKey);
  } catch (e) {
    // ignore
  }

  // เลื่อนขึ้นด้านบนเล็กน้อย (ให้รู้สึกว่ามีเปลี่ยนหน้า)
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

// เผื่อไว้ให้เรียกจาก console หรือไฟล์อื่นแบบไม่ import
// (เช่น ในอนาคตจะเรียกจาก inline handler)
if (typeof window !== "undefined") {
  window.BMShowSection = showSection;
}

// -----------------------------
// Auto-lock (อ่านค่าจาก localStorage เท่านั้น)
// settings.js จะเป็นตัวเขียนค่าให้
// -----------------------------
function readAutoLockConfig() {
  let enabled = false;
  let minutes = 0;

  try {
    const rawEnabled = localStorage.getItem(AUTO_LOCK_ENABLED_KEY);
    const rawMinutes = localStorage.getItem(AUTO_LOCK_MINUTES_KEY);

    enabled = rawEnabled === "on";
    minutes = rawMinutes ? parseInt(rawMinutes, 10) : 0;
    if (!Number.isFinite(minutes) || minutes <= 0) {
      minutes = 0;
    }
  } catch (e) {
    enabled = false;
    minutes = 0;
  }

  return { enabled, minutes };
}

function clearAutoLockTimer() {
  if (autoLockTimerId) {
    window.clearTimeout(autoLockTimerId);
    autoLockTimerId = null;
  }
}

function scheduleAutoLock() {
  const { enabled, minutes } = readAutoLockConfig();
  clearAutoLockTimer();

  if (!enabled || minutes <= 0) {
    return;
  }

  const ms = minutes * 60 * 1000;

  autoLockTimerId = window.setTimeout(async () => {
    try {
      await signOut(auth);
    } catch (e) {
      // ignore error, บังคับออกจากหน้าอยู่ดี
    }
    alert("ระบบทำการล็อกอัตโนมัติแล้ว กรุณาเข้าสู่ระบบอีกครั้ง");
    window.location.href = "index.html";
  }, ms);
}

function startAutoLockWatcher() {
  const { enabled, minutes } = readAutoLockConfig();
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
    if (stored && SECTION_META[stored]) {
      initialSection = stored;
    }
  } catch (e) {
    initialSection = "dashboard";
  }
  showSection(initialSection);

  // เริ่ม auto-lock watcher ตามค่าที่ตั้ง
  startAutoLockWatcher();
}

// -----------------------------
// Bootstrap – รันเมื่อ DOM พร้อม
// -----------------------------
document.addEventListener("DOMContentLoaded", () => {
  initShell();
});