// js/customers.js
// จัดการหน้าลูกค้า & รถลูกค้า ของ BEN MOTOR POS
// - ใช้ demoCustomers จาก data-mock.js
// - ฟิลเตอร์ค้นหาตามชื่อ/เบอร์/ทะเบียน/รุ่นรถ
// - ฟิลเตอร์ตามประเภทลูกค้า (ลูกค้าประจำ / ขาจร / อื่น ๆ)
// - แสดงสรุปจำนวนลูกค้า, ลูกค้าประจำ, จำนวนรถทั้งหมด
// - แสดงรายละเอียดลูกค้า/รถฝั่งขวา เมื่อคลิกรายการฝั่งซ้าย

import { demoCustomers } from "./data-mock.js";

const $ = (selector) => document.querySelector(selector);

// ---------- Helpers ----------

function formatNumber(value) {
  const num = Number(value) || 0;
  return num.toLocaleString("th-TH");
}

function formatDateShort(isoString) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "2-digit"
  });
}

function calcNextServiceDate(lastServiceAt) {
  if (!lastServiceAt) return null;
  const d = new Date(lastServiceAt);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + 90); // สมมติเตือนทุก 3 เดือน
  return d;
}

function formatNextServiceText(lastServiceAt) {
  const next = calcNextServiceDate(lastServiceAt);
  if (!next) return "-";

  const today = new Date();
  const diffMs = next.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const dateText = formatDateShort(next.toISOString());

  if (diffDays < 0) {
    return `${dateText} (เลยกำหนดแล้ว ${Math.abs(diffDays)} วัน)`;
  }
  if (diffDays === 0) {
    return `${dateText} (ครบกำหนดวันนี้)`;
  }
  if (diffDays <= 7) {
    return `${dateText} (อีก ${diffDays} วัน)`;
  }
  return dateText;
}

function isRegularCustomer(c) {
  return (c.type || "").includes("ลูกค้าประจำ");
}

function isOneTimeCustomer(c) {
  return (c.type || "").includes("ขาจร");
}

// ---------- State ----------
let allCustomers = demoCustomers.slice();
let filteredCustomers = allCustomers.slice();
let selectedCustomerId = null;

// ---------- DOM refs ----------
let searchInput;
let typeSelect;
let clearFilterBtn;

let listContainer;
let detailContainer;

let statTotalEl;
let statRegularEl;
let statVehiclesEl;

// ---------- Layout builder (สร้าง UI ภายใน section-customers) ----------

function buildCustomersLayout(cardBody) {
  cardBody.innerHTML = `
    <div class="bm-form-section-title">ลูกค้า & รถลูกค้า</div>
    <div class="bm-form-section-subtitle">
      ดูลูกค้าประจำ, ลูกค้าขาจร และรถที่คุณดูแลอยู่ทั้งหมดในระบบ BEN MOTOR
    </div>

    <div class="row g-2 g-md-3 align-items-end mb-2">
      <div class="col-12 col-md-5">
        <label for="bm-customers-search" class="form-label mb-1">ค้นหาลูกค้า / รถ</label>
        <input
          type="text"
          id="bm-customers-search"
          class="form-control form-control-sm"
          placeholder="พิมพ์ชื่อ, เบอร์โทร, ทะเบียน, รุ่นรถ"
        >
      </div>
      <div class="col-6 col-md-3">
        <label for="bm-customers-filter-type" class="form-label mb-1">กรองตามประเภทลูกค้า</label>
        <select id="bm-customers-filter-type" class="form-select form-select-sm">
          <option value="all">ลูกค้าทั้งหมด</option>
          <option value="regular">ลูกค้าประจำ</option>
          <option value="once">ลูกค้าขาจร</option>
          <option value="other">ประเภทอื่น ๆ</option>
        </select>
      </div>
      <div class="col-6 col-md-2">
        <button
          type="button"
          id="bm-customers-clear-filter"
          class="bm-btn-outline-soft w-100"
          style="margin-top:1.6rem;"
        >
          <i class="bi bi-x-circle"></i>
          ล้างตัวกรอง
        </button>
      </div>
    </div>

    <div class="row g-2 g-md-3 mb-2">
      <div class="col-4 col-md-3 col-lg-2">
        <div class="bm-subpanel text-center">
          <div style="font-size:0.7rem;color:#6b7280;">ลูกค้าทั้งหมด</div>
          <div id="bm-customers-stat-total" style="font-size:1.1rem;font-weight:700;">0</div>
        </div>
      </div>
      <div class="col-4 col-md-3 col-lg-2">
        <div class="bm-subpanel text-center">
          <div style="font-size:0.7rem;color:#6b7280;">ลูกค้าประจำ</div>
          <div id="bm-customers-stat-regular" style="font-size:1.1rem;font-weight:700;">0</div>
        </div>
      </div>
      <div class="col-4 col-md-3 col-lg-2">
        <div class="bm-subpanel text-center">
          <div style="font-size:0.7rem;color:#6b7280;">จำนวนรถทั้งหมด</div>
          <div id="bm-customers-stat-vehicles" style="font-size:1.1rem;font-weight:700;">0</div>
        </div>
      </div>
    </div>

    <div class="row g-2 g-md-3">
      <div class="col-12 col-lg-6">
        <div class="bm-subpanel" style="max-height:420px;overflow-y:auto;" id="bm-customers-list-wrapper">
          <div style="font-size:0.78rem;color:#6b7280;margin-bottom:6px;">
            รายชื่อลูกค้า
          </div>
          <div id="bm-customers-list" class="bm-scroll-y-soft"></div>
        </div>
      </div>
      <div class="col-12 col-lg-6">
        <div class="bm-subpanel" id="bm-customers-detail">
          <div style="font-size:0.78rem;color:#6b7280;margin-bottom:4px;">
            รายละเอียดลูกค้า / รถ
          </div>
          <div style="font-size:0.8rem;color:#9ca3af;">
            เลือกลูกค้าด้านซ้ายเพื่อดูรายละเอียด และประวัติรถคันที่ดูแลอยู่
          </div>
        </div>
      </div>
    </div>
  `;
}

// ---------- Stats ----------

function renderCustomerStats() {
  if (!statTotalEl && !statRegularEl && !statVehiclesEl) return;

  const total = allCustomers.length;
  const regular = allCustomers.filter((c) => isRegularCustomer(c)).length;
  const vehicles = allCustomers.reduce((sum, c) => {
    return sum + (Array.isArray(c.vehicles) ? c.vehicles.length : 0);
  }, 0);

  if (statTotalEl) statTotalEl.textContent = formatNumber(total);
  if (statRegularEl) statRegularEl.textContent = formatNumber(regular);
  if (statVehiclesEl) statVehiclesEl.textContent = formatNumber(vehicles);
}

// ---------- Filter ----------

function applyCustomerFilters() {
  const searchText = (searchInput?.value || "").trim().toLowerCase();
  const typeFilter = typeSelect?.value || "all";

  filteredCustomers = allCustomers.filter((c) => {
    // ประเภทลูกค้า
    if (typeFilter === "regular" && !isRegularCustomer(c)) {
      return false;
    }
    if (typeFilter === "once" && !isOneTimeCustomer(c)) {
      return false;
    }
    if (typeFilter === "other" && (isRegularCustomer(c) || isOneTimeCustomer(c))) {
      return false;
    }

    // ค้นหาข้อความ
    if (searchText) {
      const vehicleTexts = (c.vehicles || []).map((v) =>
        [v.plate, v.model, v.color, v.province].filter(Boolean).join(" ")
      );
      const haystack = [
        c.name,
        c.phone,
        c.lineId,
        c.type,
        ...(c.tags || []),
        ...vehicleTexts
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(searchText)) {
        return false;
      }
    }

    return true;
  });

  // เรียงตามลูกค้าประจำก่อน + ชื่อตัวอักษร
  filteredCustomers.sort((a, b) => {
    const ra = isRegularCustomer(a) ? 1 : 0;
    const rb = isRegularCustomer(b) ? 1 : 0;
    if (ra !== rb) return rb - ra;
    return (a.name || "").localeCompare(b.name || ""); 
  });

  // ถ้าลูกค้าที่เลือกอยู่ไม่ ติดใน filtered แล้ว ให้เลือกตัวแรกแทน
  if (!filteredCustomers.find((c) => c.id === selectedCustomerId)) {
    selectedCustomerId = filteredCustomers[0]?.id || null;
  }

  renderCustomerList();
  renderCustomerDetail();
}

function clearCustomerFilters() {
  if (searchInput) searchInput.value = "";
  if (typeSelect) typeSelect.value = "all";
  applyCustomerFilters();
}

// ---------- Render list (ซ้าย) ----------

function renderCustomerList() {
  if (!listContainer) return;

  listContainer.innerHTML = "";

  if (!filteredCustomers.length) {
    const div = document.createElement("div");
    div.className = "bm-placeholder";
    div.innerHTML = `
      ยังไม่มีลูกค้าที่ตรงกับเงื่อนไข
      <br>
      ลองล้างตัวกรอง หรือค้นหาด้วยคำอื่นอีกครั้ง
    `;
    listContainer.appendChild(div);
    return;
  }

  filteredCustomers.forEach((c) => {
    const card = document.createElement("div");
    card.className = "bm-card mb-2 bm-customer-card";
    card.dataset.customerId = c.id || "";

    const isSelected = c.id === selectedCustomerId;
    if (isSelected) {
      card.style.borderColor = "rgba(19, 179, 139, 0.7)";
      card.style.boxShadow = "0 0 0 1px rgba(19, 179, 139, 0.5)";
    }

    const typeLabel = c.type || "ไม่ระบุประเภท";
    const tags = (c.tags || []).join(" • ");
    const vehiclesCount = Array.isArray(c.vehicles) ? c.vehicles.length : 0;
    const firstVehicle = (c.vehicles || [])[0] || null;

    let vehicleLine = "";
    if (firstVehicle) {
      const plate = firstVehicle.plate || "";
      const model = firstVehicle.model || "";
      const province = firstVehicle.province || "";
      const color = firstVehicle.color || "";
      vehicleLine = [
        plate ? `ทะเบียน ${plate}` : "",
        province,
        model,
        color
      ]
        .filter(Boolean)
        .join(" • ");
    }

    card.innerHTML = `
      <div class="bm-card-body">
        <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
          <div>
            <div style="font-size:0.86rem;font-weight:600;" class="bm-text-ellipsis" title="${c.name || ""}">
              ${c.name || "-"}
            </div>
            <div style="font-size:0.74rem;color:#6b7280;">
              ${c.phone || ""} ${c.lineId ? "• LINE: " + c.lineId : ""}
            </div>
          </div>
          <div style="text-align:right;">
            <span class="bm-pill ${
              isRegularCustomer(c) ? "bm-pill-primary" : "bm-pill-soft"
            }" style="font-size:0.7rem;">
              ${typeLabel}
            </span>
            ${
              vehiclesCount
                ? `<div style="font-size:0.7rem;color:#6b7280;margin-top:2px;">
                    รถที่ดูแลอยู่ ${vehiclesCount} คัน
                  </div>`
                : ""
            }
          </div>
        </div>
        ${
          vehicleLine
            ? `<div style="font-size:0.74rem;color:#4b5563;" class="bm-text-ellipsis" title="${vehicleLine}">
                ${vehicleLine}
              </div>`
            : ""
        }
        <div style="font-size:0.72rem;color:#6b7280;margin-top:4px;">
          ${
            tags
              ? `<span class="bm-tag"><i class="bi bi-stars"></i>${tags}</span>`
              : `<span class="bm-text-muted">ยังไม่มีแท็กลูกค้าพิเศษ</span>`
          }
        </div>
      </div>
    `;

    listContainer.appendChild(card);
  });
}

// ---------- Render detail (ขวา) ----------

function renderCustomerDetail() {
  if (!detailContainer) return;

  const customer = filteredCustomers.find((c) => c.id === selectedCustomerId);
  if (!customer) {
    detailContainer.innerHTML = `
      <div style="font-size:0.78rem;color:#6b7280;margin-bottom:4px;">
        รายละเอียดลูกค้า / รถ
      </div>
      <div style="font-size:0.8rem;color:#9ca3af;">
        เลือกลูกค้าด้านซ้ายเพื่อดูรายละเอียด และประวัติรถคันที่ดูแลอยู่
      </div>
    `;
    return;
  }

  const vehicles = customer.vehicles || [];
  const tags = (customer.tags || []).join(" • ");

  const vehicleCards = vehicles
    .map((v) => {
      const lastService = v.lastServiceAt
        ? formatDateShort(v.lastServiceAt)
        : "-";
      const nextServiceText = formatNextServiceText(v.lastServiceAt);

      const plate = v.plate || "";
      const plateLine = plate
        ? `ทะเบียน ${plate} ${v.province ? "• " + v.province : ""}`
        : "";

      return `
        <div class="bm-subpanel mb-2">
          <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
            <div>
              <div style="font-size:0.84rem;font-weight:600;">
                ${v.model || "ไม่ระบุรุ่นรถ"}
              </div>
              ${
                plateLine
                  ? `<div style="font-size:0.74rem;color:#6b7280;">${plateLine}</div>`
                  : ""
              }
              ${
                v.color
                  ? `<div style="font-size:0.74rem;color:#6b7280;">สี: ${v.color}</div>`
                  : ""
              }
            </div>
            <div style="text-align:right;">
              ${
                v.favorite
                  ? `<span class="bm-pill bm-pill-primary" style="font-size:0.7rem;">
                      รถประจำ / ใช้บ่อย
                    </span>`
                  : `<span class="bm-pill bm-pill-soft" style="font-size:0.7rem;">
                      รถในประวัติ
                    </span>`
              }
            </div>
          </div>
          <div style="font-size:0.76rem;color:#4b5563;">
            <div>เซอร์วิสล่าสุด: <strong>${lastService}</strong></div>
            <div>แนะนำให้เรียกลูกค้าเข้ามาเช็กอีกที: <strong>${nextServiceText}</strong></div>
          </div>
          ${
            v.note
              ? `<div style="font-size:0.74rem;color:#6b7280;margin-top:4px;">
                  โน้ตเกี่ยวกับรถคันนี้: ${v.note}
                </div>`
              : ""
          }
        </div>
      `;
    })
    .join("");

  detailContainer.innerHTML = `
    <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
      <div>
        <div style="font-size:0.9rem;font-weight:700;">
          ${customer.name || "-"}
        </div>
        <div style="font-size:0.78rem;color:#6b7280;">
          ${customer.phone || ""} ${
    customer.lineId ? "• LINE: " + customer.lineId : ""
  }
        </div>
        <div style="font-size:0.76rem;color:#6b7280;margin-top:2px;">
          ประเภท: ${customer.type || "ไม่ระบุ"}
        </div>
      </div>
      <div style="text-align:right;">
        ${
          tags
            ? `<div style="font-size:0.74rem;color:#6b7280;">
                แท็กลูกค้า:
              </div>
              <div style="font-size:0.76rem;color:#4b5563;">
                ${tags}
              </div>`
            : `<div class="bm-text-muted" style="font-size:0.74rem;">
                ยังไม่มีแท็กลูกค้าพิเศษ
              </div>`
        }
      </div>
    </div>

    ${
      customer.notes
        ? `<div class="bm-subpanel mb-2" style="font-size:0.78rem;">
            <div style="font-weight:600;margin-bottom:2px;">โน้ตเกี่ยวกับลูกค้าคนนี้</div>
            <div style="color:#4b5563;">${customer.notes}</div>
          </div>`
        : ""
    }

    <div style="font-size:0.8rem;font-weight:600;margin-bottom:4px;">
      รถที่อยู่ในประวัติของลูกค้าคนนี้ (${vehicles.length} คัน)
    </div>

    ${
      vehicles.length
        ? vehicleCards
        : `<div class="bm-text-muted" style="font-size:0.78rem;">
            ยังไม่มีรถในประวัติลูกค้าคนนี้
          </div>`
    }
  `;

  // อัปเดต highlight รายการฝั่งซ้าย
  if (listContainer) {
    const cards = listContainer.querySelectorAll(".bm-customer-card");
    cards.forEach((card) => {
      const id = card.dataset.customerId;
      if (id === customer.id) {
        card.style.borderColor = "rgba(19, 179, 139, 0.7)";
        card.style.boxShadow = "0 0 0 1px rgba(19, 179, 139, 0.5)";
      } else {
        card.style.borderColor = "rgba(229, 231, 235, 0.9)";
        card.style.boxShadow = "";
      }
    });
  }
}

// ---------- Events ----------

function handleListClick(event) {
  const card = event.target.closest(".bm-customer-card");
  if (!card) return;
  const id = card.dataset.customerId;
  if (!id) return;

  selectedCustomerId = id;
  renderCustomerDetail();
}

function attachCustomerEvents() {
  if (searchInput) {
    searchInput.addEventListener("input", applyCustomerFilters);
  }
  if (typeSelect) {
    typeSelect.addEventListener("change", applyCustomerFilters);
  }
  if (clearFilterBtn) {
    clearFilterBtn.addEventListener("click", clearCustomerFilters);
  }
  if (listContainer) {
    listContainer.addEventListener("click", handleListClick);
  }
}

// ---------- Cache DOM refs ----------

function cacheDomRefs() {
  searchInput = $("#bm-customers-search");
  typeSelect = $("#bm-customers-filter-type");
  clearFilterBtn = $("#bm-customers-clear-filter");

  listContainer = $("#bm-customers-list");
  detailContainer = $("#bm-customers-detail");

  statTotalEl = $("#bm-customers-stat-total");
  statRegularEl = $("#bm-customers-stat-regular");
  statVehiclesEl = $("#bm-customers-stat-vehicles");
}

// ---------- Init ----------

function initCustomersPage() {
  const section = $("#section-customers");
  if (!section) return;

  const cardBody = section.querySelector(".bm-card-body");
  if (!cardBody) return;

  buildCustomersLayout(cardBody);
  cacheDomRefs();
  renderCustomerStats();
  selectedCustomerId = allCustomers[0]?.id || null;
  applyCustomerFilters();
  attachCustomerEvents();
}

document.addEventListener("DOMContentLoaded", initCustomersPage);