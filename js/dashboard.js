// BEN MOTOR POS – Dashboard Logic
// ดึงข้อมูลจาก Firestore มาสรุปแสดงบนแดชบอร์ด

import {
  db,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs
} from "./firebase-init.js";

import { formatCurrency, formatDateTime } from "./utils.js";

// -----------------------------
// Firestore refs
// -----------------------------
const jobsCol = collection(db, "jobs");
const stockCol = collection(db, "stock");
const vehiclesCol = collection(db, "vehicles");

// -----------------------------
// Helpers: วันที่วันนี้ (ช่วงเวลาเริ่ม-จบของวัน)
// -----------------------------
function getTodayRange() {
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  );
  return { start, end };
}

// อ่าน field แบบปลอดภัย
function getNumber(value, fallback = 0) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num;
}

// -----------------------------
// Render helpers (เขียนเฉพาะถ้ามี element นั้น ๆ)
// -----------------------------
function setTextIfExists(id, text) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text;
  }
}

function renderListIfExists(id, itemsHtml) {
  const el = document.getElementById(id);
  if (el) {
    el.innerHTML = itemsHtml;
  }
}

// -----------------------------
// Load: Today Jobs Summary
// -----------------------------
async function loadTodayJobsSummary() {
  const { start, end } = getTodayRange();

  try {
    const qToday = query(
      jobsCol,
      where("createdAt", ">=", start),
      where("createdAt", "<=", end)
    );

    const snap = await getDocs(qToday);
    let totalToday = 0;
    let totalJobs = 0;

    let pending = 0;
    let inProgress = 0;
    let waitParts = 0;
    let waitPayment = 0;
    let done = 0;

    const urgentJobs = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const status = data.status || "queue";
      const totalNet =
        getNumber(data.totalNet) ||
        getNumber(data.total) ||
        getNumber(data.grandTotal);

      totalJobs += 1;

      // ยอดรวมวันนี้นับเฉพาะงานที่ปิดบิลแล้ว
      if (status === "done") {
        totalToday += totalNet;
      }

      switch (status) {
        case "queue":
          pending += 1;
          break;
        case "in-progress":
          inProgress += 1;
          break;
        case "waiting-parts":
          waitParts += 1;
          break;
        case "waiting-payment":
          waitPayment += 1;
          break;
        case "done":
          done += 1;
          break;
        default:
          pending += 1;
      }

      if (data.priority === "urgent" || data.priority === "ด่วน") {
        urgentJobs.push({
          id: docSnap.id,
          plate: data.vehicle?.plate || data.plate || "-",
          model: data.vehicle?.model || data.model || "",
          customer: data.customer?.name || data.customerName || "",
          createdAt: data.createdAt,
          status,
          total: totalNet
        });
      }
    });

    // อัปเดตการ์ดสรุปวันนี้
    setTextIfExists("dashboardTodayTotal", formatCurrency(totalToday) + " บาท");
    setTextIfExists("dashboardTodayJobsCount", totalJobs.toString());
    setTextIfExists("dashboardTodayDoneCount", done.toString());

    const pendingAll = pending + inProgress + waitParts + waitPayment;
    setTextIfExists("dashboardTodayPendingCount", pendingAll.toString());

    // jobs breakdown สำหรับ tooltip หรือ text เล็ก ๆ ถ้ามี element
    const breakdownText =
      `ค้างคิว: ${pending} | กำลังซ่อม: ${inProgress} | รออะไหล่: ${waitParts} | รอชำระ: ${waitPayment}`;
    setTextIfExists("dashboardTodayJobsBreakdown", breakdownText);

    // งานด่วนวันนี้
    let urgentHtml = "";
    if (!urgentJobs.length) {
      urgentHtml = `
        <div class="bm-empty-state">
          ยังไม่มีงานด่วนในวันนี้
        </div>
      `;
    } else {
      urgentHtml = urgentJobs
        .slice(0, 10)
        .map((job) => {
          const label = [
            job.plate || "-",
            job.model ? ` (${job.model})` : ""
          ].join("");

          const customerLabel = job.customer || "ไม่ระบุลูกค้า";
          const timeLabel = job.createdAt
            ? formatDateTime(job.createdAt)
            : "";

          return `
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div>
                <div class="fw-semibold">${label}</div>
                <div class="small text-muted">${customerLabel}</div>
                ${
                  timeLabel
                    ? `<div class="small text-muted">${timeLabel}</div>`
                    : ""
                }
              </div>
              <div class="text-end">
                <div class="fw-semibold">${formatCurrency(job.total)}฿</div>
                <div>
                  <span class="badge rounded-pill text-bg-warning">ด่วน</span>
                </div>
              </div>
            </div>
          `;
        })
        .join("");
    }

    renderListIfExists("dashboardUrgentJobsList", urgentHtml);
  } catch (error) {
    console.error("โหลดข้อมูลงานวันนี้ไม่สำเร็จ:", error);
  }
}

// -----------------------------
// Load: Low Stock
// -----------------------------
async function loadLowStockSummary() {
  try {
    // ดึงอะไหล่ทั้งหมด (ถ้าในอนาคตข้อมูลเยอะมาก ค่อยเพิ่ม where / limit)
    const snap = await getDocs(stockCol);

    const low = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const qty = getNumber(data.qty ?? data.quantity ?? data.stock ?? 0);
      const minStock = getNumber(data.minStock ?? data.min ?? 0);

      if (minStock > 0 && qty <= minStock) {
        low.push({
          id: docSnap.id,
          name: data.name || data.partName || "ไม่ระบุชื่ออะไหล่",
          category: data.category || data.type || "",
          qty,
          minStock,
          salePrice: getNumber(data.salePrice ?? data.price ?? 0)
        });
      }
    });

    setTextIfExists("dashboardLowStockCount", low.length.toString());

    let html = "";
    if (!low.length) {
      html = `
        <div class="bm-empty-state">
          ตอนนี้ยังไม่มีอะไหล่ที่ใกล้หมด
        </div>
      `;
    } else {
      html = low
        .sort((a, b) => a.qty - b.qty)
        .slice(0, 8)
        .map((item) => {
          const cat = item.category ? ` • ${item.category}` : "";
          return `
          <div class="d-flex justify-content-between align-items-center mb-2">
            <div>
              <div class="fw-semibold">${item.name}</div>
              <div class="small text-muted">
                คงเหลือ ${item.qty} | จุดสั่งซื้อซ้ำ ${item.minStock}${cat}
              </div>
            </div>
            <div class="text-end">
              ${
                item.salePrice
                  ? `<div class="small">${formatCurrency(
                      item.salePrice
                    )}฿</div>`
                  : ""
              }
              <span class="badge rounded-pill text-bg-danger">ใกล้หมด</span>
            </div>
          </div>
        `;
        })
        .join("");
    }

    renderListIfExists("dashboardLowStockList", html);
  } catch (error) {
    console.error("โหลดข้อมูลอะไหล่ใกล้หมดไม่สำเร็จ:", error);
  }
}

// -----------------------------
// Load: Vehicles (ซื้อ–ขาย)
// -----------------------------
async function loadVehiclesSummary() {
  try {
    const qInStock = query(
      vehiclesCol,
      where("status", "==", "in-stock")
    );
    const qSold = query(
      vehiclesCol,
      where("status", "==", "sold"),
      orderBy("soldAt", "desc"),
      limit(5)
    );

    const [inStockSnap, soldSnap] = await Promise.all([
      getDocs(qInStock),
      getDocs(qSold)
    ]);

    const inStock = [];
    const soldRecent = [];

    inStockSnap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      inStock.push({
        id: docSnap.id,
        brand: data.brand || data.make || "",
        model: data.model || "",
        plate: data.plate || data.license || "",
        buyPrice: getNumber(data.buyPrice ?? data.costPrice ?? 0)
      });
    });

    soldSnap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const buyPrice = getNumber(data.buyPrice ?? data.costPrice ?? 0);
      const sellPrice = getNumber(data.sellPrice ?? data.salePrice ?? 0);
      const profit = sellPrice - buyPrice;

      soldRecent.push({
        id: docSnap.id,
        brand: data.brand || data.make || "",
        model: data.model || "",
        plate: data.plate || data.license || "",
        buyPrice,
        sellPrice,
        profit,
        soldAt: data.soldAt
      });
    });

    setTextIfExists("dashboardVehiclesInStockCount", inStock.length.toString());

    let inStockHtml = "";
    if (!inStock.length) {
      inStockHtml = `
        <div class="bm-empty-state">
          ยังไม่มีรถที่ค้างสต็อก
        </div>
      `;
    } else {
      inStockHtml = inStock
        .slice(0, 5)
        .map((v) => {
          const name = `${v.brand} ${v.model}`.trim() || "ไม่ระบุรุ่น";
          const plate = v.plate || "-";
          return `
          <div class="d-flex justify-content-between align-items-center mb-2">
            <div>
              <div class="fw-semibold">${name}</div>
              <div class="small text-muted">ทะเบียน ${plate}</div>
            </div>
            <div class="text-end">
              ${
                v.buyPrice
                  ? `<div class="small">ราคาซื้อ ${formatCurrency(
                      v.buyPrice
                    )}฿</div>`
                  : ""
              }
              <span class="badge rounded-pill text-bg-secondary">ค้างสต็อก</span>
            </div>
          </div>
        `;
        })
        .join("");
    }

    renderListIfExists("dashboardVehiclesInStockList", inStockHtml);

    // กำไรจากรถขายล่าสุด (ถ้ามี element ไว้)
    let soldHtml = "";
    if (!soldRecent.length) {
      soldHtml = `
        <div class="bm-empty-state">
          ยังไม่มีประวัติขายรถล่าสุด
        </div>
      `;
    } else {
      soldHtml = soldRecent
        .map((v) => {
          const name = `${v.brand} ${v.model}`.trim() || "ไม่ระบุรุ่น";
          const plate = v.plate || "-";
          const profitText = formatCurrency(v.profit) + "฿";
          const soldAtText = v.soldAt ? formatDateTime(v.soldAt) : "";

          return `
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <div class="fw-semibold">${name}</div>
              <div class="small text-muted">ทะเบียน ${plate}</div>
              ${
                soldAtText
                  ? `<div class="small text-muted">ขายเมื่อ ${soldAtText}</div>`
                  : ""
              }
            </div>
            <div class="text-end">
              <div class="small">ขาย ${formatCurrency(v.sellPrice)}฿</div>
              <div class="small text-success fw-semibold">
                กำไร ${profitText}
              </div>
            </div>
          </div>
        `;
        })
        .join("");
    }

    renderListIfExists("dashboardVehiclesSoldList", soldHtml);
  } catch (error) {
    console.error("โหลดข้อมูลรถซื้อ–ขายไม่สำเร็จ:", error);
  }
}

// -----------------------------
// Entry – เรียกเมื่ออยู่ในหน้า app.html เท่านั้น
// -----------------------------
async function initDashboard() {
  // ถ้าไม่มี section-dashboard ให้ไม่ต้องทำอะไร
  const section = document.querySelector('[data-section="dashboard"]');
  if (!section) return;

  await Promise.all([
    loadTodayJobsSummary(),
    loadLowStockSummary(),
    loadVehiclesSummary()
  ]);
}

document.addEventListener("DOMContentLoaded", () => {
  initDashboard();
});