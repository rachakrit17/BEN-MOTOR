// BEN MOTOR POS – Jobs List / งานซ่อมทั้งหมด

import {
  db,
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  updateDoc
} from "./firebase-init.js";

import { formatCurrency, formatDateTime, showToast } from "./utils.js";

// -----------------------------
// Helpers
// -----------------------------
const $ = (id) => document.getElementById(id);

// แปลงค่าเป็น Date อย่างยืดหยุ่น (รองรับ Firestore Timestamp, string, Date)
function toJsDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") {
    try {
      return value.toDate();
    } catch (e) {
      // ignore
    }
  }
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed);
  }
  return null;
}

const jobsCol = collection(db, "jobs");

let jobsCache = [];
let currentJob = null;

// -----------------------------
// Mapping ข้อมูลงานจาก Firestore
// -----------------------------
function mapJobData(docSnap) {
  const raw = docSnap.data() || {};
  const id = docSnap.id;

  const createdRaw =
    raw.createdAt ||
    raw.created_at ||
    raw.createdDate ||
    raw.created_on ||
    null;

  const createdAt = toJsDate(createdRaw) || new Date();
  const createdLocalAt = formatDateTime(createdAt);

  const customer = raw.customer || {};
  const vehicle = raw.vehicle || {};
  const totals = raw.totals || {};

  const customerName = customer.name || raw.customerName || "-";
  const customerPhone = customer.phone || raw.customerPhone || "";
  const plate = vehicle.plate || raw.plate || raw.license || "";
  const model = vehicle.model || vehicle.name || raw.model || "";

  const status = raw.status || "queue";
  const priority = raw.priority || raw.urgency || "normal";

  const netTotal =
    typeof totals.net === "number"
      ? totals.net
      : typeof raw.total === "number"
      ? raw.total
      : typeof raw.netTotal === "number"
      ? raw.netTotal
      : 0;

  const items = Array.isArray(raw.items)
    ? raw.items
    : Array.isArray(raw.lines)
    ? raw.lines
    : [];

  return {
    id,
    raw,
    createdAt,
    createdLocalAt,
    customerName,
    customerPhone,
    plate,
    model,
    status,
    priority,
    netTotal,
    items
  };
}

// -----------------------------
// โหลดงานซ่อมจาก Firestore
// -----------------------------
async function loadJobs() {
  const tbody = $("jobsTableBody");
  const emptyState = $("jobsEmptyState");

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-3 text-muted">
          กำลังโหลดข้อมูลงานซ่อม…
        </td>
      </tr>
    `;
  }

  try {
    const q = query(jobsCol, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    jobsCache = [];
    snap.forEach((docSnap) => {
      jobsCache.push(mapJobData(docSnap));
    });

    if (!jobsCache.length) {
      if (tbody) {
        tbody.innerHTML = "";
      }
      if (emptyState) {
        emptyState.classList.remove("d-none");
      }
      return;
    }

    applyFilters();
  } catch (error) {
    console.error("โหลดข้อมูลงานซ่อมไม่สำเร็จ:", error);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-3 text-danger">
            โหลดข้อมูลงานซ่อมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง
          </td>
        </tr>
      `;
    }
  }
}

// -----------------------------
// ฟิลเตอร์งานซ่อม
// -----------------------------
function getFilterValues() {
  const searchInput = $("jobsSearchInput");
  const statusSelect = $("jobsStatusFilter");
  const dateRangeSelect = $("jobsDateRange");

  const text = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const status = statusSelect ? statusSelect.value : "all";
  const dateRange = dateRangeSelect ? dateRangeSelect.value : "today";

  return { text, status, dateRange };
}

function filterByDate(job, range) {
  if (!job.createdAt || !(job.createdAt instanceof Date)) return true;

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );

  let from = startOfToday;

  if (range === "today") {
    from = startOfToday;
  } else if (range === "7days") {
    from = new Date(startOfToday);
    from.setDate(from.getDate() - 6);
  } else if (range === "30days") {
    from = new Date(startOfToday);
    from.setDate(from.getDate() - 29);
  } else {
    // all
    return true;
  }

  return job.createdAt >= from;
}

function applyFilters() {
  const tbody = $("jobsTableBody");
  const emptyState = $("jobsEmptyState");
  if (!tbody) return;

  const { text, status, dateRange } = getFilterValues();

  let filtered = jobsCache.slice();

  if (text) {
    filtered = filtered.filter((job) => {
      const haystack = [
        job.customerName,
        job.customerPhone,
        job.plate,
        job.model,
        job.id
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(text);
    });
  }

  if (status && status !== "all") {
    filtered = filtered.filter((job) => job.status === status);
  }

  if (dateRange && dateRange !== "all") {
    filtered = filtered.filter((job) => filterByDate(job, dateRange));
  }

  if (!filtered.length) {
    tbody.innerHTML = "";
    if (emptyState) {
      emptyState.classList.remove("d-none");
    }
    return;
  }

  if (emptyState) {
    emptyState.classList.add("d-none");
  }

  renderJobsTable(filtered);
}

// -----------------------------
// เรนเดอร์ตารางงานซ่อม
// -----------------------------
function renderJobsTable(jobs) {
  const tbody = $("jobsTableBody");
  if (!tbody) return;

  const rowsHtml = jobs
    .map((job) => {
      const statusBadge = renderStatusBadge(job.status);
      const displayName = job.customerName || "-";
      const displayPhone = job.customerPhone || "";
      const displayPlate = job.plate || "-";
      const displayModel = job.model || "";
      const totalText = formatCurrency(job.netTotal || 0);

      return `
        <tr data-job-id="${job.id}">
          <td class="small text-nowrap">${job.createdLocalAt}</td>
          <td>
            <div class="fw-semibold">${displayPlate}</div>
            <div class="text-muted small">${displayModel}</div>
          </td>
          <td>
            <div class="fw-semibold">${displayName}</div>
            <div class="text-muted small">${displayPhone}</div>
          </td>
          <td class="text-end">
            <span class="fw-semibold">${totalText}</span>
          </td>
          <td class="text-center">
            ${statusBadge}
          </td>
          <td class="text-end">
            <button
              type="button"
              class="btn btn-sm btn-outline-primary"
              data-job-detail-btn="${job.id}"
            >
              ดูรายละเอียด
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  tbody.innerHTML = rowsHtml;

  tbody.querySelectorAll("[data-job-detail-btn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-job-detail-btn");
      const job = jobsCache.find((j) => j.id === id);
      if (job) {
        openJobDetail(job);
      }
    });
  });
}

function renderStatusBadge(status) {
  let text = "ไม่ทราบสถานะ";
  let cls = "bg-secondary";

  switch (status) {
    case "queue":
      text = "รอรับเข้า";
      cls = "bg-secondary";
      break;
    case "in-progress":
      text = "กำลังซ่อม";
      cls = "bg-info";
      break;
    case "waiting-parts":
      text = "รออะไหล่";
      cls = "bg-warning text-dark";
      break;
    case "waiting-payment":
      text = "รอชำระเงิน";
      cls = "bg-warning text-dark";
      break;
    case "done":
      text = "ปิดงานแล้ว";
      cls = "bg-success";
      break;
    default:
      break;
  }

  return `<span class="badge rounded-pill ${cls}">${text}</span>`;
}

// -----------------------------
// Modal รายละเอียดงาน
// -----------------------------
function openJobDetail(job) {
  currentJob = job;

  const contentEl = $("jobDetailContent");
  const statusSelect = $("jobDetailStatusSelect");

  if (statusSelect) {
    statusSelect.value = job.status || "queue";
  }

  if (!contentEl) return;

  const itemsRows =
    job.items && Array.isArray(job.items) && job.items.length
      ? job.items
          .map((item, index) => {
            const typeText =
              item.type === "labor"
                ? "ค่าแรง"
                : item.type === "part"
                ? "อะไหล่"
                : item.type || "-";
            const desc = item.description || item.name || "-";
            const qty =
              typeof item.qty === "number"
                ? item.qty
                : typeof item.quantity === "number"
                ? item.quantity
                : 1;
            const unitPrice =
              typeof item.unitPrice === "number"
                ? item.unitPrice
                : typeof item.price === "number"
                ? item.price
                : 0;
            const lineTotal =
              typeof item.lineTotal === "number"
                ? item.lineTotal
                : typeof item.total === "number"
                ? item.total
                : qty * unitPrice;

            return `
              <tr>
                <td class="text-center">${index + 1}</td>
                <td>${typeText}</td>
                <td>${desc}</td>
                <td class="text-center">${qty}</td>
                <td class="text-end">${formatCurrency(unitPrice)}</td>
                <td class="text-end">${formatCurrency(lineTotal)}</td>
              </tr>
            `;
          })
          .join("")
      : `<tr><td colspan="6" class="text-center text-muted py-3">ยังไม่มีรายการในบิลนี้</td></tr>`;

  const totalText = formatCurrency(job.netTotal || 0);

  contentEl.innerHTML = `
  <div class="mb-3">
    <div class="fw-semibold">ข้อมูลลูกค้า</div>
    <div class="text-muted small">
      ชื่อ: ${job.customerName || "-"}<br />
      เบอร์โทร: ${job.customerPhone || "-"}
    </div>
  </div>

  <div class="mb-3">
    <div class="fw-semibold">อาการที่ลูกค้าแจ้ง</div>
    <div class="text-muted small">
      ${job.raw.customerNote || "-"}
    </div>
  </div>

  <div class="mb-3">
    <div class="fw-semibold">ข้อมูลรถ</div>
    <div class="text-muted small">
      ทะเบียน: ${job.plate || "-"}<br />
      รุ่น/ยี่ห้อ: ${job.model || "-"}
    </div>
  </div>
    <div class="mb-3">
      <div class="fw-semibold d-flex justify-content-between align-items-center">
        <span>รายการซ่อม / อะไหล่</span>
        <span class="small text-muted">เปิดบิล: ${job.createdLocalAt}</span>
      </div>
      <div class="table-responsive">
        <table class="table table-sm align-middle mb-0">
          <thead>
            <tr class="small text-muted">
              <th class="text-center" style="width: 40px;">#</th>
              <th style="width: 80px;">ชนิด</th>
              <th>รายการ</th>
              <th class="text-center" style="width: 80px;">จำนวน</th>
              <th class="text-end" style="width: 120px;">ราคา/หน่วย</th>
              <th class="text-end" style="width: 120px;">รวม</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>
      </div>
    </div>
    <div class="mb-2 text-end">
      <span class="me-2 text-muted small">ยอดสุทธิ</span>
      <span class="fw-semibold fs-5">${totalText}</span>
    </div>
  `;

  const modalEl = document.getElementById("jobDetailModal");
  if (modalEl && window.bootstrap && typeof window.bootstrap.Modal === "function") {
    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

// -----------------------------
// อัปเดตสถานะงานซ่อม
// -----------------------------
async function handleUpdateStatus() {
  if (!currentJob) {
    showToast("ไม่พบงานซ่อมที่ต้องการอัปเดต", "error");
    return;
  }

  const statusSelect = $("jobDetailStatusSelect");
  if (!statusSelect) return;

  const newStatus = statusSelect.value;
  if (!newStatus) return;

  try {
    const jobRef = doc(jobsCol, currentJob.id);
    await updateDoc(jobRef, { status: newStatus });

    const idx = jobsCache.findIndex((j) => j.id === currentJob.id);
    if (idx !== -1) {
      jobsCache[idx].status = newStatus;
      currentJob.status = newStatus;
    }

    applyFilters();
    showToast("อัปเดตสถานะงานซ่อมเรียบร้อยแล้ว", "success");

    const modalEl = document.getElementById("jobDetailModal");
    if (
      modalEl &&
      window.bootstrap &&
      typeof window.bootstrap.Modal === "function"
    ) {
      const modal = window.bootstrap.Modal.getInstance(modalEl);
      if (modal) {
        modal.hide();
      }
    }
  } catch (error) {
    console.error("อัปเดตสถานะงานไม่สำเร็จ:", error);
    showToast("อัปเดตสถานะงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", "error");
  }
}

// -----------------------------
// Init
// -----------------------------
export function initJobs() {
  const form = $("jobsFilterForm");
  const searchInput = $("jobsSearchInput");
  const statusFilter = $("jobsStatusFilter");
  const dateRange = $("jobsDateRange");
  const saveStatusBtn = $("jobDetailSaveStatusBtn");
  const statusSelect = $("jobDetailStatusSelect");

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      applyFilters();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      applyFilters();
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener("change", () => {
      applyFilters();
    });
  }

  if (dateRange) {
    dateRange.addEventListener("change", () => {
      applyFilters();
    });
  }

  if (saveStatusBtn && statusSelect) {
    saveStatusBtn.addEventListener("click", () => {
      handleUpdateStatus();
    });
  }

  loadJobs();
}

// bootstrap เผื่อกรณี ui-shell ไม่ได้เรียก
document.addEventListener("DOMContentLoaded", () => {
  initJobs();
});
