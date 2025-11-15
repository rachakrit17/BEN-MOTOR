// js/jobs.js
// จัดการหน้ารายการงานซ่อมของ BEN MOTOR POS
// - ใช้ demoJobs จาก data-mock.js มาแสดงผลแบบ Table / Card
// - รองรับค้นหา + ตัวกรองสถานะ + ช่วงวันที่เริ่มงาน
// - ใช้สไตล์จาก css/style.css (bm-table, bm-badge-status ฯลฯ)

import {
  JOB_STATUS,
  JOB_PRIORITY,
  demoJobs
} from "./data-mock.js";

// ---------- Helper ----------
const $ = (selector) => document.querySelector(selector);

function formatCurrencyTHB(value) {
  const num = Number(value) || 0;
  return num.toLocaleString("th-TH") + " บาท";
}

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

function formatTimeShort(isoString) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function getStatusLabel(status) {
  switch (status) {
    case JOB_STATUS.QUEUE:
      return "รอรับเข้า";
    case JOB_STATUS.IN_PROGRESS:
      return "กำลังซ่อม";
    case JOB_STATUS.WAITING_PARTS:
      return "รออะไหล่";
    case JOB_STATUS.WAIT_PAY:
      return "รอชำระเงิน";
    case JOB_STATUS.DONE:
      return "เสร็จแล้ว";
    default:
      return status || "-";
  }
}

function getStatusBadgeClass(status) {
  switch (status) {
    case JOB_STATUS.QUEUE:
      return "bm-badge-status-queue";
    case JOB_STATUS.IN_PROGRESS:
      return "bm-badge-status-in-progress";
    case JOB_STATUS.WAITING_PARTS:
      return "bm-badge-status-waiting-parts";
    case JOB_STATUS.WAIT_PAY:
      return "bm-badge-status-wait-pay";
    case JOB_STATUS.DONE:
      return "bm-badge-status-done";
    default:
      return "";
  }
}

function getPriorityLabel(priority) {
  switch (priority) {
    case JOB_PRIORITY.URGENT:
      return "ด่วนมาก";
    case JOB_PRIORITY.HIGH:
      return "ด่วน";
    case JOB_PRIORITY.NORMAL:
      return "ปกติ";
    case JOB_PRIORITY.LOW:
      return "ไม่รีบ";
    default:
      return "ไม่ระบุ";
  }
}

function getPriorityDotClass(priority) {
  switch (priority) {
    case JOB_PRIORITY.URGENT:
      return "bm-dot-danger";
    case JOB_PRIORITY.HIGH:
      return "bm-dot-warning";
    case JOB_PRIORITY.NORMAL:
      return "bm-dot-success";
    case JOB_PRIORITY.LOW:
      return "bm-dot-muted";
    default:
      return "bm-dot-muted";
  }
}

function parseDateOnly(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ---------- State ----------
let allJobs = demoJobs.slice();
let filteredJobs = allJobs.slice();
let currentView = "table"; // "table" | "card"

// ---------- DOM refs ----------
let searchInput;
let statusSelect;
let dateFromInput;
let dateToInput;
let clearFilterBtn;
let applyFilterBtn;
let viewTableBtn;
let viewCardBtn;
let tableContainer;
let cardContainer;

// ---------- Filter logic ----------
function applyFilters() {
  const searchText = (searchInput?.value || "").trim().toLowerCase();
  const statusFilter = statusSelect?.value || "all";
  const dateFromVal = dateFromInput?.value || "";
  const dateToVal = dateToInput?.value || "";

  let fromTime = null;
  let toTime = null;

  if (dateFromVal) {
    fromTime = new Date(dateFromVal + "T00:00:00").getTime();
  }
  if (dateToVal) {
    toTime = new Date(dateToVal + "T23:59:59").getTime();
  }

  filteredJobs = allJobs.filter((job) => {
    // สถานะ
    if (statusFilter !== "all" && job.status !== statusFilter) {
      return false;
    }

    // ช่วงวันที่เริ่มงาน
    if (fromTime !== null || toTime !== null) {
      const jobTime = job.createdAt
        ? new Date(job.createdAt).getTime()
        : null;

      if (jobTime === null) {
        return false;
      }

      if (fromTime !== null && jobTime < fromTime) {
        return false;
      }
      if (toTime !== null && jobTime > toTime) {
        return false;
      }
    }

    // ข้อความค้นหา
    if (searchText) {
      const fields = [
        job.plate,
        job.province,
        job.customerName,
        job.customerPhone,
        job.vehicleModel,
        job.vehicleColor,
        job.id
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

  // เรียงจากงานล่าสุดไปเก่า (ตาม createdAt)
  filteredJobs.sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime();
    const tb = new Date(b.createdAt || 0).getTime();
    return tb - ta;
  });

  renderJobsView();
}

function clearFilters() {
  if (searchInput) searchInput.value = "";
  if (statusSelect) statusSelect.value = "all";
  if (dateFromInput) dateFromInput.value = "";
  if (dateToInput) dateToInput.value = "";
  applyFilters();
}

// ---------- Render Table ----------
function renderJobsTable() {
  if (!tableContainer) return;

  tableContainer.innerHTML = "";

  if (!filteredJobs.length) {
    const div = document.createElement("div");
    div.className = "bm-placeholder";
    div.innerHTML = `
      ไม่พบงานซ่อมตามเงื่อนไขที่เลือก
      <br>
      ลองเปลี่ยนตัวกรอง หรือคลิกล้างตัวกรองดูอีกครั้ง
    `;
    tableContainer.appendChild(div);
    return;
  }

  const table = document.createElement("table");
  table.className = "bm-table bm-table-sm";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>เวลาเริ่ม</th>
      <th>บิล</th>
      <th>ทะเบียน</th>
      <th>ลูกค้า</th>
      <th>รถ</th>
      <th>ยอดรวม</th>
      <th>สถานะ</th>
      <th>ความสำคัญ</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  filteredJobs.forEach((job) => {
    const tr = document.createElement("tr");
    tr.className = "bm-clickable-row";

    const total = (Number(job.totalLabor) || 0) + (Number(job.totalParts) || 0);
    const dateStr = formatDateShort(job.createdAt);
    const timeStr = formatTimeShort(job.createdAt);
    const statusLabel = getStatusLabel(job.status);
    const statusClass = getStatusBadgeClass(job.status);
    const priorityLabel = getPriorityLabel(job.priority);
    const priorityDotClass = getPriorityDotClass(job.priority);

    tr.innerHTML = `
      <td>
        <div style="font-size:0.78rem;">${timeStr}</div>
        <div style="font-size:0.7rem;color:#6b7280;">${dateStr}</div>
      </td>
      <td style="font-size:0.78rem;">
        <strong>${job.id || "-"}</strong>
      </td>
      <td style="font-size:0.78rem;">
        <div>${job.plate || "-"}</div>
        <div style="font-size:0.7rem;color:#6b7280;">${job.province || ""}</div>
      </td>
      <td style="font-size:0.78rem;">
        <div class="bm-text-ellipsis" style="max-width:120px;">
          ${job.customerName || "-"}
        </div>
        <div style="font-size:0.7rem;color:#6b7280;">
          ${job.customerPhone || ""}
        </div>
      </td>
      <td style="font-size:0.78rem;">
        <div class="bm-text-ellipsis" style="max-width:140px;">
          ${job.vehicleModel || "-"}
        </div>
        <div style="font-size:0.7rem;color:#6b7280;">
          ${job.vehicleColor || ""}
        </div>
      </td>
      <td style="font-size:0.78rem;text-align:right;">
        <strong>${formatCurrencyTHB(total)}</strong>
        <div style="font-size:0.7rem;color:#6b7280;">
          แรง: ${formatNumber(job.totalLabor || 0)} / อะไหล่: ${formatNumber(job.totalParts || 0)}
        </div>
      </td>
      <td style="font-size:0.78rem;">
        <span class="bm-badge-status ${statusClass}">
          <span class="bm-dot ${priorityDotClass}"></span>
          <span>${statusLabel}</span>
        </span>
      </td>
      <td style="font-size:0.78rem;">
        <span class="bm-pill bm-pill-soft">
          ${priorityLabel}
        </span>
      </td>
    `;

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  tableContainer.appendChild(table);
}

// ---------- Render Cards ----------
function renderJobsCards() {
  if (!cardContainer) return;

  cardContainer.innerHTML = "";

  if (!filteredJobs.length) {
    const div = document.createElement("div");
    div.className = "bm-placeholder";
    div.innerHTML = `
      ไม่พบงานซ่อมตามเงื่อนไขที่เลือก
      <br>
      ลองเปลี่ยนตัวกรอง หรือคลิกล้างตัวกรองดูอีกครั้ง
    `;
    cardContainer.appendChild(div);
    return;
  }

  const row = document.createElement("div");
  row.className = "row g-2 g-md-3 bm-grid-gap";

  filteredJobs.forEach((job) => {
    const col = document.createElement("div");
    col.className = "col-12 col-md-6";

    const card = document.createElement("div");
    card.className = "bm-card";
    const total = (Number(job.totalLabor) || 0) + (Number(job.totalParts) || 0);
    const dateStr = formatDateShort(job.createdAt);
    const timeStr = formatTimeShort(job.createdAt);
    const statusLabel = getStatusLabel(job.status);
    const statusClass = getStatusBadgeClass(job.status);
    const priorityLabel = getPriorityLabel(job.priority);
    const priorityDotClass = getPriorityDotClass(job.priority);

    const tags = (job.tags || []).slice(0, 3).join(" • ");

    card.innerHTML = `
      <div class="bm-card-body">
        <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
          <div>
            <div style="font-size:0.84rem;font-weight:600;">
              ${job.plate || "-"}
              ${
                job.vehicleModel
                  ? `<span style="color:#6b7280;font-weight:400;"> • ${job.vehicleModel}</span>`
                  : ""
              }
            </div>
            <div style="font-size:0.74rem;color:#6b7280;">
              ${job.customerName || "ไม่ระบุชื่อลูกค้า"}
              ${job.customerPhone ? ` • ${job.customerPhone}` : ""}
            </div>
          </div>
          <div style="text-align:right;">
            <div class="bm-badge-status ${statusClass}">
              <span class="bm-dot ${priorityDotClass}"></span>
              <span>${statusLabel}</span>
            </div>
            <div style="font-size:0.7rem;color:#6b7280;margin-top:2px;">
              ${priorityLabel}
            </div>
          </div>
        </div>

        <div class="d-flex justify-content-between align-items-center mb-1">
          <div>
            <div style="font-size:0.76rem;color:#6b7280;">
              เริ่ม: <strong style="color:#111827;">${timeStr}</strong>
            </div>
            <div style="font-size:0.7rem;color:#9ca3af;">
              ${dateStr}
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.84rem;font-weight:600;">
              ${formatCurrencyTHB(total)}
            </div>
            <div style="font-size:0.7rem;color:#6b7280;">
              แรง: ${formatNumber(job.totalLabor || 0)} / อะไหล่: ${formatNumber(job.totalParts || 0)}
            </div>
          </div>
        </div>

        <div style="font-size:0.74rem;color:#6b7280;margin-top:2px;">
          ${
            tags
              ? `<span class="bm-tag"><i class="bi bi-tags"></i>${tags}</span>`
              : `<span class="bm-text-muted">ยังไม่ได้ติดแท็กงานซ่อม</span>`
          }
        </div>
      </div>
    `;

    col.appendChild(card);
    row.appendChild(col);
  });

  cardContainer.appendChild(row);
}

// ---------- View switching ----------
function setView(view) {
  currentView = view === "card" ? "card" : "table";

  if (tableContainer) {
    tableContainer.style.display = currentView === "table" ? "block" : "none";
  }
  if (cardContainer) {
    cardContainer.style.display = currentView === "card" ? "block" : "none";
  }

  if (viewTableBtn) {
    viewTableBtn.classList.toggle("bm-pill-primary", currentView === "table");
  }
  if (viewCardBtn) {
    viewCardBtn.classList.toggle("bm-pill-primary", currentView === "card");
  }

  renderJobsView();
}

function renderJobsView() {
  if (currentView === "card") {
    renderJobsCards();
  } else {
    renderJobsTable();
  }
}

// ---------- Init ----------
function initJobsPage() {
  // ถ้าไม่มี section-jobs แสดงว่าไม่ได้อยู่หน้า app.html หรือยังไม่ใช้ส่วนนี้
  const section = $("#section-jobs");
  if (!section) return;

  searchInput = $("#bm-jobs-search");
  statusSelect = $("#bm-jobs-status");
  dateFromInput = $("#bm-jobs-date-from");
  dateToInput = $("#bm-jobs-date-to");
  clearFilterBtn = $("#bm-jobs-clear-filter");
  applyFilterBtn = $("#bm-jobs-filter-apply");
  viewTableBtn = $("#bm-jobs-view-table-btn");
  viewCardBtn = $("#bm-jobs-view-card-btn");
  tableContainer = $("#bm-jobs-view-table");
  cardContainer = $("#bm-jobs-view-card");

  // Event: ตัวกรอง
  if (applyFilterBtn) {
    applyFilterBtn.addEventListener("click", applyFilters);
  }
  if (clearFilterBtn) {
    clearFilterBtn.addEventListener("click", clearFilters);
  }

  // ให้ค้นหาแบบ realtime ก็ได้
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      applyFilters();
    });
  }
  if (statusSelect) {
    statusSelect.addEventListener("change", applyFilters);
  }
  if (dateFromInput) {
    dateFromInput.addEventListener("change", applyFilters);
  }
  if (dateToInput) {
    dateToInput.addEventListener("change", applyFilters);
  }

  // View switch
  if (viewTableBtn) {
    viewTableBtn.addEventListener("click", () => setView("table"));
  }
  if (viewCardBtn) {
    viewCardBtn.addEventListener("click", () => setView("card"));
  }

  // ค่าเริ่มต้น: view table + filter all
  setView("table");
  applyFilters();
}

document.addEventListener("DOMContentLoaded", initJobsPage);