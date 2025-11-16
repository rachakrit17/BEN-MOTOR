// ======================================================
// BEN MOTOR – REPORT SYSTEM (REAL FIRESTORE VERSION)
// ======================================================
import {
  collection,
  getDocs,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase-init.js";

// Helper: YYYY-MM-DD → timestamp range
function toDateRange(from, to) {
  if (!from || !to) return null;
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T23:59:59");
  return { start, end };
}

// Format number & date
const nf = new Intl.NumberFormat("th-TH");
function d(x) {
  if (!x) return "-";
  return new Date(x).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ===================================================================
// 1) LOAD DATA FROM FIRESTORE --------------------------------------
// ===================================================================
async function loadJobs(range) {
  const col = collection(db, "jobs");
  let q = query(col, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  const list = [];
  snap.forEach((doc) => {
    const data = doc.data();
    if (!data.createdAt) return;

    const time = data.createdAt.toDate();

    if (range && (time < range.start || time > range.end)) return;
    list.push({ id: doc.id, ...data });
  });
  return list;
}

async function loadVehicles(range) {
  const col = collection(db, "vehicles");
  let q = query(col, orderBy("buyDate", "desc"));
  const snap = await getDocs(q);

  const list = [];
  snap.forEach((doc) => {
    const data = doc.data();
    const buy = data.buyDate ? data.buyDate.toDate() : null;

    if (range && buy && (buy < range.start || buy > range.end)) return;
    list.push({ id: doc.id, ...data });
  });
  return list;
}

async function loadStock() {
  const col = collection(db, "stock");
  const snap = await getDocs(col);
  const list = [];
  snap.forEach((doc) => list.push(doc.data()));
  return list;
}

async function loadPos(range) {
  const col = collection(db, "pos");
  const snap = await getDocs(col);

  const list = [];
  snap.forEach((doc) => {
    const data = doc.data();
    if (!data.createdAt) return;

    const time = data.createdAt.toDate();

    if (range && (time < range.start || time > range.end)) return;
    list.push({ id: doc.id, ...data });
  });
  return list;
}

// ===================================================================
// 2) UPDATE SUMMARY -------------------------------------------------
// ===================================================================
function updateSummary(jobs, vehicles, pos) {
  let totalReceive = 0;
  let totalCost = 0;
  let jobsCount = jobs.length;
  let vehiclesSold = 0;

  jobs.forEach((j) => {
    totalReceive += j.total || 0;
    // cost = spare parts (items)
    if (j.items) {
      j.items.forEach((i) => {
        totalCost += (i.unitPrice || 0) * (i.qty || 0);
      });
    }
  });

  vehicles.forEach((v) => {
    if (v.status === "sold") vehiclesSold++;
    totalReceive += v.sellPrice || 0;
    totalCost += v.buyPrice || 0;
  });

  pos.forEach((p) => {
    totalReceive += p.total || 0;
  });

  document.getElementById("summaryTotalRecords").innerText =
    (jobs.length + vehicles.length + pos.length) + " รายการ";

  document.getElementById("summaryTotalIncome").innerText =
    nf.format(totalReceive) + " บาท";

  document.getElementById("summaryTotalCost").innerText =
    nf.format(totalCost) + " บาท";

  document.getElementById("summaryNetProfit").innerText =
    nf.format(totalReceive - totalCost) + " บาท";

  document.getElementById("summaryJobsCount").innerText =
    jobsCount + " งาน";

  document.getElementById("summaryVehiclesSold").innerText =
    vehiclesSold + " คัน";
}

// ===================================================================
// 3) TABLE RENDER ---------------------------------------------------
// ===================================================================
function renderJobsTable(data) {
  const body = document.getElementById("jobsReportBody");
  const empty = document.getElementById("jobsReportEmpty");

  body.innerHTML = "";
  if (!data.length) {
    empty.classList.remove("d-none");
    return;
  }
  empty.classList.add("d-none");

  data.forEach((j) => {
    body.innerHTML += `
      <tr>
        <td>${d(j.createdAt?.toDate())}</td>
        <td>${j.vehicle?.model || ""}<br>${j.vehicle?.plate || ""}</td>
        <td>${j.customer?.name}<br>${j.customer?.phone}</td>
        <td class="text-end">${nf.format(j.total || 0)}฿</td>
        <td class="text-center">${j.status}</td>
        <td>${j.internalNote || "-"}</td>
      </tr>
    `;
  });
}

function renderVehiclesTable(data) {
  const body = document.getElementById("vehiclesReportBody");
  const empty = document.getElementById("vehiclesReportEmpty");

  body.innerHTML = "";
  if (!data.length) {
    empty.classList.remove("d-none");
    return;
  }
  empty.classList.add("d-none");

  data.forEach((v) => {
    body.innerHTML += `
      <tr>
        <td>${d(v.buyDate?.toDate())}</td>
        <td>${v.model}<br>${v.plate}</td>
        <td class="text-end">${nf.format(v.buyPrice || 0)}฿</td>
        <td class="text-end">${nf.format(v.sellPrice || 0)}฿</td>
        <td class="text-end">${nf.format(v.profit || 0)}฿</td>
        <td>${v.status}</td>
      </tr>
    `;
  });
}

function renderPosTable(data) {
  const body = document.getElementById("posReportBody");
  const empty = document.getElementById("posReportEmpty");

  body.innerHTML = "";
  if (!data.length) {
    empty.classList.remove("d-none");
    return;
  }
  empty.classList.add("d-none");

  data.forEach((p) => {
    body.innerHTML += `
      <tr>
        <td>${d(p.createdAt?.toDate())}</td>
        <td>${p.billNo}<br>${p.type}</td>
        <td>${p.customer || "-"}</td>
        <td class="text-end">${nf.format(p.total || 0)}฿</td>
        <td>${p.paymentMethod || "-"}</td>
        <td>${p.note || "-"}</td>
      </tr>
    `;
  });
}

// ===================================================================
// 4) MAIN LOAD + FILTER ---------------------------------------------
// ===================================================================
async function loadReport() {
  const from = document.getElementById("filterDateFrom").value;
  const to = document.getElementById("filterDateTo").value;

  const range = toDateRange(from, to);

  const [jobs, vehicles, pos, stock] = await Promise.all([
    loadJobs(range),
    loadVehicles(range),
    loadPos(range),
    loadStock(),
  ]);

  updateSummary(jobs, vehicles, pos);
  renderJobsTable(jobs);
  renderVehiclesTable(vehicles);
  renderPosTable(pos);
}

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("reportFilterForm")
    .addEventListener("submit", (e) => {
      e.preventDefault();
      loadReport();
    });

  // load default (30 days)
  const today = new Date();
  const past = new Date();
  past.setDate(today.getDate() - 30);
  document.getElementById("filterDateFrom").value = past
    .toISOString()
    .split("T")[0];
  document.getElementById("filterDateTo").value = today
    .toISOString()
    .split("T")[0];

  loadReport();
});
