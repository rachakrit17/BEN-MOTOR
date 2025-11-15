// js/settings.js
// ตั้งค่าร้าน / ธีม / ใบเสร็จ / Auto-lock ของ BEN MOTOR POS
// - เก็บค่าลง localStorage (mock) ยังไม่เชื่อม Firestore
// - เปลี่ยนธีม Light/Dark ทันที
// - มีตัวอย่างใบเสร็จแบบตัวหนังสือให้ดูฝั่งขวา
// - ปุ่ม Export JSON/CSV สำหรับ Backup ตั้งค่า (ในอนาคตค่อยต่อ Firestore หรือดาวน์โหลดเก็บไว้เอง)

const $ = (selector) => document.querySelector(selector);

const SETTINGS_STORAGE_KEY = "benMotor.settings.v1";

const defaultSettings = {
  shop: {
    name: "BEN MOTOR",
    phone: "",
    line: "",
    address: "",
    taxId: "",
    logoUrl: ""
  },
  receipt: {
    header: "BEN MOTOR\nรับซ่อม / บำรุงรักษา / เตรียมรถก่อนขาย",
    note: "กรุณาตรวจสอบรายละเอียดงานซ่อม และยอดเงินก่อนชำระทุกครั้ง",
    footer:
      "ขอบคุณที่ใช้บริการ BEN MOTOR\nหากมีปัญหาเพิ่มเติม ทักกลับมาที่ร้านได้ตลอดเวลาทำการ"
  },
  theme: "system", // system | light | dark
  autoLock: {
    enabled: true,
    minutes: 10
  }
};

// ---------- Storage helpers ----------

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return structuredClone(defaultSettings);
    const parsed = JSON.parse(raw);

    // merge แบบปลอดภัย
    return {
      shop: {
        ...defaultSettings.shop,
        ...(parsed.shop || {})
      },
      receipt: {
        ...defaultSettings.receipt,
        ...(parsed.receipt || {})
      },
      theme: parsed.theme || defaultSettings.theme,
      autoLock: {
        ...defaultSettings.autoLock,
        ...(parsed.autoLock || {})
      }
    };
  } catch (err) {
    console.warn("Load settings error, fallback to default:", err);
    return structuredClone(defaultSettings);
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn("Save settings error:", err);
  }
}

// ---------- Theme / Auto-lock apply ----------

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.remove("bm-theme-dark", "bm-theme-light");

  if (theme === "dark") {
    root.classList.add("bm-theme-dark");
  } else if (theme === "light") {
    root.classList.add("bm-theme-light");
  } else {
    // system: ไม่ใส่อะไร ปล่อยให้ CSS + prefers-color-scheme จัดการเอง
  }
}

function getSystemThemeLabel() {
  if (!window.matchMedia) return "ตามระบบ";
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "ตามระบบ (ตอนนี้: มืด)" : "ตามระบบ (ตอนนี้: สว่าง)";
}

// ---------- Layout builder ----------

function buildSettingsLayout(cardBody) {
  cardBody.innerHTML = `
    <div class="bm-form-section-title">ตั้งค่าร้าน & ระบบ</div>
    <div class="bm-form-section-subtitle">
      ข้อมูลชุดนี้ใช้สำหรับแสดงบนหัวใบเสร็จ, การแจ้งเตือนลูกค้า และหน้าตาของระบบ (ธีม)
    </div>

    <div class="row g-2 g-md-3 mb-2">
      <div class="col-12 col-lg-7">
        <div class="bm-subpanel mb-2">
          <div class="bm-form-section-title" style="font-size:0.86rem;">ข้อมูลร้าน</div>
          <div class="row g-2 bm-form-grid-gap">
            <div class="col-12 col-md-6">
              <label for="bm-settings-shop-name" class="form-label mb-1">ชื่อร้าน</label>
              <input type="text" id="bm-settings-shop-name" class="form-control form-control-sm" placeholder="เช่น BEN MOTOR / เบน มอเตอร์">
            </div>
            <div class="col-12 col-md-6">
              <label for="bm-settings-shop-phone" class="form-label mb-1">เบอร์โทรร้าน</label>
              <input type="tel" id="bm-settings-shop-phone" class="form-control form-control-sm" placeholder="เช่น 08x-xxx-xxxx">
            </div>
            <div class="col-12 col-md-6">
              <label for="bm-settings-shop-line" class="form-label mb-1">LINE Official / LINE ID ร้าน</label>
              <input type="text" id="bm-settings-shop-line" class="form-control form-control-sm" placeholder="@benmotor / benmotor">
            </div>
            <div class="col-12 col-md-6">
              <label for="bm-settings-shop-taxid" class="form-label mb-1">เลขประจำตัวผู้เสียภาษี (ถ้ามี)</label>
              <input type="text" id="bm-settings-shop-taxid" class="form-control form-control-sm" placeholder="ถ้าไม่มีปล่อยว่างได้">
            </div>
            <div class="col-12">
              <label for="bm-settings-shop-address" class="form-label mb-1">ที่อยู่ร้าน (ย่อๆ ไว้แสดงบนใบเสร็จ)</label>
              <textarea id="bm-settings-shop-address" rows="2" class="form-control form-control-sm" placeholder="บ้านเลขที่ / ซอย / ถนน / ตำบล / อำเภอ / จังหวัด (แบบย่อ)"></textarea>
            </div>
            <div class="col-12">
              <label for="bm-settings-shop-logo-url" class="form-label mb-1">ลิงก์โลโก้ร้าน (URL, ไว้ใช้ทีหลังตอนทำใบเสร็จ PDF)</label>
              <input type="text" id="bm-settings-shop-logo-url" class="form-control form-control-sm" placeholder="เช่น https://.../ben-motor-logo.png">
            </div>
          </div>
        </div>

        <div class="bm-subpanel mb-2">
          <div class="bm-form-section-title" style="font-size:0.86rem;">ธีม & ความปลอดภัยหน้าจอ</div>
          <div class="row g-2 bm-form-grid-gap">
            <div class="col-12 col-md-6">
              <label for="bm-settings-theme" class="form-label mb-1">ธีมของระบบ</label>
              <select id="bm-settings-theme" class="form-select form-select-sm">
                <option value="system">ตามระบบ</option>
                <option value="light">โหมดสว่าง (Light)</option>
                <option value="dark">โหมดมืด (Dark)</option>
              </select>
              <div id="bm-settings-theme-note" style="font-size:0.72rem;color:#6b7280;margin-top:2px;"></div>
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label mb-1">ล็อกหน้าจออัตโนมัติ</label>
              <div class="form-check form-switch mb-1" style="font-size:0.8rem;">
                <input class="form-check-input" type="checkbox" id="bm-settings-auto-lock-enable">
                <label class="form-check-label" for="bm-settings-auto-lock-enable">
                  เปิดใช้ Auto-lock เมื่อไม่มีการใช้งาน
                </label>
              </div>
              <div class="d-flex align-items-center gap-2">
                <span style="font-size:0.78rem;color:#6b7280;">เวลารอ:</span>
                <input type="number" id="bm-settings-auto-lock-minutes" class="form-control form-control-sm" style="width:90px;text-align:right;" min="1" max="120" step="1" value="10">
                <span style="font-size:0.78rem;color:#6b7280;">นาที</span>
              </div>
              <div id="bm-settings-auto-lock-label" style="font-size:0.72rem;color:#9ca3af;margin-top:2px;">
                จะใช้เวลาประมาณ 10 นาทีหลังไม่มีการขยับเมาส์/กดปุ่ม ก่อนให้ล็อกหน้าจอ (mock)
              </div>
            </div>
          </div>
        </div>

        <div class="bm-subpanel">
          <div class="bm-form-section-title" style="font-size:0.86rem;">ใบเสร็จ & ข้อความแจ้งลูกค้า</div>
          <div class="row g-2 bm-form-grid-gap">
            <div class="col-12">
              <label for="bm-settings-receipt-header" class="form-label mb-1">หัวใบเสร็จ / ข้อความด้านบน</label>
              <textarea id="bm-settings-receipt-header" rows="2" class="form-control form-control-sm" placeholder="เช่น ชื่อร้าน + คำอธิบายสั้นๆ"></textarea>
            </div>
            <div class="col-12">
              <label for="bm-settings-receipt-note" class="form-label mb-1">หมายเหตุใต้รายการ (เช่น กติกาการรับประกัน)</label>
              <textarea id="bm-settings-receipt-note" rows="2" class="form-control form-control-sm" placeholder="เช่น รับประกันงานซ่อม 7 วัน ไม่รวมอะไหล่สิ้นเปลือง เป็นต้น"></textarea>
            </div>
            <div class="col-12">
              <label for="bm-settings-receipt-footer" class="form-label mb-1">ข้อความปิดท้ายใบเสร็จ</label>
              <textarea id="bm-settings-receipt-footer" rows="2" class="form-control form-control-sm" placeholder="เช่น ขอบคุณที่ใช้บริการ หากมีปัญหาเพิ่มเติมสามารถติดต่อกลับได้ตลอดเวลาทำการ"></textarea>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-5">
        <div class="bm-subpanel mb-2">
          <div style="font-size:0.8rem;font-weight:600;margin-bottom:4px;">
            ตัวอย่างใบเสร็จ (ตัวหนังสือ)
          </div>
          <div id="bm-settings-receipt-preview" class="bm-scroll-y-soft" style="max-height:260px;overflow-y:auto;">
            <pre style="font-size:0.75rem;white-space:pre-wrap;margin-bottom:0;">ยังไม่มีข้อมูล ลองกรอกชื่อร้านและข้อความในส่วนใบเสร็จทางซ้าย ระบบจะอัปเดตตัวอย่างให้อัตโนมัติ</pre>
          </div>
          <div style="font-size:0.72rem;color:#9ca3af;margin-top:4px;">
            * ยังเป็นตัวอย่างแบบ Text Preview เท่านั้น (mock) – ในอนาคตสามารถใช้ข้อความชุดนี้ไปใช้ตอนพิมพ์ใบเสร็จจริง หรือส่งให้ลูกค้าทางแชตได้
          </div>
        </div>

        <div class="bm-subpanel">
          <div style="font-size:0.8rem;font-weight:600;margin-bottom:4px;">
            Backup / Export การตั้งค่า (Mock)
          </div>
          <div style="font-size:0.78rem;color:#4b5563;margin-bottom:4px;">
            เพื่อความสบายใจ สามารถกดดาวน์โหลดไฟล์การตั้งค่าร้านเก็บไว้เองได้ (ยังไม่ได้เชื่อม Firestore)
          </div>
          <div class="d-flex flex-wrap gap-2 mb-2">
            <button type="button" id="bm-settings-export-json" class="bm-btn-outline-soft">
              <i class="bi bi-filetype-json"></i>
              ดาวน์โหลดเป็น JSON
            </button>
            <button type="button" id="bm-settings-export-csv" class="bm-btn-outline-soft">
              <i class="bi bi-filetype-csv"></i>
              ดาวน์โหลดเป็น CSV
            </button>
          </div>
          <div style="font-size:0.72rem;color:#9ca3af;">
            ในอนาคตเมื่อเชื่อม Firebase แล้ว สามารถดึงไฟล์เหล่านี้ไป Import คืนเข้าระบบ เพื่อย้ายเครื่อง/ย้ายเบราว์เซอร์ได้ง่ายขึ้น
          </div>
        </div>
      </div>
    </div>

    <div class="d-flex flex-wrap justify-content-end gap-2 mt-2">
      <button type="button" id="bm-settings-reset-default" class="bm-btn-outline-soft">
        <i class="bi bi-arrow-counterclockwise"></i>
        คืนค่ามาตรฐาน
      </button>
      <button type="button" id="bm-settings-save" class="bm-btn-outline-soft bm-btn-primary-soft">
        <i class="bi bi-save2"></i>
        บันทึกการตั้งค่า
      </button>
    </div>
  `;
}

// ---------- DOM refs ----------

let shopNameInput;
let shopPhoneInput;
let shopLineInput;
let shopAddressInput;
let shopTaxIdInput;
let shopLogoUrlInput;

let themeSelect;
let themeNoteEl;

let autoLockEnableInput;
let autoLockMinutesInput;
let autoLockLabelEl;

let receiptHeaderInput;
let receiptNoteInput;
let receiptFooterInput;
let receiptPreviewEl;

let saveBtn;
let resetBtn;
let exportJsonBtn;
let exportCsvBtn;

function cacheDomRefs() {
  shopNameInput = $("#bm-settings-shop-name");
  shopPhoneInput = $("#bm-settings-shop-phone");
  shopLineInput = $("#bm-settings-shop-line");
  shopAddressInput = $("#bm-settings-shop-address");
  shopTaxIdInput = $("#bm-settings-shop-taxid");
  shopLogoUrlInput = $("#bm-settings-shop-logo-url");

  themeSelect = $("#bm-settings-theme");
  themeNoteEl = $("#bm-settings-theme-note");

  autoLockEnableInput = $("#bm-settings-auto-lock-enable");
  autoLockMinutesInput = $("#bm-settings-auto-lock-minutes");
  autoLockLabelEl = $("#bm-settings-auto-lock-label");

  receiptHeaderInput = $("#bm-settings-receipt-header");
  receiptNoteInput = $("#bm-settings-receipt-note");
  receiptFooterInput = $("#bm-settings-receipt-footer");
  receiptPreviewEl = $("#bm-settings-receipt-preview");

  saveBtn = $("#bm-settings-save");
  resetBtn = $("#bm-settings-reset-default");
  exportJsonBtn = $("#bm-settings-export-json");
  exportCsvBtn = $("#bm-settings-export-csv");
}

// ---------- Apply settings -> UI ----------

let currentSettings = structuredClone(defaultSettings);

function applySettingsToUI() {
  const s = currentSettings;

  if (shopNameInput) shopNameInput.value = s.shop.name || "";
  if (shopPhoneInput) shopPhoneInput.value = s.shop.phone || "";
  if (shopLineInput) shopLineInput.value = s.shop.line || "";
  if (shopAddressInput) shopAddressInput.value = s.shop.address || "";
  if (shopTaxIdInput) shopTaxIdInput.value = s.shop.taxId || "";
  if (shopLogoUrlInput) shopLogoUrlInput.value = s.shop.logoUrl || "";

  if (themeSelect) themeSelect.value = s.theme || "system";
  updateThemeNote();

  if (autoLockEnableInput)
    autoLockEnableInput.checked = !!s.autoLock.enabled;
  if (autoLockMinutesInput)
    autoLockMinutesInput.value = s.autoLock.minutes || 10;
  updateAutoLockLabel();

  if (receiptHeaderInput) receiptHeaderInput.value = s.receipt.header || "";
  if (receiptNoteInput) receiptNoteInput.value = s.receipt.note || "";
  if (receiptFooterInput) receiptFooterInput.value = s.receipt.footer || "";

  applyTheme(s.theme);
  updateReceiptPreview();
}

// ---------- UI -> settings ----------

function readSettingsFromUI() {
  const updated = structuredClone(currentSettings);

  if (shopNameInput) updated.shop.name = shopNameInput.value.trim();
  if (shopPhoneInput) updated.shop.phone = shopPhoneInput.value.trim();
  if (shopLineInput) updated.shop.line = shopLineInput.value.trim();
  if (shopAddressInput)
    updated.shop.address = shopAddressInput.value.trim();
  if (shopTaxIdInput) updated.shop.taxId = shopTaxIdInput.value.trim();
  if (shopLogoUrlInput)
    updated.shop.logoUrl = shopLogoUrlInput.value.trim();

  if (themeSelect) updated.theme = themeSelect.value || "system";

  if (autoLockEnableInput)
    updated.autoLock.enabled = !!autoLockEnableInput.checked;
  if (autoLockMinutesInput) {
    const val = parseInt(autoLockMinutesInput.value, 10);
    updated.autoLock.minutes =
      Number.isFinite(val) && val > 0 ? val : defaultSettings.autoLock.minutes;
  }

  if (receiptHeaderInput)
    updated.receipt.header = receiptHeaderInput.value.trim();
  if (receiptNoteInput)
    updated.receipt.note = receiptNoteInput.value.trim();
  if (receiptFooterInput)
    updated.receipt.footer = receiptFooterInput.value.trim();

  currentSettings = updated;
}

// ---------- Receipt preview ----------

function updateReceiptPreview() {
  if (!receiptPreviewEl) return;

  const shopName = shopNameInput?.value.trim() || defaultSettings.shop.name;
  const phone = shopPhoneInput?.value.trim() || "";
  const line = shopLineInput?.value.trim() || "";
  const address = shopAddressInput?.value.trim() || "";
  const taxId = shopTaxIdInput?.value.trim() || "";

  const header = receiptHeaderInput?.value.trim() || defaultSettings.receipt.header;
  const note = receiptNoteInput?.value.trim() || defaultSettings.receipt.note;
  const footer = receiptFooterInput?.value.trim() || defaultSettings.receipt.footer;

  const lines = [];

  lines.push(shopName);
  if (address) lines.push(address);
  if (phone || line) {
    const contactParts = [];
    if (phone) contactParts.push(`โทร ${phone}`);
    if (line) contactParts.push(`LINE ${line}`);
    lines.push(contactParts.join(" • "));
  }
  if (taxId) lines.push(`เลขประจำตัวผู้เสียภาษี: ${taxId}`);

  lines.push("================================");
  lines.push(header);
  lines.push("--------------------------------");
  lines.push("  (ตัวอย่างใบเสร็จ – แสดงเฉพาะหัว/ท้าย)");
  lines.push("  รายการงานซ่อม / อะไหล่จะแสดงจากหน้าเปิดบิลจริง");
  lines.push("--------------------------------");
  lines.push(note);
  lines.push("--------------------------------");
  lines.push(footer);
  lines.push("================================");
  lines.push("** ตัวอย่างจากหน้า 'ตั้งค่า' เบื้องต้นเท่านั้น **");

  receiptPreviewEl.innerHTML = `<pre style="font-size:0.75rem;white-space:pre-wrap;margin-bottom:0;">${lines.join(
    "\n"
  )}</pre>`;
}

// ---------- Theme note / Auto-lock label ----------

function updateThemeNote() {
  if (!themeNoteEl || !themeSelect) return;
  const val = themeSelect.value || "system";
  if (val === "system") {
    themeNoteEl.textContent =
      "ใช้ตามธีมของเครื่อง/เบราว์เซอร์: " + getSystemThemeLabel();
  } else if (val === "light") {
    themeNoteEl.textContent =
      "บังคับให้ใช้โหมดสว่างเสมอ เหมาะกับใช้หน้าร้านที่แสงเยอะ";
  } else {
    themeNoteEl.textContent =
      "บังคับให้ใช้โหมดมืด เหมาะกับใช้งานช่วงกลางคืน หรือหน้าจอในห้อง";
  }
}

function updateAutoLockLabel() {
  if (!autoLockLabelEl || !autoLockEnableInput || !autoLockMinutesInput) return;

  const enabled = autoLockEnableInput.checked;
  const val = parseInt(autoLockMinutesInput.value, 10);
  const minutes = Number.isFinite(val) && val > 0 ? val : 10;

  if (!enabled) {
    autoLockLabelEl.textContent =
      "ปิด Auto-lock (ไม่ล็อกหน้าจออัตโนมัติ – แนะนำให้เปิดถ้าใช้ที่หน้าร้าน)";
    autoLockLabelEl.style.color = "#9ca3af";
  } else {
    autoLockLabelEl.textContent =
      `จะล็อกหน้าจออัตโนมัติเมื่อไม่มีการใช้งานประมาณ ${minutes} นาที (mock, ไว้ให้ไฟล์อื่นมาเชื่อมเหตุการณ์จริง)`;
    autoLockLabelEl.style.color = "#6b7280";
  }
}

// ---------- Download helpers ----------

function downloadFile(filename, mimeType, content) {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.warn("Download error:", err);
    alert("ไม่สามารถดาวน์โหลดไฟล์ได้จากเบราว์เซอร์นี้");
  }
}

function exportSettingsJSON() {
  const json = JSON.stringify(currentSettings, null, 2);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `ben-motor-settings-${ts}.json`;
  downloadFile(filename, "application/json", json);
}

function exportSettingsCSV() {
  const rows = [];

  const s = currentSettings;
  rows.push(["section", "key", "value"].join(","));

  // shop
  rows.push(["shop", "name", `"${(s.shop.name || "").replace(/"/g, '""')}"`].join(","));
  rows.push(["shop", "phone", `"${(s.shop.phone || "").replace(/"/g, '""')}"`].join(","));
  rows.push(["shop", "line", `"${(s.shop.line || "").replace(/"/g, '""')}"`].join(","));
  rows.push([
    "shop",
    "address",
    `"${(s.shop.address || "").replace(/"/g, '""')}"`,
  ].join(","));
  rows.push(["shop", "taxId", `"${(s.shop.taxId || "").replace(/"/g, '""')}"`].join(","));
  rows.push([
    "shop",
    "logoUrl",
    `"${(s.shop.logoUrl || "").replace(/"/g, '""')}"`,
  ].join(","));

  // theme & autoLock
  rows.push(["system", "theme", `"${(s.theme || "").replace(/"/g, '""')}"`].join(","));
  rows.push([
    "system",
    "autoLock.enabled",
    s.autoLock.enabled ? "true" : "false",
  ].join(","));
  rows.push([
    "system",
    "autoLock.minutes",
    String(s.autoLock.minutes || 0),
  ].join(","));

  // receipt
  rows.push([
    "receipt",
    "header",
    `"${(s.receipt.header || "").replace(/"/g, '""')}"`,
  ].join(","));
  rows.push([
    "receipt",
    "note",
    `"${(s.receipt.note || "").replace(/"/g, '""')}"`,
  ].join(","));
  rows.push([
    "receipt",
    "footer",
    `"${(s.receipt.footer || "").replace(/"/g, '""')}"`,
  ].join(","));

  const csv = rows.join("\n");
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `ben-motor-settings-${ts}.csv`;
  downloadFile(filename, "text/csv", csv);
}

// ---------- Events ----------

function attachSettingsEvents() {
  if (themeSelect) {
    themeSelect.addEventListener("change", () => {
      updateThemeNote();
      readSettingsFromUI();
      applyTheme(currentSettings.theme);
      saveSettings(currentSettings);
    });
  }

  if (autoLockEnableInput) {
    autoLockEnableInput.addEventListener("change", () => {
      updateAutoLockLabel();
      readSettingsFromUI();
      saveSettings(currentSettings);
    });
  }

  if (autoLockMinutesInput) {
    autoLockMinutesInput.addEventListener("input", () => {
      updateAutoLockLabel();
      readSettingsFromUI();
      saveSettings(currentSettings);
    });
  }

  // อัปเดต preview ทันทีเมื่อแก้ข้อความใบเสร็จ / ข้อมูลร้านหลัก
  const previewFields = [
    shopNameInput,
    shopPhoneInput,
    shopLineInput,
    shopAddressInput,
    shopTaxIdInput,
    receiptHeaderInput,
    receiptNoteInput,
    receiptFooterInput
  ];
  previewFields.forEach((el) => {
    if (!el) return;
    el.addEventListener("input", () => {
      readSettingsFromUI();
      updateReceiptPreview();
      saveSettings(currentSettings);
    });
  });

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      readSettingsFromUI();
      saveSettings(currentSettings);
      applyTheme(currentSettings.theme);
      updateReceiptPreview();
      alert("บันทึกการตั้งค่าเรียบร้อยแล้ว (เก็บไว้ในเบราว์เซอร์เครื่องนี้)");
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      const ok = confirm(
        "ต้องการคืนค่าการตั้งค่ากลับเป็นค่าเริ่มต้นของระบบหรือไม่?\n(จะทับค่าเดิมทั้งหมดในหน้า \"ตั้งค่า\")"
      );
      if (!ok) return;
      currentSettings = structuredClone(defaultSettings);
      saveSettings(currentSettings);
      applySettingsToUI();
      alert("คืนค่าการตั้งค่าเป็นค่ามาตรฐานเรียบร้อยแล้ว");
    });
  }

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener("click", () => {
      readSettingsFromUI();
      exportSettingsJSON();
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", () => {
      readSettingsFromUI();
      exportSettingsCSV();
    });
  }
}

// ---------- Init ----------

function initSettingsPage() {
  const section = document.querySelector("#section-settings");
  if (!section) return;

  const cardBody = section.querySelector(".bm-card-body");
  if (!cardBody) return;

  buildSettingsLayout(cardBody);
  cacheDomRefs();

  currentSettings = loadSettings();
  applySettingsToUI();
  attachSettingsEvents();
}

document.addEventListener("DOMContentLoaded", initSettingsPage);