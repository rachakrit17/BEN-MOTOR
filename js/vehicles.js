// ============================================================
// vehicles.js – BEN MOTOR POS (Card Version)
// ============================================================

import {
  db,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  serverTimestamp,
  orderBy
} from "./firebase-init.js";

import { formatCurrency, formatDate, formatDateTime, showToast } from "./utils.js";

// ------------------------------------------------------------
// Helper
// ------------------------------------------------------------
function $(id) {
  return document.getElementById(id);
}

function safeNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

const vehiclesCol = collection(db, "vehicles");

let inStockCache = [];
let soldCache = [];
let selectedVehicle = null;

// ------------------------------------------------------------
// โหลดรถจาก Firestore
// ------------------------------------------------------------
async function loadVehicleLists() {
  const stockBox = $("vehiclesStockBody");
  const soldBox = $("vehiclesSoldBody");

  if (stockBox) stockBox.innerHTML = `<div class="text-center py-3 text-muted">กำลังโหลด...</div>`;
  if (soldBox) soldBox.innerHTML = `<div class="text-center py-3 text-muted">กำลังโหลด...</div>`;

  try {
    const qStock = query(
      vehiclesCol,
      where("status", "==", "in-stock"),
      orderBy("createdAt", "desc")
    );

    const qSold = query(
      vehiclesCol,
      where("status", "==", "sold"),
      orderBy("soldAt", "desc")
    );

    const [stockSnap, soldSnap] = await Promise.all([getDocs(qStock), getDocs(qSold)]);

    inStockCache = [];
    soldCache = [];

    stockSnap.forEach(docSnap => {
      const d = docSnap.data();
      inStockCache.push({
        id: docSnap.id,
        ...d,
        createdAt: d.createdAt?.toDate?.() || null
      });
    });

    soldSnap.forEach(docSnap => {
      const d = docSnap.data();
      soldCache.push({
        id: docSnap.id,
        ...d,
        createdAt: d.createdAt?.toDate?.() || null,
        soldAt: d.soldAt?.toDate?.() || null
      });
    });

    renderStockCards();
    renderSoldCards();
  } catch (err) {
    console.error("โหลดรถไม่สำเร็จ:", err);
    if (stockBox) stockBox.innerHTML = `<div class="text-center text-danger py-3">โหลดรถค้างสต็อกไม่สำเร็จ</div>`;
    if (soldBox) soldBox.innerHTML = `<div class="text-center text-danger py-3">โหลดรถขายแล้วไม่สำเร็จ</div>`;
  }
}

// ------------------------------------------------------------
// Render – การ์ดรถค้างสต็อก
// ------------------------------------------------------------
function renderStockCards() {
  const box = $("vehiclesStockBody");
  if (!box) return;

  if (!inStockCache.length) {
    box.innerHTML = `<div class="bm-empty-state">ยังไม่มีรถค้างสต็อก</div>`;
    return;
  }

  let html = ``;

  inStockCache.forEach(v => {
    html += `
      <div class="bm-vehicle-card">
        <div class="bm-vehicle-header">
          <div class="bm-vehicle-title">
            <i class="bi bi-motorbike me-1"></i>
            ${v.model || "-"}
          </div>
          <span class="badge text-bg-secondary">ค้างสต็อก</span>
        </div>

        <div class="bm-vehicle-body">
          <div><strong>ทะเบียน:</strong> ${v.plate || "-"} (${v.vehicleProvince || "ไม่ระบุจังหวัด"})</div>
          <div><strong>ปี:</strong> ${v.year || "-"}</div>
          <div><strong>เลขไมล์:</strong> ${v.mileage || "-"} กม.</div>
          <div><strong>ราคาซื้อเข้า:</strong> <span class="text-info fw-bold">${formatCurrency(v.buyPrice || 0)}฿</span></div>
          <div><strong>วันที่ซื้อ:</strong> ${v.createdAt ? formatDateTime(v.createdAt) : "-"}</div>
          <div><strong>โน้ตสภาพ:</strong> ${v.note || "-"}</div>
        </div>

        <div class="bm-vehicle-footer">
          <button 
            class="btn btn-success btn-sm"
            data-sell-id="${v.id}">
            <i class="bi bi-cash-coin me-1"></i>บันทึกการขาย
          </button>
        </div>
      </div>
    `;
  });

  box.innerHTML = html;

  // event: sell
  box.querySelectorAll("[data-sell-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-sell-id");
      const vehicle = inStockCache.find(v => v.id === id);
      if (vehicle) openSellModal(vehicle);
    });
  });
}

// ------------------------------------------------------------
// Render – การ์ดรถขายแล้ว
// ------------------------------------------------------------
function renderSoldCards() {
  const box = $("vehiclesSoldBody");
  if (!box) return;

  if (!soldCache.length) {
    box.innerHTML = `<div class="bm-empty-state">ยังไม่มีประวัติขายรถ</div>`;
    return;
  }

  let html = ``;

  soldCache.forEach(v => {
    const profit = safeNumber(v.profit ?? (v.sellPrice - v.buyPrice - (v.extraCost || 0)));

    html += `
      <div class="bm-vehicle-card sold">
        <div class="bm-vehicle-header">
          <div class="bm-vehicle-title">
            <i class="bi bi-check-circle text-success me-1"></i>
            ${v.model || "-"}
          </div>
          <span class="badge text-bg-success">ขายแล้ว</span>
        </div>

        <div class="bm-vehicle-body">
          <div><strong>ทะเบียน:</strong> ${v.plate || "-"} (${v.vehicleProvince || "ไม่ระบุจังหวัด"})</div>
          <div><strong>ปี:</strong> ${v.year || "-"}</div>
          <div><strong>เลขไมล์:</strong> ${v.mileage || "-"} กม.</div>
          <div><strong>ราคาซื้อ:</strong> <span class="text-info">${formatCurrency(v.buyPrice || 0)}฿</span></div>
          <div><strong>ราคาขาย:</strong> <span class="text-success fw-bold">${formatCurrency(v.sellPrice || 0)}฿</span></div>
          <div><strong>กำไร:</strong> 
            <span class="${profit >= 0 ? "text-success" : "text-danger"} fw-bold">
              ${formatCurrency(profit)}฿
            </span>
          </div>
          <div><strong>วันที่ขาย:</strong> ${v.soldAt ? formatDateTime(v.soldAt) : "-"}</div>
          <div><strong>โน้ตสภาพ:</strong> ${v.note || "-"}</div>
        </div>
      </div>
    `;
  });

  box.innerHTML = html;
}

// ------------------------------------------------------------
// Form – รับซื้อรถเข้า
// ------------------------------------------------------------
async function handleBuyFormSubmit(e) {
  e.preventDefault();

  const model = $("vehicleModel").value.trim();
  const plate = $("vehiclePlate").value.trim();
  const year = $("vehicleYear").value.trim();
  const mileage = $("vehicleOdo").value.trim();
  const price = safeNumber($("vehicleBuyPrice").value);
  const province = $("vehicleProvince")?.value.trim() || "";
  const condition = $("vehicleCondition").value.trim();

  if (!model || !price) {
    showToast("กรุณากรอก รุ่นรถ และ ราคาซื้อ", "error");
    return;
  }

  const now = new Date();

  const payload = {
    model,
    plate,
    vehicleProvince: province,
    year,
    mileage,
    buyPrice: price,
    note: condition,
    status: "in-stock",
    createdAt: serverTimestamp(),
    createdLocalAt: now
  };

  try {
    await addDoc(vehiclesCol, payload);
    showToast("บันทึกการรับซื้อรถเรียบร้อย", "success");
    e.target.reset();
    loadVehicleLists();
  } catch (err) {
    showToast("บันทึกรถไม่สำเร็จ", "error");
  }
}

// ------------------------------------------------------------
// Modal – ขายรถ
// ------------------------------------------------------------
function openSellModal(v) {
  selectedVehicle = v;

  $("vehicleSellLabel").value =
    `${v.model} • ทะเบียน ${v.plate} (${v.vehicleProvince || "-"})`;

  $("vehicleSellBuyPrice").value = v.buyPrice || 0;
  $("vehicleSellSalePrice").value = v.sellPrice || "";
  $("vehicleSellRepairCost").value = v.extraCost || 0;

  new bootstrap.Modal($("vehicleSellModal")).show();
}

async function handleSellSave() {
  if (!selectedVehicle) return;

  const buy = safeNumber($("vehicleSellBuyPrice").value);
  const sell = safeNumber($("vehicleSellSalePrice").value);
  const extra = safeNumber($("vehicleSellRepairCost").value);

  if (!sell) {
    showToast("กรุณากรอกราคาขาย", "error");
    return;
  }

  const profit = sell - buy - extra;

  try {
    await updateDoc(doc(db, "vehicles", selectedVehicle.id), {
      buyPrice: buy,
      sellPrice: sell,
      extraCost: extra,
      profit,
      status: "sold",
      soldAt: serverTimestamp()
    });

    showToast("บันทึกการขายเรียบร้อย", "success");
    selectedVehicle = null;

    bootstrap.Modal.getInstance($("vehicleSellModal")).hide();
    loadVehicleLists();
  } catch (err) {
    showToast("บันทึกการขายรถไม่สำเร็จ", "error");
  }
}

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------
function initVehicles() {
  if (!$("vehicleBuyForm")) return;

  $("vehicleBuyForm").addEventListener("submit", handleBuyFormSubmit);
  $("vehicleSellSaveBtn").addEventListener("click", handleSellSave);

  loadVehicleLists();
}

document.addEventListener("DOMContentLoaded", initVehicles);

export { initVehicles };
