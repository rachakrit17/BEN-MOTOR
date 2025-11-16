// BEN MOTOR POS – Jobs List / งานซ่อมทั้งหมด

import {
  db,
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp // เพิ่มเข้ามาสำหรับการอัปเดตสถานะ
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
    raw.jobDate ||
    raw.createAt;
  const doneRaw = raw.doneAt || raw.finishedAt;

  const createdAt = toJsDate(createdRaw);
  const doneAt = toJsDate(doneRaw);

  const items = Array.isArray(raw.items) ? raw.items : [];
  
  // Recalculate totals just in case
  const total = items.reduce((sum, item) => sum + (item.quantity * item.price), 0) - (raw.discount || 0);

  return {
    id,
    ...raw,
    createdAt,
    doneAt,
    items,
    total: total // ใช้ total ที่มีการคำนวณแล้ว
  };
}

// -----------------------------
// Filters & Loading
// -----------------------------
function getFilterValues() {
  const searchInput = $("jobsSearchInput");
  const statusFilter = $("jobsStatusFilter");
  const dateRange = $("jobsDateRange");

  const search = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const status = statusFilter ? statusFilter.value : "all";
  const range = dateRange ? dateRange.value : "this-month";

  return { search, status, range };
}

function getDateRange(range) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0); // Start of day

  if (range === "today") return { start, end: now };
  if (range === "yesterday") {
    start.setDate(now.getDate() - 1);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (range === "this-week") {
    start.setDate(now.getDate() - now.getDay()); // Sunday
    return { start, end: now };
  }
  if (range === "this-month") {
    start.setDate(1);
    return { start, end: now };
  }
  if (range === "last-month") {
    start.setDate(1);
    start.setMonth(now.getMonth() - 1);
    const end = new Date(now);
    end.setDate(0); // Last day of previous month
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  return { start: null, end: null }; // all
}

function applyFilters() {
  const { search, status } = getFilterValues();
  
  let filtered = jobsCache;

  if (status !== "all") {
    filtered = filtered.filter((job) => job.status === status);
  }

  if (search) {
    filtered = filtered.filter((job) => {
      const haystack = [
        (job.customerName || "").toLowerCase(),
        (job.vehiclePlate || "").toLowerCase(),
        (job.jobDescription || "").toLowerCase()
      ].join(" ");
      return haystack.includes(search);
    });
  }

  renderJobsTable(filtered);
}

async function loadJobsList() {
  const tbody = $("jobsTableBody");
  const emptyEl = $("jobsTableEmpty");
  const countEl = $("jobsCountText");

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-3 text-muted">
          กำลังโหลดข้อมูลงานซ่อมจากระบบ...
        </td>
      </tr>
    `;
    tbody.style.display = "table-row-group";
    if (emptyEl) emptyEl.style.display = "none";
  }

  const { range } = getFilterValues();
  const dateRange = getDateRange(range);
  
  // Note: Firebase query by date is complex and requires specific field (e.g., createdAt)
  // For simplicity and speed with small datasets, we load all and filter in memory for now.
  // Future improvement: Add Firestore date range filtering.

  try {
    const q = query(jobsCol, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    jobsCache = [];

    snap.forEach((docSnap) => {
      const job = mapJobData(docSnap);
      // Client-side date filtering for demonstration
      if (dateRange.start && job.createdAt < dateRange.start) return;
      if (dateRange.end && job.createdAt > dateRange.end) return;

      jobsCache.push(job);
    });

    if (countEl) countEl.textContent = jobsCache.length;

    applyFilters();
  } catch (error) {
    console.error("โหลดข้อมูลงานซ่อมไม่สำเร็จ:", error);
    showToast("โหลดข้อมูลงานซ่อมไม่สำเร็จ", "error");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-3 text-danger">
            โหลดข้อมูลงานซ่อมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง
          </td>
        </tr>
      `;
    }
  }
}

// -----------------------------
// Render Table
// -----------------------------
function getStatusBadge(status) {
  const map = {
    "pending": { text: "รอตรวจเช็ค", class: "text-bg-secondary" },
    "in-progress": { text: "กำลังดำเนินการ", class: "text-bg-primary" },
    "awaiting-part": { text: "รออะไหล่", class: "text-bg-warning" },
    "ready": { text: "พร้อมส่งมอบ", class: "text-bg-success" },
    "done": { text: "ปิดบิลแล้ว", class: "text-bg-info" },
    "canceled": { text: "ยกเลิก", class: "text-bg-danger" }
  };
  const item = map[status] || map["pending"];
  return `<span class="badge ${item.class}">${item.text}</span>`;
}

function renderJobsTable(jobs) {
  const tbody = $("jobsTableBody");
  const emptyEl = $("jobsTableEmpty");

  if (!tbody || !emptyEl) return;

  if (jobs.length === 0) {
    tbody.innerHTML = "";
    tbody.style.display = "none";
    emptyEl.style.display = "block";
    return;
  }

  const html = jobs
    .map((job) => {
      const customer = job.customerName || "-";
      const plate = job.vehiclePlate || "-";
      const description = (job.jobDescription || "-").substring(0, 50) + "...";
      const totalText = formatCurrency(job.total || 0);
      const statusBadge = getStatusBadge(job.status);

      return `
        <tr data-job-id="${job.id}">
          <td>
            <div class="fw-semibold">${customer}</div>
            <div class="small text-muted">${plate}</div>
          </td>
          <td class="small text-truncate">${description}</td>
          <td>${statusBadge}</td>
          <td class="text-end fw-semibold text-primary">${totalText}</td>
          <td class="text-end">
            <button 
              type="button" 
              class="btn btn-sm btn-outline-primary job-detail-btn" 
              data-bs-toggle="modal" 
              data-bs-target="#jobDetailModal"
              data-job-detail-btn="${job.id}"
            >
              ดูรายละเอียด
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  tbody.innerHTML = html;
  tbody.style.display = "table-row-group";
  emptyEl.style.display = "none";
}

// -----------------------------
// Job Detail Modal
// -----------------------------
function renderJobDetail(job) {
  if (!job) return;

  $("jobDetailCustomerName").textContent = job.customerName || "-";
  $("jobDetailCustomerPhone").textContent = job.customerPhone || "-";
  $("jobDetailVehicleModel").textContent = job.vehicleModel || "-";
  $("jobDetailVehiclePlate").textContent = job.vehiclePlate || "-";
  $("jobDetailVehicleMileage").textContent = job.vehicleMileage || "-";
  $("jobDetailDescription").textContent = job.jobDescription || "-";
  $("jobDetailStatusText").innerHTML = getStatusBadge(job.status);
  $("jobDetailDateCreated").textContent = job.createdAt ? formatDateTime(job.createdAt, true) : "-";
  $("jobDetailStatusSelect").value = job.status || "pending";
  $("jobDetailGrandTotal").textContent = formatCurrency(job.total || 0) + " บาท";

  // Done date
  const doneContainer = $("jobDetailDateDoneContainer");
  if (job.status === "done" && job.doneAt) {
    $("jobDetailDateDone").textContent = formatDateTime(job.doneAt, true);
    doneContainer.classList.remove("d-none");
  } else {
    doneContainer.classList.add("d-none");
  }

  // Items list
  const itemsBody = $("jobDetailItemsBody");
  if (itemsBody) {
    itemsBody.innerHTML = job.items
      .map((item) => {
        const typeBadge = item.type === "labor" 
            ? `<span class="badge text-bg-primary">ค่าแรง</span>` 
            : `<span class="badge text-bg-success">อะไหล่</span>`;
        const total = item.quantity * item.price;
        return `
          <tr>
            <td>${typeBadge}</td>
            <td class="small">${item.description || "-"}</td>
            <td class="text-end">${formatCurrency(item.price)}</td>
            <td class="text-end">${item.quantity}</td>
            <td class="text-end fw-semibold">${formatCurrency(total)}</td>
          </tr>
        `;
      })
      .join("");
  }
  
  // Update currentJob for the status form
  currentJob = job;
}

function openJobDetailModal(jobId) {
  const job = jobsCache.find((j) => j.id === jobId);
  if (!job) {
    showToast("ไม่พบข้อมูลงานซ่อม", "error");
    return;
  }
  renderJobDetail(job);
  
  // Ensure modal is shown (though it's triggered by data-bs-target)
  const modalEl = $("jobDetailModal");
  if (modalEl) {
    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

// -----------------------------
// Handle Status Update
// -----------------------------
async function handleStatusUpdate(e) {
  e.preventDefault();

  if (!currentJob) return;

  const newStatus = $("jobDetailStatusSelect").value;
  const saveBtn = $("jobDetailSaveStatusBtn");
  const modalEl = $("jobDetailModal");
  
  if (currentJob.status === newStatus) {
    showToast("สถานะงานไม่ได้เปลี่ยนแปลง", "info");
    return;
  }

  if (saveBtn) saveBtn.disabled = true;

  try {
    const ref = doc(db, "jobs", currentJob.id);
    
    // Add doneAt timestamp if status is changed to 'done' or 'canceled'
    const updateData = { status: newStatus };
    if (newStatus === "done" || newStatus === "canceled") {
      updateData.doneAt = serverTimestamp();
    } else {
      updateData.doneAt = null; // Clear doneAt if changing back
    }
    
    await updateDoc(ref, updateData);

    showToast("อัปเดตสถานะงานซ่อมเรียบร้อย", "success");
    
    // Refresh list and close modal
    await loadJobsList(); 

    if (
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
  } finally {
      if (saveBtn) saveBtn.disabled = false;
  }
}

// -----------------------------
// Init
// -----------------------------
export function initJobs() {
  const section = document.querySelector('[data-section="jobs"]');
  if (!section) return;
  
  const form = $("jobsFilterForm");
  const searchInput = $("jobsSearchInput");
  const statusFilter = $("jobsStatusFilter");
  const dateRange = $("jobsDateRange");
  const saveStatusBtn = $("jobDetailSaveStatusBtn");
  const table = $("jobsTable");
  const statusForm = $("jobDetailStatusForm");
  
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
      loadJobsList(); // Reload on date range change
    });
  }
  
  if (statusForm) {
      statusForm.addEventListener("submit", handleStatusUpdate);
  }

  // Handle Detail Button Clicks
  if (table) {
    table.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest(".job-detail-btn");
      if (!btn) return;

      const id = btn.getAttribute("data-job-detail-btn");
      if (id) {
          openJobDetailModal(id);
      }
    });
  }

  // Initial data load when the section is shown
  section.addEventListener("data-loaded", loadJobsList);
  
  // Load data immediately if section is the active one on start
  if (section.classList.contains("active")) {
      loadJobsList();
  }
}
