// BEN MOTOR POS – Settings / ตั้งค่าร้าน & ระบบ

import {
  db,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  serverTimestamp // <--- แก้ไขจุดที่ 1: เพิ่ม serverTimestamp
} from "./firebase-init.js";

import { showToast, formatDateTime } from "./utils.js";

const SETTINGS_DOC_ID = "pos-main";

function $(id) {
  return document.getElementById(id);
}

// -----------------------------
// Theme helpers
// -----------------------------
function applyTheme(theme) {
  const body = document.body;
  if (!body) return;

  body.classList.remove("theme-light", "theme-dark", "theme-auto");

  if (theme === "dark") {
    body.classList.add("theme-dark");
  } else if (theme === "auto") {
    body.classList.add("theme-auto");
  } else {
    body.classList.add("theme-light");
  }
}

function persistTheme(theme) {
  try {
    localStorage.setItem("bm_theme", theme);
  } catch (e) {
    console.warn("ไม่สามารถบันทึก theme ลง localStorage ได้:", e);
  }
}

// -----------------------------
// Auto-lock helpers
// -----------------------------
function persistAutoLock(enabled, minutes) {
  try {
    localStorage.setItem("bm_autoLockEnabled", enabled ? "1" : "0");
    localStorage.setItem("bm_autoLockMinutes", String(minutes || 0));
  } catch (e) {
    console.warn("ไม่สามารถบันทึก auto-lock ลง localStorage ได้:", e);
  }
}

// -----------------------------
// Load settings from Firestore
// -----------------------------
async function loadSettings() {
  const docRef = doc(db, "settings", SETTINGS_DOC_ID);

  try {
    const snap = await getDoc(docRef);
    let data = {};
    if (snap.exists()) {
      data = snap.data() || {};
    }

    // ฟิลด์ข้อมูลร้าน
    const shopNameInput = $("settingsShopNameInput");
    const shopAddressInput = $("settingsShopAddressInput");
    const shopPhoneInput = $("settingsShopPhoneInput");
    const receiptFooterInput = $("settingsReceiptFooterInput");

    if (shopNameInput) {
      shopNameInput.value = data.shopName || "BEN MOTOR";
    }
    if (shopAddressInput) {
      shopAddressInput.value = data.shopAddress || "";
    }
    if (shopPhoneInput) {
      shopPhoneInput.value = data.shopPhone || "";
    }
    if (receiptFooterInput) {
      receiptFooterInput.value =
        data.receiptFooter ||
        "ขอบคุณที่ใช้บริการ BEN MOTOR";
    }

    // ฟิลด์ POS
    const defaultLaborInput = $("settingsDefaultLaborInput");
    const allowedEmailsInput = $("settingsAllowedEmailsInput");

    if (defaultLaborInput) {
      defaultLaborInput.value =
        data.defaultLaborPrice != null ? String(data.defaultLaborPrice) : "";
    }

    if (allowedEmailsInput) {
      if (Array.isArray(data.allowedEmails)) {
        allowedEmailsInput.value = data.allowedEmails.join("\n");
      } else if (typeof data.allowedEmails === "string") {
        allowedEmailsInput.value = data.allowedEmails;
      } else {
        allowedEmailsInput.value = "";
      }
    }

    // Theme
    let theme = data.theme || "light";
    try {
      const localTheme = localStorage.getItem("bm_theme");
      if (localTheme) {
        theme = localTheme;
      }
    } catch {
      // ignore
    }

    const themeLightRadio = $("settingsThemeLight");
    const themeDarkRadio = $("settingsThemeDark");
    const themeAutoRadio = $("settingsThemeAuto");

    if (themeLightRadio && themeDarkRadio && themeAutoRadio) {
      if (theme === "dark") {
        themeDarkRadio.checked = true;
      } else if (theme === "auto") {
        themeAutoRadio.checked = true;
      } else {
        themeLightRadio.checked = true;
      }
    }

    applyTheme(theme);

    // Auto-lock
    const autoLockEnabledCheckbox = $("autoLockEnabledCheckbox");
    const autoLockMinutesInput = $("autoLockMinutesInput");

    let autoLockEnabled =
      typeof data.autoLockEnabled === "boolean"
        ? data.autoLockEnabled
        : false;
    let autoLockMinutes =
      typeof data.autoLockMinutes === "number"
        ? data.autoLockMinutes
        : 5;

    try {
      const localEnabled = localStorage.getItem("bm_autoLockEnabled");
      const localMinutes = localStorage.getItem("bm_autoLockMinutes");
      if (localEnabled != null) {
        autoLockEnabled = localEnabled === "1";
      }
      if (localMinutes != null && !Number.isNaN(Number(localMinutes))) {
        autoLockMinutes = Number(localMinutes);
      }
    } catch {
      // ignore
    }

    if (autoLockEnabledCheckbox) {
      autoLockEnabledCheckbox.checked = autoLockEnabled;
    }
    if (autoLockMinutesInput) {
      autoLockMinutesInput.value = String(autoLockMinutes);
    }

    persistTheme(theme);
    persistAutoLock(autoLockEnabled, autoLockMinutes);

    const lastUpdatedText = $("settingsLastUpdatedText");
    if (lastUpdatedText && data.updatedAt && data.updatedAt.toDate) {
      lastUpdatedText.textContent =
        "อัปเดตล่าสุด: " + formatDateTime(data.updatedAt.toDate());
    }
  } catch (error) {
    console.error("โหลดข้อมูล settings ไม่สำเร็จ:", error);
    showToast("โหลดข้อมูลตั้งค่าร้านไม่สำเร็จ", "error");
  }
}

// -----------------------------
// Save settings to Firestore
// -----------------------------
async function handleSettingsSave(e) {
  if (e && e.preventDefault) e.preventDefault();

  const shopNameInput = $("settingsShopNameInput");
  const shopAddressInput = $("settingsShopAddressInput");
  const shopPhoneInput = $("settingsShopPhoneInput");
  const receiptFooterInput = $("settingsReceiptFooterInput");

  const defaultLaborInput = $("settingsDefaultLaborInput");
  const allowedEmailsInput = $("settingsAllowedEmailsInput");

  const themeLightRadio = $("settingsThemeLight");
  const themeDarkRadio = $("settingsThemeDark");
  const themeAutoRadio = $("settingsThemeAuto");

  const autoLockEnabledCheckbox = $("autoLockEnabledCheckbox");
  const autoLockMinutesInput = $("autoLockMinutesInput");

  const saveBtn = $("settingsSaveBtn");

  if (saveBtn) saveBtn.disabled = true;

  try {
    const shopName = shopNameInput ? shopNameInput.value.trim() : "";
    const shopAddress = shopAddressInput
      ? shopAddressInput.value.trim()
      : "";
    const shopPhone = shopPhoneInput
      ? shopPhoneInput.value.trim()
      : "";
    const receiptFooter = receiptFooterInput
      ? receiptFooterInput.value.trim()
      : "";

    let defaultLaborPrice = 0;
    if (defaultLaborInput && defaultLaborInput.value) {
      const num = Number(
        (defaultLaborInput.value || "").toString().replace(/,/g, "")
      );
      if (Number.isFinite(num)) defaultLaborPrice = num;
    }

    let allowedEmails = [];
    if (allowedEmailsInput && allowedEmailsInput.value.trim()) {
      allowedEmails = allowedEmailsInput.value
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    let theme = "light";
    if (themeDarkRadio && themeDarkRadio.checked) {
      theme = "dark";
    } else if (themeAutoRadio && themeAutoRadio.checked) {
      theme = "auto";
    } else if (themeLightRadio && themeLightRadio.checked) {
      theme = "light";
    }

    const autoLockEnabled = autoLockEnabledCheckbox
      ? autoLockEnabledCheckbox.checked
      : false;

    let autoLockMinutes = 5;
    if (autoLockMinutesInput && autoLockMinutesInput.value) {
      const num = Number(autoLockMinutesInput.value);
      if (Number.isFinite(num) && num > 0) {
        autoLockMinutes = num;
      }
    }

    const payload = {
      shopName,
      shopAddress,
      shopPhone,
      receiptFooter,
      defaultLaborPrice,
      allowedEmails,
      theme,
      autoLockEnabled,
      autoLockMinutes,
      updatedAt: serverTimestamp() // <--- แก้ไขจุดที่ 2: ใช้ serverTimestamp()
    };

    const docRef = doc(db, "settings", SETTINGS_DOC_ID);
    await setDoc(docRef, payload, { merge: true });

    applyTheme(theme);
    persistTheme(theme);
    persistAutoLock(autoLockEnabled, autoLockMinutes);

    showToast("บันทึกการตั้งค่าร้านเรียบร้อย", "success");

    const lastUpdatedText = $("settingsLastUpdatedText");
    if (lastUpdatedText) {
      lastUpdatedText.textContent =
        "อัปเดตล่าสุด: " + formatDateTime(new Date());
    }
  } catch (error) {
    console.error("บันทึก settings ไม่สำเร็จ:", error);
    showToast("บันทึกการตั้งค่าไม่สำเร็จ", "error");
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

// -----------------------------
// Export JSON (Backup)
// -----------------------------
async function handleExportJson() {
  const exportBtn = $("settingsExportBtn");
  if (exportBtn) exportBtn.disabled = true;

  try {
    const jobsSnap = await getDocs(collection(db, "jobs"));
    const stockSnap = await getDocs(collection(db, "stock"));
    const vehiclesSnap = await getDocs(collection(db, "vehicles"));
    const settingsSnap = await getDocs(collection(db, "settings"));

    const jobs = [];
    const stock = [];
    const vehicles = [];
    const settings = [];

    jobsSnap.forEach((docSnap) => {
      jobs.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    stockSnap.forEach((docSnap) => {
      stock.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    vehiclesSnap.forEach((docSnap) => {
      vehicles.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    settingsSnap.forEach((docSnap) => {
      settings.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      jobs,
      stock,
      vehicles,
      settings
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    const nowLabel = formatDateTime(new Date()).replace(/\s+/g, "_");
    a.href = url;
    a.download = `ben-motor-pos-backup-${nowLabel}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showToast("Export ข้อมูลเป็นไฟล์ JSON เรียบร้อย", "success");
  } catch (error) {
    console.error("Export JSON ไม่สำเร็จ:", error);
    showToast("Export ข้อมูลไม่สำเร็จ", "error");
  } finally {
    if (exportBtn) exportBtn.disabled = false;
  }
}

// -----------------------------
// Init Settings section
// -----------------------------
function initSettings() {
  const section = document.querySelector('[data-section="settings"]');
  if (!section) return;

  const form = $("settingsForm");
  const saveBtn = $("settingsSaveBtn");
  const exportBtn = $("settingsExportBtn");

  const themeRadios = document.querySelectorAll(
    'input[name="settingsTheme"]'
  );
  const autoLockEnabledCheckbox = $("autoLockEnabledCheckbox");
  const autoLockMinutesInput = $("autoLockMinutesInput");

  if (form) {
    form.addEventListener("submit", handleSettingsSave);
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", handleSettingsSave);
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", (e) => {
      e.preventDefault();
      handleExportJson();
    });
  }

  themeRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      const value = radio.value;
      applyTheme(value);
      persistTheme(value);
    });
  });

  if (autoLockEnabledCheckbox) {
    autoLockEnabledCheckbox.addEventListener("change", () => {
      const enabled = autoLockEnabledCheckbox.checked;
      const minutes = autoLockMinutesInput
        ? Number(autoLockMinutesInput.value || "0") || 5
        : 5;
      persistAutoLock(enabled, minutes);
    });
  }

  if (autoLockMinutesInput) {
    autoLockMinutesInput.addEventListener("input", () => {
      const enabled = autoLockEnabledCheckbox
        ? autoLockEnabledCheckbox.checked
        : false;
      const minutes =
        Number(autoLockMinutesInput.value || "0") || 5;
      persistAutoLock(enabled, minutes);
    });
  }

  loadSettings();
}

// -----------------------------
// Bootstrap
// -----------------------------
document.addEventListener("DOMContentLoaded", () => {
  initSettings();
});
