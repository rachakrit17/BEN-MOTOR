// ============================================================
// vehicles.js – BEN MOTOR POS (Card Version, สีตรงตามที่ต้องการ)
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

import { formatCurrency, formatDateTime, showToast } from "./utils.js";

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

  if (stockBox) {
    stockBox.innerHTML =
      `<div class="text-center py-3 text-muted">กำลังโหลด...</div>`;
  }
  if (soldBox) {
    soldBox.innerHTML =
      `<div class="text-center py-3 text-muted">กำลังโหลด...</div>`;
  }

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

    const [stockSnap, soldSnap] = await Promise.all([
      getDocs(qStock),
      getDocs(qSold)
    ]);

    inStockCache = [];
    soldCache = [];

    stockSnap.forEach((docSnap) => {
      const d = docSnap.data() || {};
      inStockCache.push({
        id: docSnap.id,
        ...d,
        createdAt: d.createdAt?.toDate?.() || null
      });
    });

    soldSnap.forEach((docSnap) => {
      const d = docSnap.data() || {};
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
    if (stockBox) {
      stockBox.innerHTML =
        `<div class="text-center text-danger py-3">โหลดรถค้างสต็อกไม่สำเร็จ</div>`;
    }
    if (soldBox) {
      soldBox.innerHTML =
        `<div class="text-center text-danger py-3">โหลดรถขายแล้วไม่สำเร็จ</div>`;
    }
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

  inStockCache.forEach((v) => {
    const modelText = v.model || "-";
    const plateText = v.plate || "-";
    const provinceText = v.vehicleProvince || "ไม่ระบุจังหวัด";
    const yearText = v.year || "-";
    const mileageText = v.mileage || "-";
    const buyPrice = safeNumber(v.buyPrice);

    html += `
      <div class="bm-vehicle-card in-stock">
        <div class="bm-vehicle-header">
          <div class="bm-vehicle-title">
            <i class="bi bi-motorbike me-1"></i>
            ${modelText}
          </div>
          <span class="badge bm-vehicle-status-badge in-stock">ค้างสต็อก</span>
        </div>

        <div class="bm-vehicle-body">
          <div><strong>ทะเบียน:</strong> ${plateText} (${provinceText})</div>
          <div><strong>ปี:</strong> ${yearText}</div>
          <div><strong>เลขไมล์:</strong> ${mileageText} กม.</div>

          <div class="mt-1">
            <strong>ราคาซื้อเข้า:</strong>
            <span class="text-dark fw-bold">
              ${formatCurrency(buyPrice || 0)}฿
            </span>
          </div>

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

  // event: กดปุ่มบันทึกการขาย
  box.querySelectorAll("[data-sell-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-sell-id");
      const vehicle = inStockCache.find((v) => v.id === id);
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

  soldCache.forEach((v) => {
    const modelText = v.model || "-";
    const plateText = v.plate || "-";
    const provinceText = v.vehicleProvince || "ไม่ระบุจังหวัด";
    const yearText = v.year || "-";
    const mileageText = v.mileage || "-";

    const buyPrice = safeNumber(v.buyPrice);
    const sellPrice = safeNumber(v.sellPrice);
    const extraCost = safeNumber(v.extraCost || v.repairCost || 0);
    const profit = safeNumber(
      v.profit != null ? v.profit : sellPrice - buyPrice - extraCost
    );

    html += `
      <div class="bm-vehicle-card sold">
        <div class="bm-vehicle-header">
          <div class="bm-vehicle-title">
            <i class="bi bi-check-circle text-success me-1"></i>
            ${modelText}
          </div>
          <span class="badge bm-vehicle-status-badge sold">ขายแล้ว</span>
        </div>

        <div class="bm-vehicle-body">
          <div><strong>ทะเบียน:</strong> ${plateText} (${provinceText})</div>
          <div><strong>ปี:</strong> ${yearText}</div>
          <div><strong>เลขไมล์:</strong> ${mileageText} กม.</div>

          <div class="mt-1">
            <strong>ราคาซื้อ:</strong>
            <span class="text-dark fw-semibold">
              ${formatCurrency(buyPrice || 0)}฿
            </span>
          </div>

<div>
  <strong>ค่าใช้จ่ายซ่อม / ทำสภาพ:</strong>
  <span class="text-primary fw-semibold">
    ${formatCurrency(extraCost)}฿
  </span>
</div>

          <div>
            <strong>ราคาขาย:</strong>
            <span class="text-danger fw-bold">
              ${formatCurrency(sellPrice || 0)}฿
            </span>
          </div>

          <div>
            <strong>กำไร:</strong>
            <span class="text-success fw-bold">
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

  const modelEl = $("vehicleModel");
  const plateEl = $("vehiclePlate");
  const yearEl = $("vehicleYear");
  const odoEl = $("vehicleOdo");
  const priceEl = $("vehicleBuyPrice");
  const provinceEl = $("vehicleProvince");
  const conditionEl = $("vehicleCondition");

  const model = modelEl?.value.trim() || "";
  const plate = plateEl?.value.trim() || "";
  const year = yearEl?.value.trim() || "";
  const mileage = odoEl?.value.trim() || "";
  const price = safeNumber(priceEl?.value || 0);
  const province = provinceEl?.value.trim() || "";
  const condition = conditionEl?.value.trim() || "";

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
    console.error("บันทึกรถไม่สำเร็จ:", err);
    showToast("บันทึกรถไม่สำเร็จ", "error");
  }
}

// ------------------------------------------------------------
// Modal – ขายรถ
// ------------------------------------------------------------
function openSellModal(v) {
  selectedVehicle = v;

  const labelInput = $("vehicleSellLabel");
  const buyInput = $("vehicleSellBuyPrice");
  const saleInput = $("vehicleSellSalePrice");
  const repairInput = $("vehicleSellRepairCost");
  const modalEl = $("vehicleSellModal");

  if (!modalEl || !window.bootstrap) return;

  labelInput.value =
    `${v.model || "-"} • ทะเบียน ${v.plate || "-"} (${v.vehicleProvince || "-"})`;
  buyInput.value = safeNumber(v.buyPrice || 0);
  saleInput.value = v.sellPrice != null ? v.sellPrice : "";
  repairInput.value = safeNumber(v.extraCost || v.repairCost || 0);

  const modal = new window.bootstrap.Modal(modalEl);
  modal.show();
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

    const modalEl = $("vehicleSellModal");
    if (modalEl && window.bootstrap) {
      const instance = window.bootstrap.Modal.getInstance(modalEl);
      if (instance) instance.hide();
    }

    loadVehicleLists();
  } catch (err) {
    console.error("บันทึกการขายรถไม่สำเร็จ:", err);
    showToast("บันทึกการขายรถไม่สำเร็จ", "error");
  }
}

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------
function initVehicles() {
  const buyForm = $("vehicleBuyForm");
  if (!buyForm) return;

  buyForm.addEventListener("submit", handleBuyFormSubmit);

  const sellBtn = $("vehicleSellSaveBtn");
  if (sellBtn) {
    sellBtn.addEventListener("click", handleSellSave);
  }

  loadVehicleLists();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initVehicles);
} else {
  initVehicles();
}

export { initVehicles };
