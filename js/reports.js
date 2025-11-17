// js/reports.js
// BEN MOTOR – Reports Page
// สรุปรายได้จากงานซ่อม (ปิดบิลแล้ว) + ขายรถ ตามช่วงวันที่เลือก

import { db, collection, getDocs } from "./firebase-init.js";
import { formatCurrency, formatDateTime } from "./utils.js";

// ---------------------------------
// Helpers
// ---------------------------------
const $ = (id) => document.getElementById(id);

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

function safeNumber(v, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

// คืน Date 00:00 ของวันนั้น
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

// คืน Date 23:59:59.999 ของวันนั้น
function endOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

// แปลงค่าจาก input[type=date] -> Date
function parseDateInput(value) {
  if (!value) return null;
  // value format: YYYY-MM-DD
  const [y, m, dd] = value.split("-").map((v) => Number(v));
  if (!y || !m || !dd) return null;
  return new Date(y, m - 1, dd);
}

// ตั้งค่า value ของ input[type=date] จาก Date
function formatDateForInput(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// ---------------------------------
// Firestore refs
// ---------------------------------
const jobsCol = collection(db, "jobs");
const vehiclesCol = collection(db, "vehicles");

// ---------------------------------
// ดึงช่วงวันที่จาก input
// ---------------------------------
function getSelectedRange() {
  const fromInput = $("reportDateFrom");
  const toInput = $("reportDateTo");

  let fromDate = fromInput ? parseDateInput(fromInput.value) : null;
  let toDate = toInput ? parseDateInput(toInput.value) : null;

  // ถ้า user ยังไม่เลือกอะไรเลย -> default: 30 วันล่าสุด
  if (!fromDate || !toDate) {
    const today = new Date();
    const to = endOfDay(today);
    const from = startOfDay(
      new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)
    );

    if (fromInput && !fromInput.value) {
      fromInput.value = formatDateForInput(from);
    }
    if (toInput && !toInput.value) {
      toInput.value = formatDateForInput(today);
    }

    return { from: from, to: to };
  }

  return { from: startOfDay(fromDate), to: endOfDay(toDate) };
}

// ---------------------------------
// โหลดรายงานตามช่วงวันที่
// ---------------------------------
async function loadReports() {
  const totalRevenueEl = $("reportTotalRevenue");
  const jobsCountEl = $("reportJobsCount");
  const vehiclesSoldCountEl = $("reportVehiclesSoldCount");

  const jobsTableBodyEl = $("reportJobsTableBody");
  const jobsEmptyEl = $("reportJobsEmpty");

  const vehiclesTableBodyEl = $("reportVehiclesTableBody");
  const vehiclesEmptyEl = $("reportVehiclesEmpty");

  if (
    !totalRevenueEl &&
    !jobsCountEl &&
    !vehiclesSoldCountEl &&
    !jobsTableBodyEl &&
    !vehiclesTableBodyEl
  ) {
    return;
  }

  const { from, to } = getSelectedRange();

  let totalRevenue = 0; // = ยอดงานซ่อม(ปิดบิล) + ยอดขายรถ (ราคาขาย)
  let jobsCount = 0;
  let vehiclesSoldCount = 0;

  const jobsRows = [];
  const vehiclesRows = [];

  try {
    const [jobsSnap, vehiclesSnap] = await Promise.all([
      getDocs(jobsCol),
      getDocs(vehiclesCol),
    ]);

    // ---------- งานซ่อม (เฉพาะสถานะ done) ----------
    jobsSnap.forEach((docSnap) => {
      const data = docSnap.data() || {};

      const status = data.status || "queue";
      if (status !== "done") return;

      const createdAt =
        toJsDate(
          data.createdAt ||
            data.created_at ||
            data.createdDate ||
            data.created_on ||
            data.closedAt ||
            data.closed_at
        ) || null;

      if (!createdAt) return;
      if (createdAt < from || createdAt > to) return;

      const totals = data.totals || {};
      let net = 0;
      if (typeof data.totalNet === "number") {
        net = data.totalNet;
      } else if (typeof totals.net === "number") {
        net = totals.net;
      } else if (typeof data.total === "number") {
        net = data.total;
      }

      const vehicle = data.vehicle || {};
      const customer = data.customer || {};

      const plate =
        vehicle.plate ||
        vehicle.license ||
        data.plate ||
        data.license ||
        "";
      const model = vehicle.model || vehicle.name || data.model || "";
      const customerName = customer.name || data.customerName || "";

      const label = plate || model || "(ไม่ระบุรถ)";
      const dateText = formatDateTime(createdAt);
      const moneyText = formatCurrency(safeNumber(net, 0));

      totalRevenue += safeNumber(net, 0);
      jobsCount += 1;

      jobsRows.push(`
        <tr>
          <td>${dateText}</td>
          <td>${label}</td>
          <td>${customerName || "-"}</td>
          <td class="text-success">${moneyText} บาท</td>
        </tr>
      `);
    });

    // ---------- รถขายแล้ว ----------
    vehiclesSnap.forEach((docSnap) => {
      const data = docSnap.data() || {};

      const status = data.status || "";
      if (status !== "sold") return;

      const soldAt =
        toJsDate(
          data.soldAt ||
            data.sellDate ||
            data.sold_on ||
            data.updatedAt ||
            data.createdAt
        ) || null;

      if (!soldAt) return;
      if (soldAt < from || soldAt > to) return;

      const buyPrice = safeNumber(
        data.buyPrice ?? data.purchasePrice ?? data.priceBuy ?? 0,
        0
      );
      const sellPrice = safeNumber(
        data.sellPrice ?? data.priceSell ?? data.totalSell ?? 0,
        0
      );
      const repairCost = safeNumber(
        data.repairCost ?? data.repair ?? 0,
        0
      );
      const profit = safeNumber(
        data.profit ?? sellPrice - buyPrice - repairCost,
        0
      );

      const model =
        data.model || data.vehicleModel || data.name || "ไม่ระบุรุ่น";
      const plate = data.plate || data.license || "";
      const label = plate ? `${model} • ${plate}` : model;

      totalRevenue += sellPrice;
      vehiclesSoldCount += 1;

      vehiclesRows.push(`
        <tr>
          <td>${label}</td>
          <td class="text-primary">${formatCurrency(buyPrice)} บาท</td>
          <td class="text-danger">${formatCurrency(sellPrice)} บาท</td>
          <td class="text-success">${formatCurrency(profit)} บาท</td>
          <td>${formatDateTime(soldAt)}</td>
        </tr>
      `);
    });

    // ---------- อัปเดตสรุปด้านบน ----------
    if (totalRevenueEl) {
      totalRevenueEl.textContent = `${formatCurrency(totalRevenue)} บาท`;
    }
    if (jobsCountEl) {
      jobsCountEl.textContent = `${jobsCount} งาน`;
    }
    if (vehiclesSoldCountEl) {
      vehiclesSoldCountEl.textContent = `${vehiclesSoldCount} คัน`;
    }

    // ---------- อัปเดตตารางงานซ่อม ----------
    if (jobsTableBodyEl) {
      jobsTableBodyEl.innerHTML = jobsRows.join("");
    }
    if (jobsEmptyEl) {
      jobsEmptyEl.classList.toggle("d-none", jobsRows.length > 0);
    }

    // ---------- อัปเดตตารางรถ ----------
    if (vehiclesTableBodyEl) {
      vehiclesTableBodyEl.innerHTML = vehiclesRows.join("");
    }
    if (vehiclesEmptyEl) {
      vehiclesEmptyEl.classList.toggle("d-none", vehiclesRows.length > 0);
    }
  } catch (error) {
    console.error("โหลดรายงานไม่สำเร็จ:", error);
  }
}

// ---------------------------------
// Quick range buttons
// ---------------------------------
function setRangeTodayAndReload() {
  const fromInput = $("reportDateFrom");
  const toInput = $("reportDateTo");
  const today = new Date();

  if (fromInput) fromInput.value = formatDateForInput(today);
  if (toInput) toInput.value = formatDateForInput(today);

  loadReports();
}

function setRangeLastNDaysAndReload(days) {
  const fromInput = $("reportDateFrom");
  const toInput = $("reportDateTo");
  const today = new Date();

  const to = today;
  const from = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - (days - 1)
  );

  if (fromInput) fromInput.value = formatDateForInput(from);
  if (toInput) toInput.value = formatDateForInput(to);

  loadReports();
}

// ---------------------------------
// Init
// ---------------------------------
function initReportsPage() {
  const btnToday = $("reportRangeTodayBtn");
  const btn7 = $("reportRange7Btn");
  const btn30 = $("reportRange30Btn");
  const btnRefresh = $("reportRefreshBtn");

  if (btnToday) {
    btnToday.addEventListener("click", () => {
      setRangeTodayAndReload();
    });
  }

  if (btn7) {
    btn7.addEventListener("click", () => {
      setRangeLastNDaysAndReload(7);
    });
  }

  if (btn30) {
    btn30.addEventListener("click", () => {
      setRangeLastNDaysAndReload(30);
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => {
      loadReports();
    });
  }

  // default: 30 วันล่าสุด แล้วโหลดเลย
  setRangeLastNDaysAndReload(30);
}

document.addEventListener("DOMContentLoaded", () => {
  initReportsPage();
});