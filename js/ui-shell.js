// js/ui-shell.js
// UI Shell หลักของ BEN MOTOR POS
// - เช็กสถานะ Firebase Auth (ไม่ล็อกอิน เด้งกลับ index.html)
// - แสดงชื่อ / อีเมลผู้ใช้
// - ยุบ/ขยาย Sidebar (Desktop + Mobile)
// - สลับ Section ตามเมนูที่คลิก
// - อัปเดตหัวข้อ Topbar ตามหน้า
// - แสดงวันที่/เวลาแบบ Real-time
// - Shortcut Ctrl+K โฟกัส Search

import { auth } from "./firebase-init.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

// ----- DOM Helper -----
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// ----- Mapping ชื่อ section -> title/topbar -----
const SECTION_META = {
  dashboard: {
    title: "แดชบอร์ด BEN MOTOR",
    subtitle: "ภาพรวมงานซ่อมวันนี้, เงินเข้า, รถยังค้างอู่"
  },
  jobs: {
    title: "งานซ่อมทั้งหมด",
    subtitle: "ดูงานซ่อมวันนี้และย้อนหลัง แยกตามสถานะ/ประเภทงาน"
  },
  pos: {
    title: "เปิดบิล / ใบรับรถ",
    subtitle: "เปิดบิลเร็วด้วยสูตรซ่อม + เลือกอะไหล่จากสต็อก + คำนวณยอดอัตโนมัติ"
  },
  stock: {
    title: "สต็อก & อะไหล่",
    subtitle: "ดูของใกล้หมด, ตัวเดินเร็ว/ช้า, และรายละเอียดอะไหล่ทั้งหมด"
  },
  customers: {
    title: "ลูกค้า & รถลูกค้า",
    subtitle: "ดูลูกค้าประจำ, รถที่ดูแลอยู่ และประวัติงานซ่อมแต่ละคัน"
  },
  "repair-knowledge": {
    title: "แนะนำการซ่อม",
    subtitle: "เก็บสูตรซ่อมประจำตัวช่าง แยกตามอาการ/ระบบรถ ดึงไปเปิดบิลได้ทันที"
  },
  reports: {
    title: "รายงาน & สรุปยอด",
    subtitle: "ดูรายได้ กำไรจริง งานทำเงิน และงานแดกเวลา ทั้งรายวัน/เดือน/ปี"
  },
  tools: {
    title: "เครื่องมือช่าง",
    subtitle: "ตัวช่วยคิดต้นทุน กำไรงานซ่อม อัตราทดสเตอร์ ฯลฯ"
  },
  settings: {
    title: "ตั้งค่า / ระบบ",
    subtitle: "ตั้งค่าร้าน ค่าแรงมาตรฐาน ธีม และการสำรองข้อมูล"
  }
};

// ----- ตัวแปร DOM หลัก -----
const sidebar = $("#bm-sidebar");
const sidebarToggle = $("#bm-sidebar-toggle");
const sidebarToggleMobile = $("#bm-sidebar-toggle-mobile");
const navLinks = $$(".bm-nav-link");
const sections = $$(".bm-section");
const topbarTitle = $("#bm-topbar-title");
const topbarSubtitle = $("#bm-topbar-subtitle");
const globalSearchInput = $("#bm-global-search");
const datetimeMain = $("#bm-datetime-main");
const datetimeSub = $("#bm-datetime-sub");
const userNameLabel = $("#bm-user-name");
const userEmailLabel = $("#bm-user-email");
const logoutBtn = $("#bm-logout-btn");
const fab = $("#bm-fab");

// ----- Auth Guard -----
function setupAuthGuard() {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      // ถ้าไม่มีผู้ใช้ ให้เด้งกลับหน้า login
      window.location.href = "index.html";
      return;
    }

    // มีผู้ใช้: แสดงชื่อ/อีเมล
    const displayName =
      user.displayName ||
      (user.email ? user.email.split("@")[0] : "ช่าง");
    const email = user.email || "-";

    if (userNameLabel) userNameLabel.textContent = displayName;
    if (userEmailLabel) userEmailLabel.textContent = email;
  });
}

async function handleLogout() {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Logout error:", error);
    alert("ออกจากระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }
}

// ----- Sidebar Toggle -----
function toggleSidebarCollapsed() {
  if (!sidebar) return;
  sidebar.classList.toggle("bm-sidebar-collapsed");
}

function toggleSidebarMobile() {
  if (!sidebar) return;

  // โหมดง่าย ๆ: ถ้ามือถือให้สไลด์เข้า/ออกด้วยการเปลี่ยน translateX
  const isHidden = sidebar.dataset.mobileHidden === "1";
  if (isHidden) {
    sidebar.style.transform = "translateX(0)";
    sidebar.style.position = "fixed";
    sidebar.style.zIndex = "1050";
    sidebar.style.left = "0";
    sidebar.style.top = "0";
    sidebar.style.bottom = "0";
    sidebar.style.maxHeight = "100vh";
    sidebar.dataset.mobileHidden = "0";
  } else {
    sidebar.style.transform = "translateX(-100%)";
    sidebar.dataset.mobileHidden = "1";
  }
}

// ปิด sidebar mobile เมื่อคลิกที่ main
function hideSidebarMobileIfNeeded(event) {
  if (!sidebar) return;
  const isMobile = window.innerWidth < 768;
  if (!isMobile) return;
  const isHidden = sidebar.dataset.mobileHidden === "1";
  if (isHidden) return;

  // ถ้าคลิกนอก sidebar -> ปิด
  if (!sidebar.contains(event.target) && event.target.id !== "bm-sidebar-toggle-mobile") {
    sidebar.style.transform = "translateX(-100%)";
    sidebar.dataset.mobileHidden = "1";
  }
}

// ปรับค่าเริ่มต้นของ mobile sidebar
function initSidebarMobileState() {
  if (!sidebar) return;
  const isMobile = window.innerWidth < 768;
  if (isMobile) {
    sidebar.style.transform = "translateX(-100%)";
    sidebar.dataset.mobileHidden = "1";
  } else {
    sidebar.style.transform = "translateX(0)";
    delete sidebar.dataset.mobileHidden;
    sidebar.style.position = "sticky";
  }
}

// ----- Section Switching -----
function setActiveSection(sectionKey) {
  // อัปเดตลิงก์เมนู
  navLinks.forEach((link) => {
    const linkSection = link.getAttribute("data-section");
    const isActive = linkSection === sectionKey;
    link.classList.toggle("active", isActive);
  });

  // อัปเดต sections
  sections.forEach((sectionEl) => {
    const id = sectionEl.id || "";
    const key = id.replace("section-", "");
    const isActive = key === sectionKey;
    sectionEl.classList.toggle("bm-section-active", isActive);
  });

  // อัปเดตข้อความบน Topbar
  const meta = SECTION_META[sectionKey] || SECTION_META["dashboard"];
  if (topbarTitle && meta.title) {
    topbarTitle.textContent = meta.title;
  }
  if (topbarSubtitle && meta.subtitle) {
    topbarSubtitle.textContent = meta.subtitle;
  }
}

function handleNavClick(event) {
  event.preventDefault();
  const link = event.currentTarget;
  const sectionKey = link.getAttribute("data-section");
  if (!sectionKey) return;

  setActiveSection(sectionKey);

  // ถ้าเป็น mobile ให้ซ่อน sidebar หลังคลิกเมนู
  const isMobile = window.innerWidth < 768;
  if (isMobile) {
    toggleSidebarMobile();
  }
}

// ----- Datetime -----
function updateDateTime() {
  if (!datetimeMain || !datetimeSub) return;

  const now = new Date();
  const hour = now.getHours().toString().padStart(2, "0");
  const minute = now.getMinutes().toString().padStart(2, "0");

  const days = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];

  const dayName = days[now.getDay()];
  const date = now.getDate().toString().padStart(2, "0");
  const monthName = months[now.getMonth()];

  datetimeMain.textContent = `${hour}:${minute}`;
  datetimeSub.textContent = `${dayName} ${date} ${monthName}`;
}

// ----- Global Search -----
function focusGlobalSearch() {
  if (!globalSearchInput) return;
  globalSearchInput.focus();
  globalSearchInput.select();
}

function handleGlobalKeydown(event) {
  // Ctrl+K หรือ Cmd+K
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    focusGlobalSearch();
  }
}

// ----- FAB -----
function handleFabClick() {
  // ค่าเริ่มต้น: เปิดหน้า POS (เปิดบิล)
  setActiveSection("pos");
}

// ----- INIT -----
function initEventListeners() {
  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", toggleSidebarCollapsed);
  }

  if (sidebarToggleMobile) {
    sidebarToggleMobile.addEventListener("click", toggleSidebarMobile);
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", handleNavClick);
  });

  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }

  if (fab) {
    fab.addEventListener("click", handleFabClick);
  }

  window.addEventListener("resize", initSidebarMobileState);
  document.addEventListener("click", hideSidebarMobileIfNeeded);
  document.addEventListener("keydown", handleGlobalKeydown);
}

function init() {
  initSidebarMobileState();
  setActiveSection("dashboard");
  updateDateTime();
  setInterval(updateDateTime, 30 * 1000); // อัปเดตทุก 30 วินาที
  setupAuthGuard();
  initEventListeners();
}

document.addEventListener("DOMContentLoaded", init);