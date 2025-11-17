// BEN MOTOR POS – Dashboard Logic
// ดึงข้อมูลจาก Firestore มาสรุปแสดงบนแดชบอร์ด

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

// คืน Date 00:00 ของวันนี้
function getStartOfToday() {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );
}

const jobsCol = collection(db, "jobs");
const stockCol = collection(db, "stock");
const vehiclesCol = collection(db, "vehicles");

// -----------------------------
// โหลดสรุปงานซ่อมวันนี้ + งานด่วน + รถค้างในอู่
// + รวม "ยอดขายรถวันนี้" เข้าไปในยอดวันนี้ด้วย
// -----------------------------
async function loadTodayJobsSummary() {
  const totalEl = $("dashTotalToday");
  const jobsTodayEl = $("dashJobsToday");
  const urgentCountEl = $("dashUrgentJobsCount");
  const urgentListEl = $("dashUrgentJobsList");
  const pendingVehiclesEl = $("dashVehiclesPending");

  if (
    !totalEl &&
    !jobsTodayEl &&
    !urgentCountEl &&
    !urgentListEl &&
    !pendingVehiclesEl
  ) {
    return;
  }

  // ยอดวันนี้ = งานซ่อมที่ปิดบิลแล้ว + ยอดขายรถวันนี้
  let totalToday = 0;
  // จำนวนงานซ่อมวันนี้
  let jobsToday = 0;
  // รถค้างในอู่ (งานที่ยังไม่ done)
  let pendingJobsCount = 0;
  const urgentJobs = [];

  const startOfToday = getStartOfToday();

  try {
    // ดึง jobs + vehicles มาพร้อมกัน
    const [jobsSnap, vehiclesSnap] = await Promise.all([
      getDocs(jobsCol),
      getDocs(vehiclesCol),
    ]);

    // ---------- งานซ่อม ----------
    jobsSnap.forEach((docSnap) => {
      const data = docSnap.data() || {};

      const createdAt =
        toJsDate(
          data.createdAt ||
            data.created_at ||
            data.createdDate ||
            data.created_on ||
            data.openedAt
        ) || null;

      const status = data.status || "queue";
      const priority = data.priority || data.urgency || data.jobUrgency || "";

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
      const customerPhone = customer.phone || data.customerPhone || "";

      // รถค้างในอู่ = ทุกงานที่ยังไม่ done
      if (status !== "done") {
        pendingJobsCount += 1;
      }

      // งานที่ไม่ใช่วันนี้ ตัดออก
      if (!createdAt || createdAt < startOfToday) {
        return;
      }

      jobsToday += 1;

      // นับยอดเฉพาะงานที่ปิดบิลแล้ว
      if (status === "done") {
        totalToday += safeNumber(net, 0);
      }

      const priorityLower = String(priority).toLowerCase();
      if (priorityLower === "urgent" || priorityLower.includes("ด่วน")) {
        urgentJobs.push({
          id: docSnap.id,
          plate,
          model,
          customerName,
          customerPhone,
          net: safeNumber(net, 0),
          createdAt,
        });
      }
    });

    // ---------- ยอดขายรถวันนี้ ----------
    vehiclesSnap.forEach((docSnap) => {
      const data = docSnap.data() || {};

      const status = data.status || "";
      if (status !== "sold") return; // นับเฉพาะรถที่ขายแล้ว

      const soldAt =
        toJsDate(
          data.soldAt ||
            data.sellDate ||
            data.sold_on ||
            data.updatedAt ||
            data.createdAt
        ) || null;

      if (!soldAt || soldAt < startOfToday) return; // ไม่ใช่วันนี้ ตัดออก

      const sellPrice = safeNumber(
        data.sellPrice ??
          data.priceSell ??
          data.totalSell ??
          data.salePrice ??
          0,
        0
      );

      // เพิ่มยอดขายรถวันนี้เข้าไปในยอดรวม
      totalToday += sellPrice;
    });

    // ---------- อัปเดต UI ----------
    if (totalEl) {
      totalEl.textContent = `${formatCurrency(totalToday)} บาท`;
    }

    if (jobsTodayEl) {
      jobsTodayEl.textContent = `${jobsToday} งาน`;
    }

    if (pendingVehiclesEl) {
      pendingVehiclesEl.textContent = `${pendingJobsCount} คัน`;
    }

    if (urgentCountEl) {
      urgentCountEl.textContent = `${urgentJobs.length} งาน`;
    }

    if (urgentListEl) {
      if (!urgentJobs.length) {
        urgentListEl.innerHTML = `
          <div class="bm-empty-state">
            ยังไม่มีงานด่วนวันนี้
          </div>
        `;
      } else {
        urgentJobs.sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0;
          return a.createdAt - b.createdAt;
        });

        const itemsHtml = urgentJobs
          .slice(0, 5)
          .map((job) => {
            const title = job.plate || job.model || job.customerName || job.id;
            const subtitleParts = [];
            if (job.model) subtitleParts.push(job.model);
            if (job.customerName) subtitleParts.push(job.customerName);
            const subtitle = subtitleParts.join(" • ");
            const timeText = job.createdAt ? formatDateTime(job.createdAt) : "";
            const moneyText = formatCurrency(job.net || 0);

            return `
              <div class="d-flex justify-content-between align-items-center mb-2">
                <div class="me-2">
                  <div class="fw-semibold">${title}</div>
                  <div class="text-muted small">${subtitle}</div>
                  <div class="text-muted small">${timeText}</div>
                </div>
                <div class="text-end">
                  <div class="fw-semibold">${moneyText} บาท</div>
                </div>
              </div>
            `;
          })
          .join("");

        urgentListEl.innerHTML = itemsHtml;
      }
    }
  } catch (error) {
    console.error("โหลดสรุปงานวันนี้ไม่สำเร็จ:", error);
  }
}

// -----------------------------
// โหลดสรุป "ซื้อรถวันนี้ / ซื้ออะไหล่วันนี้"
// -----------------------------
async function loadTodayBuySummary() {
  const vehiclesTodayEl = $("dashVehiclesBuyToday");
  const partsQtyTodayEl = $("dashPartsBuyQtyToday");
  const partsAmountTodayEl = $("dashPartsBuyAmountToday");

  // ถ้าไม่ได้วางการ์ด 3 ใบนี้ไว้ ก็ไม่ต้องทำอะไร
  if (!vehiclesTodayEl && !partsQtyTodayEl && !partsAmountTodayEl) {
    return;
  }

  const startOfToday = getStartOfToday();

  let vehiclesToday = 0;
  let partsQtyToday = 0;
  let partsAmountToday = 0;

  try {
    // 1) ซื้อรถวันนี้ = vehicles ที่ createdAt / buyDate เป็นวันนี้
    const vehiclesSnap = await getDocs(vehiclesCol);
    vehiclesSnap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const createdAt =
        toJsDate(
          data.buyDate ||
            data.createdAt ||
            data.created_at ||
            data.createdOn
        ) || null;

      if (!createdAt || createdAt < startOfToday) return;
      vehiclesToday += 1;
    });

    // 2) ซื้ออะไหล่วันนี้ = stock ที่มีวันที่รับเข้าเป็นวันนี้
    //    (เดาว่า field จะประมาณ receivedAt / receivedDate / createdAt)
    const stockSnap = await getDocs(stockCol);
    stockSnap.forEach((docSnap) => {
      const data = docSnap.data() || {};

      const receivedAt =
        toJsDate(
          data.receivedAt ||
            data.receivedDate ||
            data.importDate ||
            data.createdAt ||
            data.created_at
        ) || null;

      if (!receivedAt || receivedAt < startOfToday) return;

      const qty = safeNumber(
        data.qty ?? data.quantity ?? data.stock ?? 0,
        0
      );
      const costPerUnit = safeNumber(
        data.cost ?? data.costPerUnit ?? data.priceCost ?? data.priceBuy ?? 0,
        0
      );

      partsQtyToday += qty;
      partsAmountToday += qty * costPerUnit;
    });

    if (vehiclesTodayEl) {
      vehiclesTodayEl.textContent = `${vehiclesToday} คัน`;
    }
    if (partsQtyTodayEl) {
      partsQtyTodayEl.textContent = `${partsQtyToday} ชิ้น`;
    }
    if (partsAmountTodayEl) {
      partsAmountTodayEl.textContent =
        `${formatCurrency(partsAmountToday)} บาท`;
    }
  } catch (error) {
    console.error("โหลดสรุปซื้อรถ/อะไหล่วันนี้ไม่สำเร็จ:", error);
  }
}

// -----------------------------
// โหลดสรุปอะไหล่ใกล้หมด
// -----------------------------
async function loadLowStockSummary() {
  const countEl = $("dashLowStockCount");
  const listEl = $("dashLowStockList");

  if (!countEl && !listEl) return;

  try {
    const snap = await getDocs(stockCol);

    const lowItems = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const qty = safeNumber(
        data.qty ?? data.quantity ?? data.stock ?? 0,
        0
      );
      const minStock = safeNumber(
        data.minStock ?? data.min ?? 0,
        0
      );

      if (minStock > 0 && qty <= minStock) {
        lowItems.push({
          id: docSnap.id,
          name:
            data.name ||
            data.partName ||
            `อะไหล่ไม่ระบุ (${docSnap.id.slice(-6)})`,
          category: data.category || "",
          qty,
          minStock,
        });
      }
    });

    if (countEl) {
      countEl.textContent = `${lowItems.length} รายการ`;
    }

    if (listEl) {
      if (!lowItems.length) {
        listEl.innerHTML = `
          <div class="bm-empty-state">
            ยังไม่มีอะไหล่ใกล้หมด
          </div>
        `;
      } else {
        const itemsHtml = lowItems
          .slice(0, 5)
          .map((item) => {
            return `
      <div class="bm-dash-vehicle-item d-flex justify-content-between align-items-center mb-2 p-2 rounded-3 border">
        <div class="me-2">
          <div class="fw-semibold text-danger">
            <i class="bi bi-exclamation-octagon-fill me-1"></i>${item.name}
          </div>
          <div class="text-muted small">
            คงเหลือ ${item.qty} ชิ้น • min ${item.minStock}
          </div>
        </div>
        <span class="fw-bold text-danger">${item.qty}/${item.minStock}</span>
      </div>
    `;
          })
          .join("");

        listEl.innerHTML = itemsHtml;
      }
    }
  } catch (error) {
    console.error("โหลดสรุปอะไหล่ใกล้หมดไม่สำเร็จ:", error);
  }
}

// -----------------------------
// โหลดสรุปรถซื้อ–ขาย และสถิติรวม (รวมกำไร)
// -----------------------------
async function loadVehiclesSummary() {
  const buyTotalEl = $("dashTotalBuy");
  const sellTotalEl = $("dashTotalSell");
  const profitTotalEl = $("dashTotalProfit");
  const listEl = $("dashVehiclesInStock");
  const inStockBadgeEl = $("dashVehiclesInStockBadge"); // optional badge

  if (
    !listEl &&
    !buyTotalEl &&
    !sellTotalEl &&
    !profitTotalEl &&
    !inStockBadgeEl
  )
    return;

  try {
    const snap = await getDocs(vehiclesCol);

    const inStock = [];
    let totalBuy = 0;
    let totalSell = 0;
    let totalProfit = 0;

    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};

      const buyPrice = safeNumber(
        data.buyPrice ?? data.purchasePrice ?? data.priceBuy ?? 0,
        0
      );
      const sellPrice = safeNumber(
        data.sellPrice ?? data.priceSell ?? 0,
        0
      );
      const repairCost = safeNumber(
        data.repairCost ?? data.repair ?? 0,
        0
      );

      totalBuy += buyPrice;

      if (data.status === "sold") {
        totalSell += sellPrice;

        const profit = safeNumber(
          data.profit ?? sellPrice - buyPrice - repairCost,
          0
        );
        totalProfit += profit;
      }

      // รถที่ยังค้างสต็อก
      if (data.status === "in-stock" || data.status === "stock") {
        const createdAt =
          toJsDate(
            data.createdAt ||
              data.created_at ||
              data.buyDate ||
              data.createdOn
          ) || null;

        const model =
          data.model || data.vehicleModel || data.name || "ไม่ระบุรุ่น";
        const plate = data.plate || data.license || "";

        inStock.push({
          id: docSnap.id,
          model,
          plate,
          buyPrice,
          createdAt,
        });
      }
    });

    // อัปเดตยอดรวม
    if (buyTotalEl) {
      buyTotalEl.textContent = `${formatCurrency(totalBuy)} บาท`;
    }
    if (sellTotalEl) {
      sellTotalEl.textContent = `${formatCurrency(totalSell)} บาท`;
    }
    if (profitTotalEl) {
      profitTotalEl.textContent = `${formatCurrency(totalProfit)} บาท`;
    }

    if (inStockBadgeEl) {
      inStockBadgeEl.textContent = `${inStock.length} คัน`;
    }

    if (!listEl) return;

    if (!inStock.length) {
      listEl.innerHTML = `
        <div class="bm-empty-state">
          ยังไม่มีรถซื้อเข้าในระบบ
        </div>
      `;
      return;
    }

    inStock.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return b.createdAt - a.createdAt;
    });

    const itemsHtml = inStock
      .slice(0, 5)
      .map((v) => {
        const title = v.model || v.plate || "รถไม่ระบุ";
        const subtitleParts = [];
        if (v.plate) subtitleParts.push(v.plate);
        if (v.createdAt) subtitleParts.push(formatDateTime(v.createdAt));
        const subtitle = subtitleParts.join(" • ");
        const buyText = formatCurrency(v.buyPrice || 0);

        return `
  <div class="bm-dash-vehicle-item d-flex justify-content-between align-items-center mb-2 p-2 rounded-3 border">
    <div class="me-2">
      <div class="bm-vehicle-title">
        <i class="bi bi-scooter me-1"></i>${title}
      </div>
      <div class="bm-vehicle-date">${subtitle}</div>
    </div>
    <div class="text-end">
      <div class="text-muted small">ราคาซื้อ</div>
      <div class="bm-vehicle-buyprice">${buyText} บาท</div>
    </div>
  </div>
        `;
      })
      .join("");

    listEl.innerHTML = itemsHtml;
  } catch (error) {
    console.error("โหลดสรุปรถซื้อ–ขายไม่สำเร็จ:", error);
  }
}

// -----------------------------
// Init
// -----------------------------
export async function initDashboard() {
  const section = document.querySelector('[data-section="dashboard"]');
  if (!section) return;

  await Promise.all([
    loadTodayJobsSummary(),
    loadTodayBuySummary(), // ✅ สรุปซื้อรถ/อะไหล่วันนี้
    loadLowStockSummary(),
    loadVehiclesSummary(),
  ]);
}

// Bootstrap – รันเมื่อ DOM พร้อม
document.addEventListener("DOMContentLoaded", () => {
  initDashboard();
});