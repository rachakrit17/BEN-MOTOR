// js/stock.js
// จัดการหน้าสต็อก & อะไหล่ BEN MOTOR POS
// - แสดงรายการอะไหล่ทั้งหมดจาก demoStock (data-mock.js)
// - ฟิลเตอร์ค้นหาตามชื่อ/โค้ด/รุ่นรถ/หมวดหมู่
// - ฟิลเตอร์ดูเฉพาะของใกล้หมด / ตัวเดินเร็ว
// - สรุปยอดจำนวนรายการ, ของใกล้หมด, fast-moving

import { demoStock } from "./data-mock.js";

const $ = (selector) => document.querySelector(selector);

function formatCurrencyTHB(value) {
  const num = Number(value) || 0;
  return num.toLocaleString("th-TH") + " บาท";
}

function formatNumber(value) {
  const num = Number(value) || 0;
  return num.toLocaleString("th-TH");
}

function getStockLevel(item) {
  const qty = Number(item.qty) || 0;
  const minQty = Number(item.minQty) || 0;

  if (qty <= 0) return "out";
  if (qty <= minQty) return "low";
  return "ok";
}

function getStockLevelLabel(level) {
  switch (level) {
    case "out":
      return "หมดสต็อก";
    case "low":
      return "ใกล้หมด";
    case "ok":
      return "เพียงพอ";
    default:
      return "-";
  }
}

function getStockLevelBadgeClass(level) {
  switch (level) {
    case "out":
      return "bm-badge-status bm-badge-status-wait-pay";
    case "low":
      return "bm-badge-status bm-badge-status-waiting-parts";
    case "ok":
      return "bm-badge-status bm-badge-status-in-progress";
    default:
      return "bm-badge-status";
  }
}

function getFastMovingLabel(isFast) {
  return isFast ? "ตัวเดินเร็ว" : "ปกติ";
}

// ---------- State ----------
let allStock = demoStock.slice();
let filteredStock = allStock.slice();

// ---------- DOM refs ----------
let searchInput;
let categorySelect;
let fastFilterSelect; // all | fast | slow
let lowOnlyCheckbox;

let tableContainer;
let statTotalEl;
let statLowEl;
let statFastEl;

// ---------- Filter logic ----------
function applyStockFilters() {
  const searchText = (searchInput?.value || "").trim().toLowerCase();
  const categoryVal = categorySelect?.value || "all";
  const fastFilterVal = fastFilterSelect?.value || "all";
  const lowOnly = !!(lowOnlyCheckbox && lowOnlyCheckbox.checked);

  filteredStock = allStock.filter((item) => {
    // หมวดหมู่
    if (categoryVal !== "all" && item.category !== categoryVal) {
      return false;
    }

    // fast-moving
    if (fastFilterVal === "fast" && !item.isFastMoving) {
      return false;
    }
    if (fastFilterVal === "slow" && item.isFastMoving) {
      return false;
    }

    // ของใกล้หมด / หมด
    if (lowOnly) {
      const level = getStockLevel(item);
      if (!(level === "low" || level === "out")) {
        return false;
      }
    }

    // ค้นหาข้อความ
    if (searchText) {
      const fields = [
        item.code,
        item.name,
        item.category,
        item.location,
        ...(item.compatibleModels || [])
      ];
      const haystack = fields
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(searchText)) {
        return false;
      }
    }

    return true;
  });

  // เรียงหมวดหมู่ + ชื่อสินค้า
  filteredStock.sort((a, b) => {
    const ca = (a.category || "").localeCompare(b.category || ""); 
    if (ca !== 0) return ca;
    return (a.name || "").localeCompare(b.name || "");
  });

  renderStockTable();
}

function clearStockFilters() {
  if (searchInput) searchInput.value = "";
  if (categorySelect) categorySelect.value = "all";
  if (fastFilterSelect) fastFilterSelect.value = "all";
  if (lowOnlyCheckbox) lowOnlyCheckbox.checked = false;
  applyStockFilters();
}

// ---------- Render ----------

function renderStockTable() {
  if (!tableContainer) return;

  tableContainer.innerHTML = "";

  if (!filteredStock.length) {
    const div = document.createElement("div");
    div.className = "bm-placeholder";
    div.innerHTML = `
      ยังไม่มีรายการอะไหล่ที่ตรงกับเงื่อนไข
      <br>
      ลองล้างตัวกรอง หรือค้นหาด้วยคำอื่นอีกครั้ง
    `;
    tableContainer.appendChild(div);
    return;
  }

  const table = document.createElement("table");
  table.className = "bm-table bm-table-sm";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>รหัส / หมวด</th>
      <th>ชื่ออะไหล่</th>
      <th style="text-align:right;">จำนวน</th>
      <th style="text-align:right;">จุดสั่งซื้อ</th>
      <th>สถานะสต็อก</th>
      <th style="text-align:right;">ทุน/ขาย</th>
      <th style="text-align:right;">กำไรต่อหน่วย</th>
      <th>หมายเหตุ</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  filteredStock.forEach((item) => {
    const tr = document.createElement("tr");
    tr.className = "bm-clickable-row";

    const level = getStockLevel(item);
    const levelLabel = getStockLevelLabel(level);
    const levelClass = getStockLevelBadgeClass(level);

    const isFast = !!item.isFastMoving;
    const fastLabel = getFastMovingLabel(isFast);

    const qty = Number(item.qty) || 0;
    const minQty = Number(item.minQty) || 0;
    const cost = Number(item.costPrice) || 0;
    const sale = Number(item.salePrice) || 0;
    const profit = Math.max(sale - cost, 0);
    const margin = sale > 0 ? (profit / sale) * 100 : 0;

    const models = (item.compatibleModels || []).join(", ");

    tr.innerHTML = `
      <td style="font-size:0.78rem;">
        <div><strong>${item.code || "-"}</strong></div>
        <div style="font-size:0.7rem;color:#6b7280;">
          ${item.category || "ไม่ระบุหมวดหมู่"}
        </div>
      </td>
      <td style="font-size:0.78rem;">
        <div class="bm-text-ellipsis" style="max-width:200px;">
          ${item.name || "-"}
        </div>
        <div style="font-size:0.7rem;color:#6b7280;">
          ${item.location ? `เก็บที่: ${item.location}` : ""}
        </div>
      </td>
      <td style="text-align:right;font-size:0.78rem;">
        <strong>${formatNumber(qty)}</strong>
        <div style="font-size:0.7rem;color:#6b7280;">
          หน่วย: ${item.unit || "-"}
        </div>
      </td>
      <td style="text-align:right;font-size:0.78rem;">
        ${formatNumber(minQty)}
      </td>
      <td style="font-size:0.78rem;">
        <span class="${levelClass}">
          <span class="bm-dot ${
            level === "out"
              ? "bm-dot-danger"
              : level === "low"
              ? "bm-dot-warning"
              : "bm-dot-success"
          }"></span>
          <span>${levelLabel}</span>
        </span>
      </td>
      <td style="text-align:right;font-size:0.78rem;">
        <div>ทุน: ${formatNumber(cost)}</div>
        <div style="font-size:0.7rem;color:#6b7280;">
          ขาย: ${formatNumber(sale)}
        </div>
      </td>
      <td style="text-align:right;font-size:0.78rem;">
        <div><strong>${formatNumber(profit)}</strong></div>
        <div style="font-size:0.7rem;color:#6b7280;">
          ${margin.toFixed(0)}%
        </div>
      </td>
      <td style="font-size:0.74rem;">
        ${
          isFast
            ? `<span class="bm-pill bm-pill-primary">${fastLabel}</span>`
            : `<span class="bm-pill bm-pill-soft">${fastLabel}</span>`
        }
        ${
          models
            ? `<div style="font-size:0.7rem;color:#6b7280;margin-top:2px;">รุ่นที่ใช้ร่วมได้: ${models}</div>`
            : ""
        }
      </td>
    `;

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  tableContainer.appendChild(table);
}

// ---------- Stats summary ----------
function renderStockStats() {
  if (!statTotalEl && !statLowEl && !statFastEl) return;

  const totalCount = allStock.length;
  const lowCount = allStock.filter((item) => {
    const level = getStockLevel(item);
    return level === "low" || level === "out";
  }).length;
  const fastCount = allStock.filter((item) => item.isFastMoving).length;

  if (statTotalEl) statTotalEl.textContent = formatNumber(totalCount);
  if (statLowEl) statLowEl.textContent = formatNumber(lowCount);
  if (statFastEl) statFastEl.textContent = formatNumber(fastCount);
}

// ---------- Category select ----------
function populateCategoryOptions() {
  if (!categorySelect) return;

  // ถ้า select มี option อยู่แล้วมากกว่า 1 (เช่น html ใส่มาเอง) จะไม่ไปยุ่ง
  if (categorySelect.options.length > 1) return;

  const categories = Array.from(
    new Set(
      allStock
        .map((item) => item.category)
        .filter((c) => typeof c === "string" && c.trim() !== "")
    )
  ).sort((a, b) => a.localeCompare(b));

  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });
}

// ---------- Init ----------
function initStockPage() {
  const section = $("#section-stock");
  if (!section) return;

  // mapping DOM ids (ถ้ายังไม่มีใน HTML จะเป็น null แล้วโค้ดจะข้ามเอง)
  searchInput = $("#bm-stock-search");
  categorySelect = $("#bm-stock-category");
  fastFilterSelect = $("#bm-stock-fast-filter");
  lowOnlyCheckbox = $("#bm-stock-low-only");

  tableContainer = $("#bm-stock-table-container");
  statTotalEl = $("#bm-stock-stat-total");
  statLowEl = $("#bm-stock-stat-low");
  statFastEl = $("#bm-stock-stat-fast");

  // เติม options หมวดหมู่ถ้า select มีอยู่
  populateCategoryOptions();

  // Events
  if (searchInput) {
    searchInput.addEventListener("input", applyStockFilters);
  }
  if (categorySelect) {
    categorySelect.addEventListener("change", applyStockFilters);
  }
  if (fastFilterSelect) {
    fastFilterSelect.addEventListener("change", applyStockFilters);
  }
  if (lowOnlyCheckbox) {
    lowOnlyCheckbox.addEventListener("change", applyStockFilters);
  }

  // ปุ่มล้างฟิลเตอร์ (ถ้ามี)
  const clearBtn = $("#bm-stock-clear-filter");
  if (clearBtn) {
    clearBtn.addEventListener("click", clearStockFilters);
  }

  renderStockStats();
  applyStockFilters();
}

document.addEventListener("DOMContentLoaded", initStockPage);