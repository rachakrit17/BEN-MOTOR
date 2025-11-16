// BEN MOTOR POS – Reports (รายงานทั้งหมด)
// ดึงข้อมูลจาก Firestore แล้วสรุป / กรองตามช่วงเวลา

import { db, collection, getDocs } from "./firebase-init.js";
import { formatCurrency, formatDateTime } from "./utils.js";

// -----------------------------
// Helpers
// -----------------------------
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
  if (!Number.isNaN(parsed)) return new Date(parsed);
  return null;
}

function safeNumber(v, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

// Firestore collections
const jobsCol = collection(db, "jobs");
const vehiclesCol = collection(db, "vehicles");
const stockCol = collection(db, "stock");

// state ล่าสุด (ใช้สำหรับ export)
let lastReportState = null;

// -----------------------------
// Map data จาก Firestore
// -----------------------------

function mapJob(docSnap) {
  const raw = docSnap.data() || {};
  const id = docSnap.id;

  const createdRaw =
    raw.createdAt ||
    raw.created_at ||
    raw.createdDate ||
    raw.created_on ||
    raw.openedAt ||
    null;

  const createdAt = toJsDate(createdRaw) || new Date();
  const customer = raw.customer || {};
  const vehicle = raw.vehicle || {};
  const totals = raw.totals || {};

  const customerName = customer.name || raw.customerName || "-";
  const customerPhone = customer.phone || raw.customerPhone || "";
  const plate = vehicle.plate || vehicle.license || raw.plate || raw.license || "";
  const model = vehicle.model || vehicle.name || raw.model || "";

  const status = raw.status || "queue";

  let net = 0;
  if (typeof totals.net === "number") net = totals.net;
  else if (typeof raw.totalNet === "number") net = raw.totalNet;
  else if (typeof raw.total === "number") net = raw.total;

  const note =
    raw.note ||
    raw.remark ||
    raw.description ||
    (Array.isArray(raw.tags) ? raw.tags.join(", ") : "");

  return {
    id,
    type: "job",
    createdAt,
    createdLabel: formatDateTime(createdAt),
    plate,
    model,
    customerName,
    customerPhone,
    netTotal: safeNumber(net, 0),
    status,
    note
  };
}

function mapVehicle(docSnap) {
  const raw = docSnap.data() || {};
  const id = docSnap.id;

  const buyRaw =
    raw.buyDate ||
    raw.createdAt ||
    raw.created_at ||
    raw.openedAt ||
    null;
  const soldRaw = raw.soldAt || raw.soldDate || null;

  const buyAt = toJsDate(buyRaw) || null;
  const soldAt = toJsDate(soldRaw);

  const brand = raw.brand || "";
  const model = raw.model || raw.name || "";
  const plate = raw.plate || raw.license || "";

  const buyPrice = safeNumber(
    raw.buyPrice ?? raw.costPrice ?? raw.purchasePrice,
    0
  );
  const sellPrice = safeNumber(
    raw.sellPrice ?? raw.salePrice ?? raw.price,
    0
  );
  const extraCost = safeNumber(
    raw.extraCost ?? raw.repairCost ?? raw.prepareCost,
    0
  );

  const profit =
    typeof raw.profit === "number"
      ? raw.profit
      : sellPrice - (buyPrice + extraCost);

  const status = raw.status || "stock"; // stock / sold / reserve ฯลฯ

  return {
    id,
    type: "vehicle",
    buyAt,
    soldAt,
    buyLabel: buyAt ? formatDateTime(buyAt) : "-",
    soldLabel: soldAt ? formatDateTime(soldAt) : "-",
    brand,
    model,
    plate,
    buyPrice,
    sellPrice,
    extraCost,
    profit,
    status
  };
}

function mapStock(docSnap) {
  const raw = docSnap.data() || {};
  const id = docSnap.id;

  const name = raw.name || raw.partName || "-";
  const category = raw.category || raw.group || "";
  const costPerUnit = safeNumber(
    raw.costPerUnit ?? raw.cost ?? raw.buyPrice,
    0
  );
  const sellPerUnit = safeNumber(
    raw.sellPerUnit ?? raw.pricePerUnit ?? raw.price,
    0
  );
  const qty = safeNumber(
    raw.qty ?? raw.quantity ?? raw.stock ?? raw.inStock,
    0
  );

  const value = costPerUnit * qty;

  return {
    id,
    type: "stock",
    name,
    category,
    costPerUnit,
    sellPerUnit,
    qty,
    value
  };
}

// -----------------------------
// อ่านค่า filter จากฟอร์ม
// -----------------------------
function getFilterFromForm() {
  const fromStr = $("#filterDateFrom")?.value || "";
  const toStr = $("#filterDateTo")?.value || "";

  let dateFrom = null;
  let dateTo = null;
  let dateToEnd = null; // ใช้เปรียบเทียบแบบ <= (เพิ่ม 1 วัน)

  if (fromStr) {
    const d = new Date(fromStr + "T00:00:00");
    if (!Number.isNaN(d.getTime())) dateFrom = d;
  }

  if (toStr) {
    const d = new Date(toStr + "T00:00:00");
    if (!Number.isNaN(d.getTime())) {
      dateTo = d;
      dateToEnd = new Date(d);
      dateToEnd.setDate(dateToEnd.getDate() + 1);
    }
  }

  const groupBy = $("#filterGroupBy")?.value || "day";
  const dataType = $("#filterDataType")?.value || "all";

  return {
    dateFrom,
    dateTo,
    dateToEnd,
    groupBy,
    dataType,
    rawFrom: fromStr,
    rawTo: toStr
  };
}

function isInRange(date, filter) {
  if (!date) return false;
  if (filter.dateFrom && date < filter.dateFrom) return false;
  if (filter.dateToEnd && date >= filter.dateToEnd) return false;
  return true;
}

function getGroupKey(date, groupBy) {
  if (!date) return "ไม่ทราบวันที่";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  if (groupBy === "year") return `${y}`;
  if (groupBy === "month") return `${y}-${m}`;
  return `${y}-${m}-${d}`;
}

// -----------------------------
// โหลดข้อมูลทั้งหมดจาก Firestore
// -----------------------------
async function loadAllData(filter) {
  const [jobsSnap, vehiclesSnap, stockSnap] = await Promise.all([
    getDocs(jobsCol),
    getDocs(vehiclesCol),
    getDocs(stockCol)
  ]);

  let jobs = [];
  let vehicles = [];
  let stock = [];

  jobsSnap.forEach((docSnap) => {
    jobs.push(mapJob(docSnap));
  });

  vehiclesSnap.forEach((docSnap) => {
    vehicles.push(mapVehicle(docSnap));
  });

  stockSnap.forEach((docSnap) => {
    stock.push(mapStock(docSnap));
  });

  // apply type filter + date filter
  if (filter.dataType === "jobs") {
    vehicles = [];
    stock = [];
  } else if (filter.dataType === "vehicles") {
    jobs = [];
    stock = [];
  } else if (filter.dataType === "stock") {
    jobs = [];
    vehicles = [];
  }

  const jobsFiltered = filter.dateFrom || filter.dateTo
    ? jobs.filter((j) => isInRange(j.createdAt, filter))
    : jobs;

  const vehiclesForSummary = filter.dateFrom || filter.dateTo
    ? vehicles.filter((v) => isInRange(v.soldAt || v.buyAt, filter))
    : vehicles;

  const stockFiltered = stock; // สต็อกใช้ดูภาพรวมทั้งคลัง

  return {
    jobs: jobsFiltered,
    vehicles: vehiclesForSummary,
    stock: stockFiltered
  };
}

// -----------------------------
// คำนวณ summary
// -----------------------------
function buildSummary(filter, data) {
  const { jobs, vehicles } = data;

  let totalRecords = jobs.length + vehicles.length;
  let totalIncome = 0;
  let totalCost = 0;
  let netProfit = 0;
  let jobsCount = jobs.length;
  let vehiclesSold = 0;

  jobs.forEach((job) => {
    totalIncome += job.netTotal;
  });

  vehicles.forEach((v) => {
    if (v.status === "sold" || v.sellPrice > 0) {
      vehiclesSold += 1;
    }

    const income = v.sellPrice;
    const cost = v.buyPrice + v.extraCost;

    totalIncome += income;
    totalCost += cost;
  });

  netProfit = totalIncome - totalCost;

  return {
    totalRecords,
    totalIncome,
    totalCost,
    netProfit,
    jobsCount,
    vehiclesSold
  };
}

// -----------------------------
// สรุปตามช่วงเวลา
// -----------------------------
function buildGroupedRows(filter, data) {
  const map = new Map(); // key => row

  const ensureRow = (key) => {
    if (!map.has(key)) {
      map.set(key, {
        key,
        income: 0,
        cost: 0,
        net: 0,
        jobsCount: 0,
        vehiclesSold: 0
      });
    }
    return map.get(key);
  };

  data.jobs.forEach((job) => {
    const key = getGroupKey(job.createdAt, filter.groupBy);
    const row = ensureRow(key);
    row.income += job.netTotal;
    row.net = row.income - row.cost;
    row.jobsCount += 1;
  });

  data.vehicles.forEach((v) => {
    const dateBase = v.soldAt || v.buyAt;
    const key = getGroupKey(dateBase, filter.groupBy);
    const row = ensureRow(key);

    const income = v.sellPrice;
    const cost = v.buyPrice + v.extraCost;

    row.income += income;
    row.cost += cost;
    row.net = row.income - row.cost;

    if (v.status === "sold" || v.sellPrice > 0) {
      row.vehiclesSold += 1;
    }
  });

  const rows = Array.from(map.values()).sort((a, b) =>
    a.key.localeCompare(b.key)
  );

  return rows;
}

// -----------------------------
// Render UI ส่วนต่าง ๆ
// -----------------------------
function renderSummaryCards(summary) {
  const totalRecordsEl = $("#summaryTotalRecords");
  const totalIncomeEl = $("#summaryTotalIncome");
  const totalCostEl = $("#summaryTotalCost");
  const netProfitEl = $("#summaryNetProfit");
  const jobsCountEl = $("#summaryJobsCount");
  const vehiclesSoldEl = $("#summaryVehiclesSold");

  if (totalRecordsEl)
    totalRecordsEl.textContent = `${summary.totalRecords} รายการ`;

  if (totalIncomeEl)
    totalIncomeEl.textContent = formatCurrency(summary.totalIncome) + " บาท";

  if (totalCostEl)
    totalCostEl.textContent = formatCurrency(summary.totalCost) + " บาท";

  if (netProfitEl)
    netProfitEl.textContent = formatCurrency(summary.netProfit) + " บาท";

  if (jobsCountEl)
    jobsCountEl.textContent = `${summary.jobsCount} งาน`;

  if (vehiclesSoldEl)
    vehiclesSoldEl.textContent = `${summary.vehiclesSold} คัน`;
}

function renderSummaryTable(rows) {
  const tbody = $("#summaryTableBody");
  const emptyState = $("#summaryTableEmpty");
  if (!tbody || !emptyState) return;

  if (!rows.length) {
    tbody.innerHTML = "";
    emptyState.classList.remove("d-none");
    return;
  }

  emptyState.classList.add("d-none");

  const html = rows
    .map(
      (row) => `
      <tr>
        <td>${row.key}</td>
        <td class="text-end">${formatCurrency(row.income)}</td>
        <td class="text-end">${formatCurrency(row.cost)}</td>
        <td class="text-end">${formatCurrency(row.net)}</td>
        <td class="text-end">${row.jobsCount}</td>
        <td class="text-end">${row.vehiclesSold}</td>
      </tr>
    `
    )
    .join("");

  tbody.innerHTML = html;
}

function renderJobsTable(jobs) {
  const tbody = $("#jobsReportTable")?.querySelector("tbody") || $("#jobsReportBody");
  const emptyState = $("#jobsReportEmpty");
  if (!tbody || !emptyState) return;

  if (!jobs.length) {
    tbody.innerHTML = "";
    emptyState.classList.remove("d-none");
    return;
  }

  emptyState.classList.add("d-none");

  const html = jobs
    .map(
      (job) => `
      <tr>
        <td>${job.createdLabel}</td>
        <td>${job.plate || "-"} / ${job.model || "-"}</td>
        <td>${job.customerName || "-"}<br><small class="text-muted">${
        job.customerPhone || ""
      }</small></td>
        <td class="text-end">${formatCurrency(job.netTotal)}</td>
        <td class="text-center">
          <span class="badge bg-light text-dark">${job.status}</span>
        </td>
        <td>${job.note || ""}</td>
      </tr>
    `
    )
    .join("");

  tbody.innerHTML = html;
}

function renderVehiclesTable(vehicles) {
  const tbody =
    $("#vehiclesReportTable")?.querySelector("tbody") || $("#vehiclesReportBody");
  const emptyState = $("#vehiclesReportEmpty");
  if (!tbody || !emptyState) return;

  if (!vehicles.length) {
    tbody.innerHTML = "";
    emptyState.classList.remove("d-none");
    return;
  }

  emptyState.classList.add("d-none");

  const html = vehicles
    .map(
      (v) => `
      <tr>
        <td>${v.buyLabel}</td>
        <td>${v.model || "-"} / ${v.plate || ""}</td>
        <td class="text-end">${formatCurrency(v.buyPrice)}</td>
        <td class="text-end">${formatCurrency(v.sellPrice)}</td>
        <td class="text-end">${formatCurrency(v.profit)}</td>
        <td>${v.status}</td>
      </tr>
    `
    )
    .join("");

  tbody.innerHTML = html;
}

function renderStockTable(stock) {
  const tbody =
    $("#stockReportTable")?.querySelector("tbody") || $("#stockReportBody");
  const emptyState = $("#stockReportEmpty");
  if (!tbody || !emptyState) return;

  if (!stock.length) {
    tbody.innerHTML = "";
    emptyState.classList.remove("d-none");
    return;
  }

  emptyState.classList.add("d-none");

  const html = stock
    .map(
      (s) => `
      <tr>
        <td>${s.name}</td>
        <td>${s.category || "-"}</td>
        <td class="text-end">${formatCurrency(s.costPerUnit)}</td>
        <td class="text-end">${formatCurrency(s.sellPerUnit)}</td>
        <td class="text-center">${s.qty}</td>
        <td class="text-end">${formatCurrency(s.value)}</td>
      </tr>
    `
    )
    .join("");

  tbody.innerHTML = html;
}

function renderPosTable() {
  // ตอนนี้ยังไม่มี collection POS แยกต่างหาก
  const tbody =
    $("#posReportTable")?.querySelector("tbody") || $("#posReportBody");
  const emptyState = $("#posReportEmpty");
  if (!tbody || !emptyState) return;

  tbody.innerHTML = "";
  emptyState.classList.remove("d-none");
}

// -----------------------------
// Date range label & generated at
// -----------------------------
function updateDateRangeLabel(filter) {
  const label = $("#reportDateRangeLabel");
  if (!label) return;

  if (!filter.rawFrom && !filter.rawTo) {
    label.textContent = "ยังไม่ได้เลือกช่วงเวลา";
    return;
  }

  if (filter.rawFrom && filter.rawTo) {
    label.textContent = `ช่วงวันที่ ${filter.rawFrom} ถึง ${filter.rawTo}`;
  } else if (filter.rawFrom && !filter.rawTo) {
    label.textContent = `ตั้งแต่วันที่ ${filter.rawFrom}`;
  } else if (!filter.rawFrom && filter.rawTo) {
    label.textContent = `ถึงวันที่ ${filter.rawTo}`;
  }
}

function updateGeneratedAtLabel() {
  const el = $("#reportGeneratedAt");
  if (!el) return;
  const now = new Date();
  el.textContent = formatDateTime(now);
}

// quick range helper (ปุ่ม วันนี้ / 7 วัน / 30 วัน / เดือนนี้)
function applyQuickRange(type) {
  const today = new Date();
  let from = new Date(today);

  if (type === "today") {
    // from = today (ค่า default)
  } else if (type === "7") {
    from.setDate(today.getDate() - 6);
  } else if (type === "30") {
    from.setDate(today.getDate() - 29);
  } else if (type === "month") {
    from = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  const fromInput = $("#filterDateFrom");
  const toInput = $("#filterDateTo");

  if (fromInput) fromInput.value = from.toISOString().slice(0, 10);
  if (toInput) toInput.value = today.toISOString().slice(0, 10);
}

// -----------------------------
// Export CSV / JSON
// -----------------------------
function handleExportJson() {
  if (!lastReportState) {
    alert("ยังไม่มีข้อมูลรายงานให้ Export");
    return;
  }
  const blob = new Blob([JSON.stringify(lastReportState, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ben-motor-reports.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function handleExportCsv() {
  if (!lastReportState) {
    alert("ยังไม่มีข้อมูลรายงานให้ Export");
    return;
  }

  const rows = lastReportState.groupedRows || [];
  if (!rows.length) {
    alert("ยังไม่มีข้อมูลในตารางสรุปตามช่วงเวลา");
    return;
  }

  const header = [
    "ช่วงเวลา",
    "รายรับ",
    "ต้นทุน",
    "กำไรสุทธิ",
    "จำนวนงานซ่อม",
    "จำนวนรถขายแล้ว"
  ];
  const lines = [header.join(",")];

  rows.forEach((r) => {
    lines.push(
      [
        r.key,
        r.income,
        r.cost,
        r.net,
        r.jobsCount,
        r.vehiclesSold
      ].join(",")
    );
  });

  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ben-motor-reports.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// -----------------------------
// Main – ประมวลผลรายงานตาม filter
// -----------------------------
async function runReport() {
  const filter = getFilterFromForm();
  updateDateRangeLabel(filter);

  const mainCard = document.querySelector(".bm-main");
  if (mainCard) {
    // optional: ใส่ cursor รอโหลด
    document.body.style.cursor = "wait";
  }

  try {
    const data = await loadAllData(filter);
    const summary = buildSummary(filter, data);
    const groupedRows = buildGroupedRows(filter, data);

    renderSummaryCards(summary);
    renderSummaryTable(groupedRows);
    renderJobsTable(data.jobs);
    renderVehiclesTable(data.vehicles);
    renderStockTable(data.stock);
    renderPosTable();

    updateGeneratedAtLabel();

    lastReportState = {
      filter,
      summary,
      groupedRows,
      jobs: data.jobs,
      vehicles: data.vehicles,
      stock: data.stock
    };
  } catch (err) {
    console.error("โหลดรายงานไม่สำเร็จ:", err);
    alert("โหลดข้อมูลรายงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  } finally {
    document.body.style.cursor = "default";
  }
}

// -----------------------------
// Init
// -----------------------------
function initReportsPage() {
  const filterForm = $("#reportFilterForm");
  if (filterForm) {
    filterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      runReport();
    });
  }

  const resetBtn = $("#resetFilterBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (filterForm) filterForm.reset();
      setTimeout(() => {
        applyQuickRange("30");
        runReport();
      }, 0);
    });
  }

  document.querySelectorAll("[data-quick-range]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.getAttribute("data-quick-range");
      applyQuickRange(type);
      runReport();
    });
  });

  const exportJsonBtn = $("#exportJsonBtn");
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener("click", (e) => {
      e.preventDefault();
      handleExportJson();
    });
  }

  const exportCsvBtn = $("#exportCsvBtn");
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", (e) => {
      e.preventDefault();
      handleExportCsv();
    });
  }

  // โหลดค่าเริ่มต้น: 30 วันล่าสุด
  applyQuickRange("30");
  runReport();
}

document.addEventListener("DOMContentLoaded", initReportsPage);
