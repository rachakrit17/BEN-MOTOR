// BEN MOTOR POS – Vehicles (ซื้อ–ขายรถ)

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

const vehiclesCol = collection(db, "vehicles");

let inStockCache = [];
let soldCache = [];
let selectedVehicleForSale = null;

// -----------------------------
// Helpers – DOM
// -----------------------------
function $(id) {
  return document.getElementById(id);
}

function safeNumber(v, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

// -----------------------------
// Load vehicles
// -----------------------------
async function loadVehiclesLists() {
  const inStockBody = $("vehiclesInStockBody");
  const soldBody = $("vehiclesSoldBody");

  if (inStockBody) {
    inStockBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-3 text-muted">
          กำลังโหลดรายการรถค้างสต็อกจากระบบ...
        </td>
      </tr>
    `;
  }

  if (soldBody) {
    soldBody.innerHTML = `
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
    updateSummary();
  } catch (error) {
    console.error("โหลดข้อมูลรถซื้อ–ขายไม่สำเร็จ:", error);
    if (inStockBody) {
      inStockBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-3 text-danger">
            โหลดข้อมูลรถค้างสต็อกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง
          </td>
        </tr>
      `;
    }
    if (soldBody) {
      soldBody.innerHTML = `
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
// Render – In stock
// -----------------------------
function renderInStockTable() {
  const tbody = $("vehiclesInStockBody");
  const countEl = $("vehiclesInStockCount");
  if (countEl) {
    countEl.textContent = inStockCache.length.toString();
  }

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
    const name = `${v.brand || v.make || ""} ${v.model || ""}`.trim() || "ไม่ระบุรุ่น";
    const plate = v.plate || v.license || "-";
    const year = v.year || "";
    const mileage = v.mileage || v.odometer || "";
    const buyPrice = safeNumber(v.buyPrice ?? v.costPrice ?? 0);

    const createdAtText = v.createdAt
      ? formatDateTime(v.createdAt)
      : "";

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
// Render – Sold
// -----------------------------
function renderSoldTable() {
  const tbody = $("vehiclesSoldBody");
  const countEl = $("vehiclesSoldCount");
  if (countEl) {
    countEl.textContent = soldCache.length.toString();
  }

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
    const name = `${v.brand || v.make || ""} ${v.model || ""}`.trim() || "ไม่ระบุรุ่น";
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
          ${
            extraCost
              ? formatCurrency(extraCost) + "฿"
              : "-"
          }
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
// Summary (จำนวนค้าง + กำไรรวม)
// -----------------------------
function updateSummary() {
  const inStockCountEl = $("vehiclesInStockCount");
  const soldCountEl = $("vehiclesSoldCount");
  const profitTextEl = $("vehiclesProfitSummaryText");

  if (inStockCountEl) {
    inStockCountEl.textContent = inStockCache.length.toString();
  }
  if (soldCountEl) {
    soldCountEl.textContent = soldCache.length.toString();
  }

  if (profitTextEl) {
    let totalProfit = 0;
    soldCache.forEach((v) => {
      const buyPrice = safeNumber(v.buyPrice ?? v.costPrice ?? 0);
      const sellPrice = safeNumber(v.sellPrice ?? v.salePrice ?? 0);
      const extraCost = safeNumber(v.extraCost ?? v.repairCost ?? 0);
      const profit =
        v.profit != null
          ? safeNumber(v.profit)
          : sellPrice - buyPrice - extraCost;
      totalProfit += profit;
    });

    profitTextEl.textContent =
      soldCache.length === 0
        ? "ยังไม่มีข้อมูลกำไรจากการขายรถ"
        : `กำไรรวมจากการขายรถ: ${formatCurrency(totalProfit)} บาท`;
  }
}

// -----------------------------
// Buy Form – รับซื้อรถเข้าระบบ
// -----------------------------
async function handleBuyFormSubmit(e) {
  e.preventDefault();

  const brandInput = $("vehiclesBuyBrandInput");
  const modelInput = $("vehiclesBuyModelInput");
  const plateInput = $("vehiclesBuyPlateInput");
  const yearInput = $("vehiclesBuyYearInput");
  const mileageInput = $("vehiclesBuyMileageInput");
  const priceInput = $("vehiclesBuyPriceInput");
  const noteInput = $("vehiclesBuyNoteInput");

  if (!brandInput || !modelInput || !plateInput || !priceInput) {
    showToast("ฟอร์มรับซื้อรถยังไม่ครบในหน้าเว็บ", "error");
    return;
  }

  const brand = brandInput.value.trim();
  const model = modelInput.value.trim();
  const plate = plateInput.value.trim();
  const year = yearInput ? yearInput.value.trim() : "";
  const mileage = mileageInput ? mileageInput.value.trim() : "";
  const buyPrice = safeNumber(priceInput.value || 0);
  const note = noteInput ? noteInput.value.trim() : "";

  if (!brand && !model && !plate) {
    showToast("กรุณากรอกอย่างน้อย ยี่ห้อ/รุ่น หรือ ทะเบียนรถ", "error");
    return;
  }

  if (!buyPrice) {
    showToast("กรุณากรอกราคาซื้อ", "error");
    return;
  }

  const buyBtn = $("vehiclesBuySubmitBtn");
  if (buyBtn) buyBtn.disabled = true;

  try {
    const now = new Date();
    const payload = {
      brand,
      model,
      plate,
      year,
      mileage,
      buyPrice,
      note,
      status: "in-stock",
      createdAt: serverTimestamp(),
      createdLocalAt: now
    };

    await addDoc(vehiclesCol, payload);
    showToast("บันทึกรถที่รับซื้อเข้าระบบเรียบร้อย", "success");

    if (brandInput) brandInput.value = "";
    if (modelInput) modelInput.value = "";
    if (plateInput) plateInput.value = "";
    if (yearInput) yearInput.value = "";
    if (mileageInput) mileageInput.value = "";
    if (priceInput) priceInput.value = "";
    if (noteInput) noteInput.value = "";

    loadVehiclesLists();
  } catch (error) {
    console.error("บันทึกข้อมูลรับซื้อรถไม่สำเร็จ:", error);
    showToast("บันทึกข้อมูลรับซื้อรถไม่สำเร็จ", "error");
  } finally {
    if (buyBtn) buyBtn.disabled = false;
  }
}

// -----------------------------
// Sell Modal – เปิดเพื่อบันทึกขายรถ
// -----------------------------
function openSellModal(vehicle) {
  selectedVehicleForSale = vehicle;

  const modalEl = $("vehiclesSellModal");
  if (!modalEl) {
    const name = `${vehicle.brand || vehicle.make || ""} ${
      vehicle.model || ""
    }`.trim();
    const plate = vehicle.plate || vehicle.license || "-";
    const msg = [
      `รถค้างสต็อก: ${name || "ไม่ระบุรุ่น"} (ทะเบียน ${plate})`,
      "",
      "ยังไม่ได้สร้างหน้าต่างบันทึกการขายในหน้านี้",
      "กรุณาเพิ่ม Modal id=\"vehiclesSellModal\" ตามที่ระบบคาดหวัง"
    ].join("\n");
    alert(msg);
    return;
  }

  const infoEl = $("vehiclesSellInfo");
  const sellPriceInput = $("vehiclesSellPriceInput");
  const extraCostInput = $("vehiclesSellExtraCostInput");
  const noteInput = $("vehiclesSellNoteInput");

  const name = `${vehicle.brand || vehicle.make || ""} ${
    vehicle.model || ""
  }`.trim();
  const plate = vehicle.plate || vehicle.license || "-";
  const buyPrice = safeNumber(vehicle.buyPrice ?? vehicle.costPrice ?? 0);

  if (infoEl) {
    infoEl.innerHTML = `
      <div class="fw-semibold">${name || "ไม่ระบุรุ่น"}</div>
      <div class="small text-muted">ทะเบียน ${plate}</div>
      ${
        buyPrice
          ? `<div class="small text-muted">ราคาซื้อเข้า ${formatCurrency(
              buyPrice
            )}฿</div>`
          : ""
      }
    `;
  }

  if (sellPriceInput) {
    sellPriceInput.value = "";
  }
  if (extraCostInput) {
    extraCostInput.value = "";
  }
  if (noteInput) {
    noteInput.value = "";
  }

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

// -----------------------------
// Sell – บันทึกการขายจริง
// -----------------------------
async function handleSellSave() {
  if (!selectedVehicleForSale) {
    showToast("ไม่พบข้อมูลรถที่จะบันทึกขาย", "error");
    return;
  }

  const sellPriceInput = $("vehiclesSellPriceInput");
  const extraCostInput = $("vehiclesSellExtraCostInput");
  const noteInput = $("vehiclesSellNoteInput");

  if (!sellPriceInput) {
    showToast("ฟอร์มบันทึกการขายยังไม่ครบในหน้าเว็บ", "error");
    return;
  }

  const sellPrice = safeNumber(sellPriceInput.value || 0);
  const extraCost = extraCostInput
    ? safeNumber(extraCostInput.value || 0)
    : 0;
  const sellNote = noteInput ? noteInput.value.trim() : "";

  if (!sellPrice) {
    showToast("กรุณากรอกราคาขาย", "error");
    return;
  }

  const saveBtn = $("vehiclesSellSaveBtn");
  if (saveBtn) saveBtn.disabled = true;

  try {
    const buyPrice = safeNumber(
      selectedVehicleForSale.buyPrice ??
        selectedVehicleForSale.costPrice ??
        0
    );
    const profit = sellPrice - buyPrice - extraCost;

    const ref = doc(db, "vehicles", selectedVehicleForSale.id);
    await updateDoc(ref, {
      sellPrice,
      extraCost,
      sellNote,
      profit,
      status: "sold",
      soldAt: serverTimestamp(),
      soldLocalAt: new Date()
    });

    showToast("บันทึกการขายรถเรียบร้อย", "success");

    const modalEl = $("vehiclesSellModal");
    if (modalEl) {
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.hide();
    }

    selectedVehicleForSale = null;
    loadVehiclesLists();
  } catch (error) {
    console.error("บันทึกการขายรถไม่สำเร็จ:", error);
    showToast("บันทึกการขายรถไม่สำเร็จ", "error");
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

// -----------------------------
// Init – Vehicles section
// -----------------------------
function initVehicles() {
  const section = document.querySelector('[data-section="vehicles"]');
  if (!section) return;

  const buyForm = $("vehiclesBuyForm");
  const reloadBtn = $("vehiclesReloadBtn");
  const sellSaveBtn = $("vehiclesSellSaveBtn");

  if (buyForm) {
    buyForm.addEventListener("submit", handleBuyFormSubmit);
  }

  if (reloadBtn) {
    reloadBtn.addEventListener("click", () => {
      loadVehiclesLists();
    });
  }

  if (sellSaveBtn) {
    sellSaveBtn.addEventListener("click", () => {
      handleSellSave();
    });
  }

  loadVehiclesLists();
}

// -----------------------------
// Bootstrap
// -----------------------------
document.addEventListener("DOMContentLoaded", () => {
  initVehicles();
});