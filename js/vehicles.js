// vehicles.js – รถซื้อ–ขาย BEN MOTOR POS (เวอร์ชันตรงกับ app.html ปัจจุบัน)

import {
  db,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "./firebase-init.js";
import { formatCurrency, formatDateTime, showToast } from "./utils.js";

// -----------------------------
// Helpers
// -----------------------------
const vehiclesCol = collection(db, "vehicles");

function $(id) {
  return document.getElementById(id);
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

let inStockCache = [];
let soldCache = [];
let selectedVehicle = null;

// -----------------------------
// โหลดรายการรถจาก Firestore
// -----------------------------
async function loadVehiclesLists() {
  const stockTbody = $("vehiclesStockBody");
  const soldTbody = $("vehiclesSoldBody");

  if (stockTbody) {
    stockTbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-3 text-muted">
          กำลังโหลดข้อมูลรถค้างสต็อกจากระบบ...
        </td>
      </tr>
    `;
  }

  if (soldTbody) {
    soldTbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-3 text-muted">
          กำลังโหลดประวัติขายรถจากระบบ...
        </td>
      </tr>
    `;
  }

  try {
    const qInStock = query(
      vehiclesCol,
      where("status", "==", "in-stock"),
      orderBy("createdAt", "desc")
    );

    const qSold = query(
      vehiclesCol,
      where("status", "==", "sold"),
      orderBy("soldAt", "desc")
    );

    const [inStockSnap, soldSnap] = await Promise.all([
      getDocs(qInStock),
      getDocs(qSold)
    ]);

    inStockCache = [];
    soldCache = [];

    inStockSnap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const createdAt = data.createdAt?.toDate
        ? data.createdAt.toDate()
        : data.createdAt instanceof Date
        ? data.createdAt
        : null;

      inStockCache.push({
        id: docSnap.id,
        ...data,
        createdAt
      });
    });

    soldSnap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const createdAt = data.createdAt?.toDate
        ? data.createdAt.toDate()
        : data.createdAt instanceof Date
        ? data.createdAt
        : null;

      const soldAt = data.soldAt?.toDate
        ? data.soldAt.toDate()
        : data.soldAt instanceof Date
        ? data.soldAt
        : null;

      soldCache.push({
        id: docSnap.id,
        ...data,
        createdAt,
        soldAt
      });
    });

    renderInStockTable();
    renderSoldTable();
  } catch (error) {
    console.error("โหลดข้อมูลรถซื้อ–ขายไม่สำเร็จ:", error);
    if (stockTbody) {
      stockTbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-3 text-danger">
            โหลดข้อมูลรถค้างสต็อกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง
          </td>
        </tr>
      `;
    }
    if (soldTbody) {
      soldTbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-3 text-danger">
            โหลดประวัติขายรถไม่สำเร็จ กรุณาลองใหม่อีกครั้ง
          </td>
        </tr>
      `;
    }
  }
}

// -----------------------------
// Render – รถค้างสต็อก (ตารางซ้าย)
// ใช้ tbody id="vehiclesStockBody"
// -----------------------------
function renderInStockTable() {
  const tbody = $("vehiclesStockBody");
  if (!tbody) return;

  if (!inStockCache.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-3 text-muted">
          ยังไม่มีรถค้างสต็อกในระบบ
        </td>
      </tr>
    `;
    return;
  }

  const rowsHtml = inStockCache.map((v) => {
    const name = `${v.brand || v.make || ""} ${v.model || ""}`
      .trim() || "ไม่ระบุรุ่น";
    const plate = v.plate || v.license || "-";
    const year = v.year || "";
    const mileage = v.mileage || v.odometer || "";
    const buyPrice = safeNumber(v.buyPrice ?? v.costPrice ?? 0);

    const createdAtText = v.createdAt ? formatDateTime(v.createdAt) : "";

    return `
      <tr data-vehicle-id="${v.id}">
        <td>
          <div class="fw-semibold">${name}</div>
          <div class="small text-muted">
            ทะเบียน ${plate}
            ${year ? ` • ปี ${year}` : ""}
          </div>
        </td>
        <td class="text-nowrap small">
          ${mileage ? `${mileage} กม.` : "-"}
        </td>
        <td class="text-end">
          ${buyPrice ? `${formatCurrency(buyPrice)}฿` : "-"}
        </td>
        <td class="small text-nowrap">
          ${createdAtText || "-"}
        </td>
        <td>
          <span class="badge rounded-pill text-bg-secondary">ค้างสต็อก</span>
        </td>
        <td class="text-end">
          <button type="button"
            class="btn btn-sm btn-outline-success vehicles-sell-btn">
            บันทึกการขาย
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = rowsHtml.join("");

  // click: บันทึกการขาย
  tbody.addEventListener(
    "click",
    (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest(".vehicles-sell-btn");
      if (!btn) return;

      const row = btn.closest("tr[data-vehicle-id]");
      if (!row) return;
      const id = row.getAttribute("data-vehicle-id");
      if (!id) return;

      const vehicle = inStockCache.find((v) => v.id === id);
      if (!vehicle) return;

      openSellModal(vehicle);
    },
    { once: true }
  );
}

// -----------------------------
// Render – รถที่ขายแล้ว (ตารางขวา)
// ใช้ tbody id="vehiclesSoldBody"
// -----------------------------
function renderSoldTable() {
  const tbody = $("vehiclesSoldBody");
  if (!tbody) return;

  if (!soldCache.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-3 text-muted">
          ยังไม่มีประวัติขายรถในระบบ
        </td>
      </tr>
    `;
    return;
  }

  const rowsHtml = soldCache.map((v) => {
    const name = `${v.brand || v.make || ""} ${v.model || ""}`
      .trim() || "ไม่ระบุรุ่น";
    const plate = v.plate || v.license || "-";
    const year = v.year || "";
    const mileage = v.mileage || v.odometer || "";
    const buyPrice = safeNumber(v.buyPrice ?? v.costPrice ?? 0);
    const sellPrice = safeNumber(v.sellPrice ?? v.salePrice ?? 0);
    const extraCost = safeNumber(v.extraCost ?? v.repairCost ?? 0);
    const profit =
      v.profit != null
        ? safeNumber(v.profit)
        : sellPrice - buyPrice - extraCost;

    const soldAtText = v.soldAt ? formatDateTime(v.soldAt) : "";

    return `
      <tr>
        <td>
          <div class="fw-semibold">${name}</div>
          <div class="small text-muted">
            ทะเบียน ${plate}
            ${year ? ` • ปี ${year}` : ""}
          </div>
        </td>
        <td class="small text-nowrap">
          ${mileage ? `${mileage} กม.` : "-"}
        </td>
        <td class="text-end small">
          ${buyPrice ? formatCurrency(buyPrice) + "฿" : "-"}
        </td>
        <td class="text-end small">
          ${sellPrice ? formatCurrency(sellPrice) + "฿" : "-"}
        </td>
        <td class="text-end small">
          ${extraCost ? formatCurrency(extraCost) + "฿" : "-"}
        </td>
        <td class="text-end">
          <div class="${profit >= 0 ? "text-success" : "text-danger"} fw-semibold">
            ${formatCurrency(profit)}฿
          </div>
          <div class="small text-muted">
            ${soldAtText || "-"}
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = rowsHtml.join("");
}

// -----------------------------
// ฟอร์มรับซื้อรถ – ใช้ id จาก app.html ตอนนี้
// form id="vehicleBuyForm"
// input: vehicleModel, vehiclePlate, vehicleYear, vehicleOdo,
//        vehicleBuyPrice, vehicleCondition
// -----------------------------
async function handleBuyFormSubmit(e) {
  e.preventDefault();

  const modelInput = $("vehicleModel");
  const plateInput = $("vehiclePlate");
  const yearInput = $("vehicleYear");
  const mileageInput = $("vehicleOdo");
  const priceInput = $("vehicleBuyPrice");
  const conditionInput = $("vehicleCondition");

  if (!modelInput || !plateInput || !priceInput) {
    showToast("ฟอร์มรับซื้อรถยังไม่ครบในหน้าเว็บ", "error");
    return;
  }

  const modelText = modelInput.value.trim();
  const plate = plateInput.value.trim();
  const year = yearInput ? yearInput.value.trim() : "";
  const mileage = mileageInput ? mileageInput.value.trim() : "";
  const buyPrice = safeNumber(priceInput.value || 0);
  const conditionNote = conditionInput ? conditionInput.value.trim() : "";

  if (!modelText && !plate) {
    showToast("กรุณากรอกอย่างน้อย ยี่ห้อ/รุ่น หรือ ทะเบียนรถ", "error");
    return;
  }

  if (!buyPrice) {
    showToast("กรุณากรอกราคาซื้อ", "error");
    return;
  }

  // แยก brand/model แบบง่าย ๆ: เอาคำหน้าเป็น brand ที่เหลือเป็น model
  let brand = "";
  let model = modelText;
  const parts = modelText.split(" ");
  if (parts.length > 1) {
    brand = parts[0];
    model = parts.slice(1).join(" ");
  }

  const form = e.target;
  const submitBtn = form.querySelector("button[type='submit']");
  if (submitBtn) submitBtn.disabled = true;

  try {
    const now = new Date();
    const payload = {
      brand,
      model,
      plate,
      year,
      mileage,
      buyPrice,
      note: conditionNote,
      status: "in-stock",
      createdAt: serverTimestamp(),
      createdLocalAt: now
    };

    await addDoc(vehiclesCol, payload);

    showToast("บันทึกการรับซื้อรถเรียบร้อย", "success");

    form.reset();
    await loadVehiclesLists();
  } catch (error) {
    console.error("บันทึกการรับซื้อรถไม่สำเร็จ:", error);
    showToast("บันทึกรถไม่สำเร็จ กรุณาลองใหม่", "error");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

// -----------------------------
// Modal ขายรถ – ใช้ id จาก app.html ปัจจุบัน
// modal id="vehicleSellModal"
// label id="vehicleSellLabel"
// buy price id="vehicleSellBuyPrice"
// sale price id="vehicleSellSalePrice"
// repair cost id="vehicleSellRepairCost"
// ปุ่มบันทึก id="vehicleSellSaveBtn"
// -----------------------------
function openSellModal(vehicle) {
  selectedVehicle = vehicle || null;

  const modalEl = $("vehicleSellModal");
  if (!modalEl || !window.bootstrap) return;

  const labelEl = $("vehicleSellLabel");
  const buyPriceEl = $("vehicleSellBuyPrice");
  const salePriceEl = $("vehicleSellSalePrice");
  const repairCostEl = $("vehicleSellRepairCost");

  const name = `${vehicle.brand || vehicle.make || ""} ${
    vehicle.model || ""
  }`.trim() || "ไม่ระบุรุ่น";
  const plate = vehicle.plate || vehicle.license || "-";

  if (labelEl) {
    labelEl.textContent = `${name} • ทะเบียน ${plate}`;
  }
  if (buyPriceEl) {
    buyPriceEl.value = vehicle.buyPrice ?? vehicle.costPrice ?? "";
  }
  if (salePriceEl) {
    salePriceEl.value = vehicle.sellPrice ?? vehicle.salePrice ?? "";
  }
  if (repairCostEl) {
    repairCostEl.value = vehicle.extraCost ?? vehicle.repairCost ?? "";
  }

  const modal = new window.bootstrap.Modal(modalEl);
  modal.show();
}

async function handleSellSave() {
  if (!selectedVehicle) {
    showToast("ไม่พบข้อมูลรถที่ต้องการบันทึกการขาย", "error");
    return;
  }

  const modalEl = $("vehicleSellModal");
  if (!modalEl || !window.bootstrap) return;

  const buyPriceEl = $("vehicleSellBuyPrice");
  const salePriceEl = $("vehicleSellSalePrice");
  const repairCostEl = $("vehicleSellRepairCost");

  const buyPrice = safeNumber(buyPriceEl?.value || selectedVehicle.buyPrice || 0);
  const sellPrice = safeNumber(salePriceEl?.value || 0);
  const extraCost = safeNumber(repairCostEl?.value || 0);

  if (!sellPrice) {
    showToast("กรุณากรอกราคาขาย", "error");
    return;
  }

  const profit = sellPrice - buyPrice - extraCost;

  const saveBtn = $("vehicleSellSaveBtn");
  if (saveBtn) saveBtn.disabled = true;

  try {
    const ref = doc(db, "vehicles", selectedVehicle.id);
    await updateDoc(ref, {
      buyPrice,
      sellPrice,
      extraCost,
      profit,
      status: "sold",
      soldAt: serverTimestamp()
    });

    showToast("บันทึกการขายรถเรียบร้อย", "success");

    const modal = window.bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    selectedVehicle = null;
    await loadVehiclesLists();
  } catch (error) {
    console.error("บันทึกการขายรถไม่สำเร็จ:", error);
    showToast("บันทึกการขายรถไม่สำเร็จ กรุณาลองใหม่", "error");
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

// -----------------------------
// init
// -----------------------------
function initVehicles() {
  const section = document.querySelector('[data-section="vehicles"]');
  if (!section) return;

  const buyForm = $("vehicleBuyForm");
  if (buyForm) {
    buyForm.addEventListener("submit", handleBuyFormSubmit);
  }

  const sellSaveBtn = $("vehicleSellSaveBtn");
  if (sellSaveBtn) {
    sellSaveBtn.addEventListener("click", handleSellSave);
  }

  loadVehiclesLists().catch((err) =>
    console.error("เกิดข้อผิดพลาดตอนโหลดรายการรถ:", err)
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initVehicles);
} else {
  initVehicles();
}

export { initVehicles };
