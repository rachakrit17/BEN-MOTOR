// js/dashboard.js
// Logic ส่วนแดชบอร์ดของ BEN MOTOR POS
// - ใช้ข้อมูลจาก data-mock.js มาแสดงค่าต่าง ๆ บนหน้า Dashboard
// - เติมบอร์ดงานซ่อม (Kanban)
// - เติมรายการ "วันนี้ต้องโฟกัสอะไร"
// - เติมไทม์ไลน์วันนี้

import {
  JOB_STATUS,
  JOB_PRIORITY,
  demoJobs,
  demoTodaySummary,
  countJobsByStatus,
  countLowStock,
  countRegularCustomers
} from "./data-mock.js";

// ----- DOM Helper -----
const $ = (selector) => document.querySelector(selector);

// ----- ฟังก์ชันช่วย format ข้อความ/ตัวเลข -----

function formatCurrencyTHB(value) {
  const num = Number(value) || 0;
  return num.toLocaleString("th-TH") + " บาท";
}

function formatNumber(value) {
  const num = Number(value) || 0;
  return num.toLocaleString("th-TH");
}

function formatTimeShort(isoString) {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function mapStatusToLabelTh(status) {
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

function mapPriorityToLabelTh(priority) {
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

function mapPriorityToDotClass(priority) {
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

function getBadgeStatusClass(status) {
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

// ----- Render สรุปตัวเลขด้านบน -----

function renderTopStats() {
  const stat = demoTodaySummary || {};

  const $total = $("#bm-stat-today-total");
  const $labor = $("#bm-stat-today-labor");
  const $parts = $("#bm-stat-today-parts");
  const $jobsToday = $("#bm-stat-jobs-today");
  const $jobsInProgress = $("#bm-stat-jobs-in-progress");
  const $jobsWaitingParts = $("#bm-stat-jobs-waiting-parts");
  const $jobsWaitPay = $("#bm-stat-jobs-wait-pay");
  const $stockLow = $("#bm-stat-stock-low");
  const $customersRegular = $("#bm-stat-customers-regular");

  const $chipInProgress = $("#bm-dashboard-in-progress-count");
  const $chipPending = $("#bm-dashboard-pending-count");

  const todayTotal =
    (Number(stat.revenueLabor) || 0) + (Number(stat.revenueParts) || 0);

  if ($total) $total.textContent = formatCurrencyTHB(todayTotal);
  if ($labor) $labor.textContent = formatNumber(stat.revenueLabor || 0);
  if ($parts) $parts.textContent = formatNumber(stat.revenueParts || 0);

  const jobsTotalFromSummary = Number(stat.totalJobs);
  const jobsTotal = jobsTotalFromSummary || demoJobs.length;

  const jobsInProgressCount =
    Number(stat.jobsInProgress) || countJobsByStatus(JOB_STATUS.IN_PROGRESS);
  const jobsWaitingPartsCount =
    Number(stat.jobsWaitingParts) || countJobsByStatus(JOB_STATUS.WAITING_PARTS);
  const jobsWaitPayCount =
    Number(stat.jobsWaitPay) || countJobsByStatus(JOB_STATUS.WAIT_PAY);

  if ($jobsToday) $jobsToday.textContent = formatNumber(jobsTotal);
  if ($jobsInProgress)
    $jobsInProgress.textContent = formatNumber(jobsInProgressCount);
  if ($jobsWaitingParts)
    $jobsWaitingParts.textContent = formatNumber(jobsWaitingPartsCount);
  if ($jobsWaitPay) $jobsWaitPay.textContent = formatNumber(jobsWaitPayCount);

  const stockLowCount =
    Number(stat.stockLowCount) || countLowStock();
  const customersRegularCount =
    Number(stat.regularCustomersCount) || countRegularCustomers();

  if ($stockLow) $stockLow.textContent = formatNumber(stockLowCount);
  if ($customersRegular)
    $customersRegular.textContent = formatNumber(customersRegularCount);

  const pendingCount = demoJobs.filter(
    (job) => job.status !== JOB_STATUS.DONE
  ).length;

  if ($chipInProgress)
    $chipInProgress.textContent = formatNumber(jobsInProgressCount);
  if ($chipPending)
    $chipPending.textContent = formatNumber(pendingCount);
}

// ----- Render Kanban board -----

function createKanbanItem(job) {
  const wrapper = document.createElement("div");
  wrapper.className = "bm-kanban-item";

  const badgeStatusClass = getBadgeStatusClass(job.status);
  const statusLabel = mapStatusToLabelTh(job.status);
  const priorityLabel = mapPriorityToLabelTh(job.priority);
  const priorityDotClass = mapPriorityToDotClass(job.priority);

  const plate = job.plate || "-";
  const model = job.vehicleModel || "";
  const customerName = job.customerName || "";
  const startTime = formatTimeShort(job.createdAt);
  const dueTime = formatTimeShort(job.dueAt);

  const tagText = (job.tags || []).slice(0, 2).join(" • ");

  wrapper.innerHTML = `
    <div>
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div>
          <div style="font-size:0.8rem;font-weight:600;">
            ${plate}
            ${model ? `<span style="color:#6b7280;font-weight:400;">• ${model}</span>` : ""}
          </div>
          ${
            customerName
              ? `<div style="font-size:0.72rem;color:#6b7280;">${customerName}</div>`
              : ""
          }
        </div>
        <div style="text-align:right;">
          <div class="bm-badge-status ${badgeStatusClass}">
            <span class="bm-dot ${priorityDotClass}"></span>
            <span>${statusLabel}</span>
          </div>
          <div style="font-size:0.7rem;color:#6b7280;margin-top:2px;">
            ${priorityLabel}
          </div>
        </div>
      </div>
      <div class="bm-kanban-meta">
        <div>
          <span style="font-size:0.7rem;">
            เริ่ม ${startTime}
            ${
              dueTime !== "-"
                ? `• คาดเสร็จ <strong style="color:#111827;">${dueTime}</strong>`
                : ""
            }
          </span>
        </div>
        ${
          tagText
            ? `<div style="font-size:0.7rem;color:#6b7280;text-align:right;">${tagText}</div>`
            : ""
        }
      </div>
    </div>
  `;

  return wrapper;
}

function renderKanbanColumns() {
  const colQueue = $("#bm-kanban-col-queue");
  const colInProgress = $("#bm-kanban-col-in-progress");
  const colWaitingParts = $("#bm-kanban-col-waiting-parts");
  const colWaitPay = $("#bm-kanban-col-wait-pay");

  const countQueue = $("#bm-kanban-count-queue");
  const countInProgress = $("#bm-kanban-count-in-progress");
  const countWaitingParts = $("#bm-kanban-count-waiting-parts");
  const countWaitPay = $("#bm-kanban-count-wait-pay");

  if (!colQueue || !colInProgress || !colWaitingParts || !colWaitPay) {
    return;
  }

  // ล้าง placeholder เดิม
  [colQueue, colInProgress, colWaitingParts, colWaitPay].forEach((col) => {
    col.innerHTML = "";
  });

  const jobsQueue = demoJobs.filter((j) => j.status === JOB_STATUS.QUEUE);
  const jobsInProgress = demoJobs.filter(
    (j) => j.status === JOB_STATUS.IN_PROGRESS
  );
  const jobsWaitingParts = demoJobs.filter(
    (j) => j.status === JOB_STATUS.WAITING_PARTS
  );
  const jobsWaitPay = demoJobs.filter((j) => j.status === JOB_STATUS.WAIT_PAY);

  if (countQueue) countQueue.textContent = jobsQueue.length.toString();
  if (countInProgress) countInProgress.textContent = jobsInProgress.length.toString();
  if (countWaitingParts)
    countWaitingParts.textContent = jobsWaitingParts.length.toString();
  if (countWaitPay) countWaitPay.textContent = jobsWaitPay.length.toString();

  function appendJobs(col, jobs) {
    if (!jobs.length) {
      const placeholder = document.createElement("div");
      placeholder.className = "bm-placeholder";
      placeholder.textContent = "ยังไม่มีงานในคอลัมน์นี้";
      col.appendChild(placeholder);
      return;
    }

    jobs
      .slice()
      .sort((a, b) => {
        const tA = new Date(a.createdAt || 0).getTime();
        const tB = new Date(b.createdAt || 0).getTime();
        return tA - tB;
      })
      .forEach((job) => {
        col.appendChild(createKanbanItem(job));
      });
  }

  appendJobs(colQueue, jobsQueue);
  appendJobs(colInProgress, jobsInProgress);
  appendJobs(colWaitingParts, jobsWaitingParts);
  appendJobs(colWaitPay, jobsWaitPay);
}

// ----- Render "วันนี้ต้องโฟกัสอะไร" -----

function renderFocusList() {
  const container = $("#bm-focus-list");
  if (!container) return;

  container.innerHTML = "";

  const today = new Date();
  const todayDateStr = today.toISOString().slice(0, 10);

  const focusJobs = demoJobs
    .filter((job) => job.status !== JOB_STATUS.DONE)
    .filter((job) => {
      // งานด่วน / ด่วนมาก
      if (
        job.priority === JOB_PRIORITY.HIGH ||
        job.priority === JOB_PRIORITY.URGENT
      ) {
        return true;
      }

      // งานค้างข้ามวัน
      const createdDate = job.createdAt
        ? new Date(job.createdAt).toISOString().slice(0, 10)
        : todayDateStr;
      if (createdDate < todayDateStr) {
        return true;
      }

      // รถรอชำระเงิน ถือเป็นงานที่ควรปิดให้จบ
      if (job.status === JOB_STATUS.WAIT_PAY) {
        return true;
      }

      return false;
    })
    .sort((a, b) => {
      const pOrder = {
        [JOB_PRIORITY.URGENT]: 3,
        [JOB_PRIORITY.HIGH]: 2,
        [JOB_PRIORITY.NORMAL]: 1,
        [JOB_PRIORITY.LOW]: 0
      };
      const pa = pOrder[a.priority] ?? 0;
      const pb = pOrder[b.priority] ?? 0;
      if (pa !== pb) return pb - pa;

      const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return tb - ta;
    })
    .slice(0, 5); // แสดงไม่เกิน 5 งาน

  if (!focusJobs.length) {
    const li = document.createElement("li");
    li.className = "bm-timeline-item";
    li.innerHTML = `
      <div class="bm-timeline-dot bm-timeline-dot-muted"></div>
      <div class="bm-timeline-body">
        <strong>วันนี้ยังไม่มีงานด่วนหรืองานค้างที่ต้องเร่งเป็นพิเศษ</strong><br>
        คุณสามารถใช้เมนู "งานซ่อม" เพื่อมาร์กงานที่ต้องโฟกัสให้มาแสดงตรงนี้ในอนาคต
      </div>
    `;
    container.appendChild(li);
    return;
  }

  focusJobs.forEach((job) => {
    const li = document.createElement("li");
    li.className = "bm-timeline-item";

    const priorityDotClass = mapPriorityToDotClass(job.priority);
    const statusLabel = mapStatusToLabelTh(job.status);
    const priorityLabel = mapPriorityToLabelTh(job.priority);
    const plate = job.plate || "-";
    const model = job.vehicleModel || "";
    const customer = job.customerName || "";
    const timeText = formatTimeShort(job.updatedAt || job.createdAt);

    const reasonText =
      job.status === JOB_STATUS.WAIT_PAY
        ? "งานเสร็จแล้วแต่ยังไม่ปิดบิล"
        : job.status === JOB_STATUS.WAITING_PARTS
        ? "รออะไหล่ ถ้าอะไหล่เข้าแล้วควรรีบปิดงาน"
        : priorityLabel;

    li.innerHTML = `
      <div class="bm-timeline-dot ${priorityDotClass}"></div>
      <div class="bm-timeline-body">
        <strong>[${statusLabel}] ${plate} ${model ? "• " + model : ""}</strong><br>
        <span class="bm-timeline-highlight">${customer || "ลูกค้าไม่ระบุชื่อ"}</span>
        <span style="font-size:0.7rem;color:#6b7280;"> • ${reasonText}</span><br>
        <span class="bm-timeline-time">${timeText}</span>
      </div>
    `;

    container.appendChild(li);
  });
}

// ----- Render Timeline วันนี้ -----

function renderTimelineToday() {
  const container = $("#bm-timeline-today");
  if (!container) return;

  container.innerHTML = "";

  const today = new Date();
  const todayDateStr = today.toISOString().slice(0, 10);

  const todayJobs = demoJobs.filter((job) => {
    const updatedDate = job.updatedAt
      ? new Date(job.updatedAt).toISOString().slice(0, 10)
      : "";
    return updatedDate === todayDateStr;
  });

  if (!todayJobs.length) {
    const li = document.createElement("li");
    li.className = "bm-timeline-item";
    li.innerHTML = `
      <div class="bm-timeline-dot bm-timeline-dot-muted"></div>
      <div class="bm-timeline-body">
        <strong>วันนี้ยังไม่มีการอัปเดตงานซ่อมในระบบจำลอง</strong><br>
        เมื่อเชื่อมกับ Firestore สามารถดึงประวัติการเปลี่ยนสถานะงานมาวาดเป็นไทม์ไลน์อัตโนมัติ
      </div>
    `;
    container.appendChild(li);
    return;
  }

  todayJobs
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return ta - tb; // จากเช้าไปเย็น
    })
    .forEach((job) => {
      const li = document.createElement("li");
      li.className = "bm-timeline-item";

      const plate = job.plate || "-";
      const model = job.vehicleModel || "";
      const customer = job.customerName || "";
      const statusLabel = mapStatusToLabelTh(job.status);
      const timeText = formatTimeShort(job.updatedAt || job.createdAt);

      const dotClass =
        job.status === JOB_STATUS.DONE ? "bm-timeline-dot-muted" : "";

      li.innerHTML = `
        <div class="bm-timeline-dot ${dotClass}"></div>
        <div class="bm-timeline-body">
          <strong>${timeText}</strong> • [${statusLabel}] ${plate} ${
        model ? "• " + model : ""
      }<br>
          <span class="bm-timeline-time">${customer || "ไม่ระบุชื่อลูกค้า"}</span>
        </div>
      `;

      container.appendChild(li);
    });
}

// ----- Init -----

function isDashboardPresent() {
  return Boolean($("#section-dashboard"));
}

function initDashboard() {
  if (!isDashboardPresent()) return;

  try {
    renderTopStats();
    renderKanbanColumns();
    renderFocusList();
    renderTimelineToday();
  } catch (error) {
    console.error("Error while rendering dashboard:", error);
  }
}

document.addEventListener("DOMContentLoaded", initDashboard);