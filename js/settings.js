// BEN MOTOR POS – Settings (แก้เวอร์ชันตรงกับ app.html + Reset POS)

import {
  db,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc
} from "./firebase-init.js";

import { showToast, formatDateTime } from "./utils.js";

const SETTINGS_DOC_ID = "pos-main";

// ช่วยจับ element
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

  if (theme === "dark") body.classList.add("theme-dark");
  else if (theme === "auto") body.classList.add("theme-auto");
  else body.classList.add("theme-light");
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
    let data = snap.exists() ? snap.data() : {};

    // -----------------------------
    // Map ID ให้ตรงกับ app.html จริง
    // -----------------------------
    const shopNameInput = $("settingShopName");
    const shopAddressInput = $("settingShopAddress");
    const shopPhoneInput = $("settingShopPhone");
    const receiptFooterInput = $("settingReceiptFooter");

    const defaultLaborInput = $("settingDefaultLabor");

    const themeSelect = $("settingTheme");

    const autoLockEnabledSelect = $("settingAutoLockEnabled");
    const autoLockMinutesInput = $("settingAutoLockMinutes");

    // -----------------------------
    // Load values
    // -----------------------------
    if (shopNameInput) shopNameInput.value = data.shopName || "BEN MOTOR";
    if (shopAddressInput) shopAddressInput.value = data.shopAddress || "";
    if (shopPhoneInput) shopPhoneInput.value = data.shopPhone || "";
    if (receiptFooterInput)
      receiptFooterInput.value =
        data.receiptFooter || "ขอบคุณที่ใช้บริการ BEN MOTOR";

    if (defaultLaborInput)
      defaultLaborInput.value =
        data.defaultLaborPrice != null
          ? String(data.defaultLaborPrice)
          : "0";

    // Theme
    let theme = data.theme || "light";
    try {
      const localTheme = localStorage.getItem("bm_theme");
      if (localTheme) theme = localTheme;
    } catch {}

    if (themeSelect) themeSelect.value = theme;
    applyTheme(theme);

    // Auto-lock
    let autoLockEnabled =
      typeof data.autoLockEnabled === "boolean"
        ? data.autoLockEnabled
        : false;

    let autoLockMinutes =
      typeof data.autoLockMinutes === "number"
        ? data.autoLockMinutes
        : 10;

    try {
      const localEnabled = localStorage.getItem("bm_autoLockEnabled");
      const localMinutes = localStorage.getItem("bm_autoLockMinutes");
      if (localEnabled != null) autoLockEnabled = localEnabled === "1";
      if (!isNaN(Number(localMinutes))) autoLockMinutes = Number(localMinutes);
    } catch {}

    if (autoLockEnabledSelect)
      autoLockEnabledSelect.value = autoLockEnabled ? "on" : "off";

    if (autoLockMinutesInput)
      autoLockMinutesInput.value = String(autoLockMinutes);

    persistTheme(theme);
    persistAutoLock(autoLockEnabled, autoLockMinutes);

    const lastUpdatedText = $("settingsLastUpdatedText");
    if (lastUpdatedText && data.updatedAt && data.updatedAt.toDate) {
      lastUpdatedText.textContent =
        "อัปเดตล่าสุด: " + formatDateTime(data.updatedAt.toDate());
    }
  } catch (error) {
    console.error("โหลด settings ไม่สำเร็จ:", error);
    showToast("โหลดข้อมูลตั้งค่าร้านไม่สำเร็จ", "error");
  }
}

// -----------------------------
// Save settings to Firestore
// -----------------------------
async function handleSettingsSave(e) {
  if (e && e.preventDefault) e.preventDefault();

  const saveBtn = $("settingsForm")?.querySelector('button[type="submit"]');
  if (saveBtn) saveBtn.disabled = true;

  try {
    const shopName = $("settingShopName")?.value.trim() || "";
    const shopAddress = $("settingShopAddress")?.value.trim() || "";
    const shopPhone = $("settingShopPhone")?.value.trim() || "";
    const receiptFooter = $("settingReceiptFooter")?.value.trim() || "";

    let defaultLaborPrice = 0;
    const def = $("settingDefaultLabor")?.value || "0";
    if (!isNaN(Number(def))) defaultLaborPrice = Number(def);

    const theme = $("settingTheme")?.value || "light";

    const autoLockEnabled =
      $("settingAutoLockEnabled")?.value === "on";
    let autoLockMinutes = Number(
      $("settingAutoLockMinutes")?.value || "10"
    );
    if (!Number.isFinite(autoLockMinutes) || autoLockMinutes <= 0)
      autoLockMinutes = 10;

    const payload = {
      shopName,
      shopAddress,
      shopPhone,
      receiptFooter,
      defaultLaborPrice,
      theme,
      autoLockEnabled,
      autoLockMinutes,
      updatedAt: new Date()
    };

    const docRef = doc(db, "settings", SETTINGS_DOC_ID);
    await setDoc(docRef, payload, { merge: true });

    applyTheme(theme);
    persistTheme(theme);
    persistAutoLock(autoLockEnabled, autoLockMinutes);

    showToast("บันทึกการตั้งค่าเรียบร้อย", "success");

    const lastUpdatedText = $("settingsLastUpdatedText");
    if (lastUpdatedText) {
      lastUpdatedText.textContent =
        "อัปเดตล่าสุด: " + formatDateTime(new Date());
    }
  } catch (err) {
    console.error("บันทึก settings ไม่สำเร็จ:", err);
    showToast("บันทึกการตั้งค่าไม่สำเร็จ", "error");
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

// -----------------------------
// Export JSON
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

    jobsSnap.forEach((d) => jobs.push({ id: d.id, ...d.data() }));
    stockSnap.forEach((d) => stock.push({ id: d.id, ...d.data() }));
    vehiclesSnap.forEach((d) => vehicles.push({ id: d.id, ...d.data() }));
    settingsSnap.forEach((d) => settings.push({ id: d.id, ...d.data() }));

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

    showToast("Export ข้อมูลเรียบร้อย", "success");
  } catch (error) {
    console.error("Export JSON ไม่สำเร็จ:", error);
    showToast("Export ข้อมูลไม่สำเร็จ", "error");
  } finally {
    if (exportBtn) exportBtn.disabled = false;
  }
}

// -----------------------------
// Reset POS data (แบบ A)
// ล้าง jobs, stock, vehicles, settings (ยกเว้น settings/pos-main)
// -----------------------------
async function resetPosData() {
  const collectionsToClear = ["jobs", "stock", "vehicles", "settings"];

  for (const colName of collectionsToClear) {
    try {
      const snap = await getDocs(collection(db, colName));
      const deletes = [];

      snap.forEach((d) => {
        // แบบ A: settings ให้ข้าม doc pos-main
        if (colName === "settings" && d.id === SETTINGS_DOC_ID) {
          return;
        }
        deletes.push(deleteDoc(doc(db, colName, d.id)));
      });

      if (deletes.length > 0) {
        await Promise.all(deletes);
      }
    } catch (e) {
      console.error(`ลบข้อมูลคอลเลกชัน ${colName} ไม่สำเร็จ:`, e);
      throw e;
    }
  }
}

// -----------------------------
// Handle Reset POS (จาก modal)
// -----------------------------
async function handleResetPos() {
  const confirmBtn = $("settingsResetConfirmBtn");
  const input = $("settingsResetConfirmInput");

  if (!confirmBtn || !input) return;

  const modalEl = document.getElementById("settingsResetModal");

  confirmBtn.disabled = true;
  input.disabled = true;

  try {
    await resetPosData();
    showToast("ล้างข้อมูลทั้งหมดเรียบร้อย", "success");

    input.value = "";
    confirmBtn.disabled = true;

    if (modalEl && window.bootstrap) {
      const modalInstance =
        window.bootstrap.Modal.getInstance(modalEl) ||
        new window.bootstrap.Modal(modalEl);
      modalInstance.hide();
    }
  } catch (error) {
    console.error("Reset POS ไม่สำเร็จ:", error);
    showToast("ล้างข้อมูลไม่สำเร็จ", "error");
  } finally {
    input.disabled = false;
  }
}

// -----------------------------
// Init
// -----------------------------
function initSettings() {
  const section = document.querySelector('[data-section="settings"]');
  if (!section) return;

  const form = $("settingsForm");
  if (form) form.addEventListener("submit", handleSettingsSave);

  const exportBtn = $("settingsExportBtn");
  if (exportBtn)
    exportBtn.addEventListener("click", (e) => {
      e.preventDefault();
      handleExportJson();
    });

  const themeSelect = $("settingTheme");
  if (themeSelect) {
    themeSelect.addEventListener("change", () => {
      const value = themeSelect.value;
      applyTheme(value);
      persistTheme(value);
    });
  }

  const autoLockEnabledSelect = $("settingAutoLockEnabled");
  const autoLockMinutesInput = $("settingAutoLockMinutes");

  if (autoLockEnabledSelect) {
    autoLockEnabledSelect.addEventListener("change", () => {
      const enabled = autoLockEnabledSelect.value === "on";
      const minutes = Number(autoLockMinutesInput?.value || "10") || 10;
      persistAutoLock(enabled, minutes);
    });
  }

  if (autoLockMinutesInput) {
    autoLockMinutesInput.addEventListener("input", () => {
      const enabled = autoLockEnabledSelect?.value === "on";
      const minutes = Number(autoLockMinutesInput.value || "10") || 10;
      persistAutoLock(enabled, minutes);
    });
  }

  // Reset POS modal: enable/disable ปุ่มตามข้อความ
  const resetInput = $("settingsResetConfirmInput");
  const resetConfirmBtn = $("settingsResetConfirmBtn");

  if (resetInput && resetConfirmBtn) {
    resetInput.addEventListener("input", () => {
      const ok = resetInput.value.trim().toUpperCase() === "RESET";
      resetConfirmBtn.disabled = !ok;
    });

    resetConfirmBtn.addEventListener("click", (e) => {
      e.preventDefault();
      handleResetPos();
    });
  }

  loadSettings();
}

document.addEventListener("DOMContentLoaded", initSettings);
