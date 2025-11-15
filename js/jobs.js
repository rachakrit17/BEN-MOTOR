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

const jobsCol = collection(db, "jobs");

let jobsCache = [];
let currentJob = null;

// -----------------------------
// Helpers – DOM
// -----------------------------
function $(id) {
  return document.getElementById(id);
}

function getSafeNumber(v, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

// -----------------------------
// Filter helpers
// -----------------------------
function getFilterValues() {
  const searchInput = $("jobsSearchInput");
  const statusSelect = $("jobsStatusFilter");
  const dateSelect = $("jobsDateFilter");

  const search = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const status = statusSelect ? statusSelect.value : "all";
  const dateRange = dateSelect ? dateSelect.value : "today"; // today | 7d | 30d | all

  return { search, status, dateRange };
}

function isInDateRange(job, rangeKey) {
  if (rangeKey === "all") return true;

  const createdAt =
    job.createdLocalAt instanceof Date
      ? job.createdLocalAt
      : job.createdAt instanceof Date
      ? job.createdAt
      : null;

  if (!createdAt) return true;

  const now = new Date();
  const msInDay = 24 * 60 * 60 * 1000;
  const diffDays = (now - createdAt) / msInDay;

  if (rangeKey === "today") {
    return createdAt.toDateString() === now.toDateString();
  }
  if (rangeKey === "7d") {
    return diffDays <= 7;
  }
  if (rangeKey === "30d") {
    return diffDays <= 30;
  }
  return true;
}

function applyFilters() {
  const { search, status, dateRange } = getFilterValues();

  let filtered = [...jobsCache];

  if (status && status !== "all") {
    filtered = filtered.filter((j) => (j.status || "queue") === status);
  }

  if (dateRange) {
    filtered = filtered.filter((j) => isInDateRange(j, dateRange));
  }

  if (search) {
    filtered = filtered.filter((j) => {
      const plate =
        j.vehicle?.plate ||
        j.vehicle?.license ||
        j.plate ||
        j.license ||
        "";
      const model = j.vehicle?.model || j.model || "";
      const customer = j.customer?.name || j.customerName || "";
      const phone = j.customer?.phone || j.phone || "";
      const id = j.id || "";
      const haystack = `${plate} ${model} ${customer} ${phone} ${id}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  renderJobsTable(filtered);
}

// -----------------------------
// Load jobs from Firestore
// -----------------------------
async function loadJobs() {
  const tbody = document.querySelector("#jobsTable tbody");
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-3 text-muted">
          กำลังโหลดข้อมูลงานซ่อมจากระบบ...
        </td>
      </tr>
    `;
  }

  try {
    // ดึงล่าสุด 200 งาน เรียงจากใหม่ไปเก่า
    const q = query(jobsCol, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    jobsCache = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const createdAt = data.createdAt?.toDate
        ? data.createdAt.toDate()
        : data.createdAt instanceof Date
        ? data.createdAt
        : null;

      const createdLocalAt = data.createdLocalAt?.toDate
        ? data.createdLocalAt.toDate()
        : data.createdLocalAt instanceof Date
        ? data.createdLocalAt
        : createdAt;

      jobsCache.push({
        id: docSnap.id,
        ...data,
        createdAt,
        createdLocalAt
      });
    });

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
// Render table
// -----------------------------
function renderJobsTable(jobs) {
  const tbody = document.querySelector("#jobsTable tbody");
  const countEl = $("jobsCountText");

  if (countEl) {
    countEl.textContent = jobs.length.toString();
  }

  if (!tbody) return;

  if (!jobs.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-3 text-muted">
          ยังไม่มีข้อมูลงานซ่อมตามเงื่อนไขที่เลือก
        </td>
      </tr>
    `;
    return;
  }

  const rowsHtml = jobs.slice(0, 200).map((job) => {
    const plate =
      job.vehicle?.plate ||
      job.vehicle?.license ||
      job.plate ||
      job.license ||
      "-";
    const model = job.vehicle?.model || job.model || "";
    const customer = job.customer?.name || job.customerName || "-";
    const phone = job.customer?.phone || job.phone || "-";
    const status = job.status || "queue";
    const total = getSafeNumber(job.totalNet ?? job.total ?? 0);

    const timeText = job.createdLocalAt
      ? formatDateTime(job.createdLocalAt)
      : job.createdAt
      ? formatDateTime(job.createdAt)
      : "-";

    const statusBadge = getStatusBadge(status);

    return `
      <tr data-job-id="${job.id}">
        <td class="small text-nowrap">${timeText}</td>
        <td>
          <div class="fw-semibold">${plate}</div>
          <div class="small text-muted">${model}</div>
        </td>
        <td>
          <div class="fw-semibold">${customer}</div>
          <div class="small text-muted">${phone}</div>
        </td>
        <td class="text-end fw-semibold">
          ${formatCurrency(total)}฿
        </td>
        <td class="text-nowrap">
          ${statusBadge}
        </td>
        <td class="text-end">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary jobs-detail-btn">
            รายละเอียด
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = rowsHtml.join("");

  tbody.addEventListener(
    "click",
    (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const row = target.closest("tr[data-job-id]");
      if (!row) return;
      const jobId = row.getAttribute("data-job-id");
      if (!jobId) return;

      const job = jobsCache.find((j) => j.id === jobId);
      if (!job) return;

      openJobDetailModal(job);
    },
    { once: true }
  );
}

function getStatusBadge(status) {
  let label = "";
  let cls = "";

  switch (status) {
    case "queue":
      label = "รอรับเข้า";
      cls = "badge rounded-pill text-bg-secondary";
      break;
    case "in-progress":
      label = "กำลังซ่อม";
      cls = "badge rounded-pill text-bg-info";
      break;
    case "waiting-parts":
      label = "รออะไหล่";
      cls = "badge rounded-pill text-bg-warning";
      break;
    case "waiting-payment":
      label = "รอชำระเงิน";
      cls = "badge rounded-pill text-bg-primary";
      break;
    case "done":
      label = "เสร็จงานแล้ว";
      cls = "badge rounded-pill text-bg-success";
      break;
    default:
      label = "ไม่ทราบสถานะ";
      cls = "badge rounded-pill text-bg-secondary";
  }

  return `<span class="${cls}">${label}</span>`;
}

// -----------------------------
// Job detail modal
// -----------------------------
function openJobDetailModal(job) {
  currentJob = job;

  const modalEl = $("jobDetailModal");
  if (!modalEl) {
    // ถ้าไม่มี modal ใน HTML ให้แสดงแบบ alert ธรรมดา
    alert(buildJobDetailText(job));
    return;
  }

  const titleEl = $("jobDetailTitle");
  const customerEl = $("jobDetailCustomer");
  const vehicleEl = $("jobDetailVehicle");
  const itemsEl = $("jobDetailItems");
  const paymentEl = $("jobDetailPayment");
  const noteEl = $("jobDetailNotes");
  const statusSelect = $("jobDetailStatusSelect");

  const plate =
    job.vehicle?.plate ||
    job.vehicle?.license ||
    job.plate ||
    job.license ||
    "-";
  const model = job.vehicle?.model || job.model || "";
  const customer = job.customer?.name || job.customerName || "-";
  const phone = job.customer?.phone || job.phone || "-";
  const jobType = job.jobType || "";
  const priority = job.priority || "";
  const createdAtText = job.createdLocalAt
    ? formatDateTime(job.createdLocalAt)
    : job.createdAt
    ? formatDateTime(job.createdAt)
    : "-";

  if (titleEl) {
    titleEl.textContent = `งานซ่อม ${plate} – ${customer}`;
  }

  if (customerEl) {
    customerEl.innerHTML = `
      <div><strong>ลูกค้า:</strong> ${customer}</div>
      <div><strong>เบอร์:</strong> ${phone}</div>
      ${
        jobType
          ? `<div><strong>ประเภทงาน:</strong> ${jobType}</div>`
          : ""
      }
      ${
        priority
          ? `<div><strong>ความเร่งด่วน:</strong> ${priority}</div>`
          : ""
      }
    `;
  }

  if (vehicleEl) {
    vehicleEl.innerHTML = `
      <div><strong>ทะเบียน:</strong> ${plate}</div>
      <div><strong>รุ่นรถ:</strong> ${model || "-"}</div>
      ${
        job.vehicle?.mileage
          ? `<div><strong>เลขไมล์:</strong> ${job.vehicle.mileage}</div>`
          : ""
      }
      <div><strong>เปิดงาน:</strong> ${createdAtText}</div>
    `;
  }

  if (itemsEl) {
    if (!job.items || !job.items.length) {
      itemsEl.innerHTML = `
        <div class="bm-empty-state">
          ยังไม่มีรายการซ่อมในงานนี้
        </div>
      `;
    } else {
      const rows = job.items.map((item) => {
        const typeLabel = item.type === "labor" ? "ค่าแรง" : "อะไหล่";
        const qty = getSafeNumber(item.qty, 1);
        const price = getSafeNumber(item.unitPrice, 0);
        const total = getSafeNumber(item.lineTotal, qty * price);

        return `
          <tr>
            <td>${typeLabel}</td>
            <td>${item.description || "-"}</td>
            <td class="text-end">${qty}</td>
            <td class="text-end">${formatCurrency(price)}</td>
            <td class="text-end">${formatCurrency(total)}</td>
          </tr>
        `;
      });

      itemsEl.innerHTML = rows.join("");
    }
  }

  if (paymentEl) {
    const subtotal = getSafeNumber(job.subtotal ?? job.total ?? 0);
    const discount = getSafeNumber(job.discount ?? 0);
    const net = getSafeNumber(job.totalNet ?? job.total ?? 0);
    const paid = getSafeNumber(job.paid ?? 0);
    const change = getSafeNumber(job.change ?? 0);

    paymentEl.innerHTML = `
      <div class="d-flex justify-content-between">
        <span>ยอดรวม</span>
        <span>${formatCurrency(subtotal)}฿</span>
      </div>
      <div class="d-flex justify-content-between">
        <span>ส่วนลด</span>
        <span>${formatCurrency(discount)}฿</span>
      </div>
      <hr class="my-2">
      <div class="d-flex justify-content-between fw-semibold">
        <span>ยอดสุทธิ</span>
        <span>${formatCurrency(net)}฿</span>
      </div>
      <div class="d-flex justify-content-between mt-1">
        <span>ลูกค้าจ่ายมา</span>
        <span>${formatCurrency(paid)}฿</span>
      </div>
      <div class="d-flex justify-content-between">
        <span>เงินทอน</span>
        <span>${formatCurrency(change)}฿</span>
      </div>
    `;
  }

  if (noteEl) {
    const customerNote = job.customerNote || "";
    const internalNote = job.internalNote || "";
    noteEl.innerHTML = `
      ${
        customerNote
          ? `<div class="mb-2"><strong>หมายเหตุจากลูกค้า:</strong><br>${customerNote}</div>`
          : ""
      }
      ${
        internalNote
          ? `<div><strong>โน้ตของช่าง:</strong><br>${internalNote}</div>`
          : ""
      }
      ${
        !customerNote && !internalNote
          ? `<div class="bm-empty-state">ยังไม่มีโน้ตสำหรับงานนี้</div>`
          : ""
      }
    `;
  }

  if (statusSelect) {
    statusSelect.value = job.status || "queue";
  }

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

function buildJobDetailText(job) {
  const plate =
    job.vehicle?.plate ||
    job.vehicle?.license ||
    job.plate ||
    job.license ||
    "-";
  const model = job.vehicle?.model || job.model || "";
  const customer = job.customer?.name || job.customerName || "-";
  const phone = job.customer?.phone || job.phone || "-";

  const lines = [];

  lines.push(`ลูกค้า: ${customer} (${phone})`);
  lines.push(`รถ: ${plate} ${model}`);
  lines.push(`สถานะ: ${job.status || "-"}`);

  if (job.items && job.items.length) {
    lines.push("");
    lines.push("รายการซ่อม:");
    job.items.forEach((item) => {
      lines.push(
        `- ${item.type === "labor" ? "[แรง]" : "[อะไหล่]"} ${
          item.description || "-"
        } x${item.qty || 1} = ${formatCurrency(
          item.lineTotal || 0
        )}฿`
      );
    });
  }

  const net = getSafeNumber(job.totalNet ?? job.total ?? 0);
  if (net) {
    lines.push("");
    lines.push(`ยอดสุทธิ: ${formatCurrency(net)}฿`);
  }

  return lines.join("\n");
}

// -----------------------------
// Update status
// -----------------------------
async function handleUpdateStatus() {
  if (!currentJob) return;

  const statusSelect = $("jobDetailStatusSelect");
  if (!statusSelect) return;

  const newStatus = statusSelect.value || "queue";
  if (newStatus === currentJob.status) {
    showToast("สถานะยังเหมือนเดิม ไม่มีการเปลี่ยนแปลง", "info");
    return;
  }

  try {
    const btn = $("jobDetailSaveStatusBtn");
    if (btn) btn.disabled = true;

    const ref = doc(db, "jobs", currentJob.id);
    await updateDoc(ref, {
      status: newStatus
    });

    // อัปเดตใน cache
    const idx = jobsCache.findIndex((j) => j.id === currentJob.id);
    if (idx !== -1) {
      jobsCache[idx].status = newStatus;
      currentJob.status = newStatus;
    }

    showToast("อัปเดตสถานะงานเรียบร้อย", "success");
    applyFilters(); // refresh table แสดง badge ใหม่
  } catch (error) {
    console.error("อัปเดตสถานะงานไม่สำเร็จ:", error);
    showToast("อัปเดตสถานะงานไม่สำเร็จ", "error");
  } finally {
    const btn = $("jobDetailSaveStatusBtn");
    if (btn) btn.disabled = false;
  }
}

// -----------------------------
// Init Jobs page
// -----------------------------
function initJobs() {
  const section = document.querySelector('[data-section="jobs"]');
  if (!section) return;

  const searchInput = $("jobsSearchInput");
  const statusSelect = $("jobsStatusFilter");
  const dateSelect = $("jobsDateFilter");
  const reloadBtn = $("jobsReloadBtn");
  const saveStatusBtn = $("jobDetailSaveStatusBtn");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      applyFilters();
    });
  }

  if (statusSelect) {
    statusSelect.addEventListener("change", () => {
      applyFilters();
    });
  }

  if (dateSelect) {
    dateSelect.addEventListener("change", () => {
      applyFilters();
    });
  }

  if (reloadBtn) {
    reloadBtn.addEventListener("click", () => {
      loadJobs();
    });
  }

  if (saveStatusBtn) {
    saveStatusBtn.addEventListener("click", () => {
      handleUpdateStatus();
    });
  }

  // โหลดครั้งแรก
  loadJobs();
}

// -----------------------------
// Bootstrap
// -----------------------------
document.addEventListener("DOMContentLoaded", () => {
  initJobs();
});