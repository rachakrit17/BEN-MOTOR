// js/pos.js
// ฟอร์มเปิดบิล / ใบรับรถ สำหรับ BEN MOTOR POS
// - ใช้ข้อมูล mock (demoRepairRecipes, demoStock) สำหรับ preset สูตรซ่อม
// - คำนวณค่าแรง / อะไหล่ / ส่วนลด / ยอดสุทธิ แบบ realtime
// - สร้างข้อความส่งลูกค้าให้อัตโนมัติ

import { demoRepairRecipes, demoStock } from "./data-mock.js";

const $ = (selector) => document.querySelector(selector);

// DOM refs (จะถูกกำหนดใน initPOS)
let billIdEl;
let datetimeEl;
let paymentMethodSelect;
let billStatusSelect;

let customerNameInput;
let customerPhoneInput;
let customerLineInput;
let customerTypeSelect;
let customerNoteInput;

let vehiclePlateInput;
let vehicleProvinceInput;
let vehicleModelInput;
let vehicleColorInput;
let vehicleYearInput;
let vehicleOdoInput;

let itemsBody;
let summaryLaborEl;
let summaryPartsEl;
let summaryDiscountEl;
let summaryGrandEl;
let discountInput;
let customerMessageEl;
let recipeNoteEl;

let addLaborBtn;
let addPartBtn;
let resetBtn;
let presetOilBtn;
let presetBrakeBtn;
let presetFullBtn;

// ---------- Helper: format ----------

function formatCurrencyTHB(value) {
  const num = Number(value) || 0;
  return num.toLocaleString("th-TH") + " บาท";
}

function formatNumber(value) {
  const num = Number(value) || 0;
  return num.toLocaleString("th-TH");
}

function formatDateTimeNow() {
  const now = new Date();
  return now.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function generateBillId() {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `BM${yy}${mm}${dd}-${hh}${min}`;
}

function findStockByCode(code) {
  if (!code) return null;
  return demoStock.find((item) => item.code === code) || null;
}

// ---------- สร้างโครง UI ฟอร์ม POS ด้วย JS ----------

function buildPosLayout(cardBody) {
  cardBody.innerHTML = `
    <div class="bm-form-section-title">ข้อมูลลูกค้า & รถ</div>
    <div class="bm-form-section-subtitle">
      กรอกข้อมูลลูกค้าและรถที่จะซ่อมเพื่อใช้บนบิลและประวัติในอนาคต
    </div>

    <div class="row g-2 g-md-3 bm-form-grid-gap mb-2">
      <div class="col-12 col-lg-7">
        <div class="bm-subpanel mb-2">
          <div class="bm-form-section-title" style="font-size:0.86rem;">ข้อมูลลูกค้า</div>
          <div class="row g-2 bm-form-grid-gap">
            <div class="col-12 col-md-6">
              <label class="form-label mb-1" for="bm-pos-customer-name">ชื่อลูกค้า</label>
              <input type="text" id="bm-pos-customer-name" class="form-control form-control-sm" placeholder="เช่น คุณต้น">
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label mb-1" for="bm-pos-customer-phone">เบอร์โทร</label>
              <input type="tel" id="bm-pos-customer-phone" class="form-control form-control-sm" placeholder="เช่น 081-234-5678">
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label mb-1" for="bm-pos-customer-line">LINE ID (ถ้ามี)</label>
              <input type="text" id="bm-pos-customer-line" class="form-control form-control-sm" placeholder="ไอดีไลน์ลูกค้า">
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label mb-1" for="bm-pos-customer-type">ประเภทลูกค้า</label>
              <select id="bm-pos-customer-type" class="form-select form-select-sm">
                <option value="new">ลูกค้าใหม่</option>
                <option value="regular">ลูกค้าประจำ</option>
                <option value="vip">VIP / ดูแลเป็นพิเศษ</option>
                <option value="dealer">เต็นท์ / คนกลาง</option>
              </select>
            </div>
            <div class="col-12">
              <label class="form-label mb-1" for="bm-pos-customer-note">โน้ตสั้น ๆ เกี่ยวกับลูกค้า (ถ้าต้องการ)</label>
              <textarea id="bm-pos-customer-note" rows="2" class="form-control form-control-sm" placeholder="เช่น รีบใช้รถก่อนเย็น, เน้นเซ็ตให้ขี่นิ่ม เป็นต้น"></textarea>
            </div>
          </div>
        </div>

        <div class="bm-subpanel">
          <div class="bm-form-section-title" style="font-size:0.86rem;">ข้อมูลรถ</div>
          <div class="row g-2 bm-form-grid-gap">
            <div class="col-6 col-md-4">
              <label class="form-label mb-1" for="bm-pos-vehicle-plate">ทะเบียน</label>
              <input type="text" id="bm-pos-vehicle-plate" class="form-control form-control-sm" placeholder="เช่น 1กข 1234">
            </div>
            <div class="col-6 col-md-4">
              <label class="form-label mb-1" for="bm-pos-vehicle-province">จังหวัด</label>
              <input type="text" id="bm-pos-vehicle-province" class="form-control form-control-sm" placeholder="เช่น กรุงเทพฯ">
            </div>
            <div class="col-12 col-md-4">
              <label class="form-label mb-1" for="bm-pos-vehicle-year">ปีรถ (โดยประมาณ)</label>
              <input type="number" id="bm-pos-vehicle-year" class="form-control form-control-sm" placeholder="เช่น 2018">
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label mb-1" for="bm-pos-vehicle-model">รุ่นรถ</label>
              <input type="text" id="bm-pos-vehicle-model" class="form-control form-control-sm" placeholder="เช่น Honda Wave 110i">
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label mb-1" for="bm-pos-vehicle-color">สีรถ</label>
              <input type="text" id="bm-pos-vehicle-color" class="form-control form-control-sm" placeholder="เช่น แดง-ดำ">
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label mb-1" for="bm-pos-vehicle-odo">เลขไมล์ (ถ้ามี)</label>
              <input type="number" id="bm-pos-vehicle-odo" class="form-control form-control-sm" placeholder="เช่น 35600">
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-5">
        <div class="bm-card mb-2">
          <div class="bm-card-body">
            <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
              <div>
                <div class="bm-card-title">บิลรับรถ / ใบงานซ่อม</div>
                <div class="bm-card-subtitle">
                  รหัสบิล: <span id="bm-pos-bill-id">-</span>
                </div>
              </div>
              <div style="text-align:right;font-size:0.74rem;color:#6b7280;">
                <div>วันที่-เวลา</div>
                <div id="bm-pos-datetime" style="font-size:0.76rem;color:#111827;">-</div>
              </div>
            </div>
            <div class="row g-2">
              <div class="col-6">
                <label class="form-label mb-1" for="bm-pos-payment-method">ช่องทางชำระ</label>
                <select id="bm-pos-payment-method" class="form-select form-select-sm">
                  <option value="cash">เงินสด</option>
                  <option value="transfer">โอน</option>
                  <option value="promptpay">PromptPay</option>
                  <option value="card">บัตร</option>
                </select>
              </div>
              <div class="col-6">
                <label class="form-label mb-1" for="bm-pos-bill-status">สถานะบิล</label>
                <select id="bm-pos-bill-status" class="form-select form-select-sm">
                  <option value="draft">ร่าง</option>
                  <option value="open">เปิดบิลแล้ว</option>
                  <option value="paid">ชำระแล้ว</option>
                </select>
              </div>
            </div>
            <button type="button" id="bm-pos-reset" class="bm-btn-outline-soft w-100 mt-2">
              <i class="bi bi-arrow-counterclockwise"></i>
              เคลียร์บิลนี้เริ่มใหม่
            </button>
          </div>
        </div>

        <div class="bm-subpanel">
          <div class="bm-form-section-title" style="font-size:0.84rem;">ข้อความส่งลูกค้า (สำหรับแชต/ไลน์)</div>
          <div class="bm-form-section-subtitle" style="margin-bottom:4px;">
            ระบบจะช่วยร่างข้อความอธิบายยอดและงานที่ทำให้แบบคร่าว ๆ ปรับแก้ได้เองก่อนส่งจริง
          </div>
          <textarea id="bm-pos-customer-message" rows="5" class="form-control" style="font-size:0.8rem;"></textarea>
        </div>
      </div>
    </div>

    <div class="bm-form-section-title mt-1">รายการงานซ่อมในบิลนี้</div>
    <div class="bm-form-section-subtitle">
      แยกระหว่างค่าแรงกับอะไหล่ เพื่อดูต้นทุนและกำไรในอนาคต
    </div>

    <div class="bm-subpanel mb-2">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div class="bm-quick-actions">
          <button type="button" id="bm-pos-preset-oil" class="bm-quick-action-btn">
            <i class="bi bi-droplet-half"></i>
            เปลี่ยนน้ำมันเครื่อง (สูตรด่วน)
          </button>
          <button type="button" id="bm-pos-preset-brake" class="bm-quick-action-btn">
            <i class="bi bi-disc"></i>
            แก้อาการเบรก / จานคด
          </button>
          <button type="button" id="bm-pos-preset-full" class="bm-quick-action-btn">
            <i class="bi bi-tornado"></i>
            เช็กทั้งคันก่อนขาย/รับซื้อ
          </button>
        </div>
        <div class="d-flex flex-wrap gap-1">
          <button type="button" id="bm-pos-add-labor-row" class="bm-btn-outline-soft">
            <i class="bi bi-plus-lg"></i>
            เพิ่มรายการค่าแรง
          </button>
          <button type="button" id="bm-pos-add-part-row" class="bm-btn-outline-soft">
            <i class="bi bi-plus-lg"></i>
            เพิ่มรายการอะไหล่
          </button>
        </div>
      </div>
      <div id="bm-pos-recipe-note" class="mt-2" style="font-size:0.74rem;color:#6b7280;">
        เลือกสูตรด่วนด้านบนเพื่อให้ระบบเติมรายการให้แบบอัตโนมัติ หรือเพิ่มรายการเองทีละบรรทัด
      </div>

      <div class="table-responsive mt-2">
        <table class="bm-table bm-table-sm">
          <thead>
            <tr>
              <th style="width:90px;">ประเภท</th>
              <th>รายละเอียดงาน</th>
              <th style="width:60px;">จำนวน</th>
              <th style="width:90px;">ราคาต่อหน่วย</th>
              <th style="width:90px;">รวม</th>
              <th style="width:36px;"></th>
            </tr>
          </thead>
          <tbody id="bm-pos-items-body"></tbody>
        </table>
      </div>
      <div class="mt-1" style="font-size:0.72rem;color:#9ca3af;">
        * ตัวเลขทั้งหมดคำนวณในเครื่อง ยังไม่ถูกบันทึกลงฐานข้อมูล (รอเชื่อม Firestore ภายหลัง)
      </div>
    </div>

    <div class="row g-2 justify-content-end">
      <div class="col-12 col-md-6 col-lg-4">
        <div class="bm-subpanel">
          <div class="d-flex justify-content-between mb-1" style="font-size:0.8rem;">
            <span>ค่าแรงรวม</span>
            <strong id="bm-pos-summary-labor">0 บาท</strong>
          </div>
          <div class="d-flex justify-content-between mb-1" style="font-size:0.8rem;">
            <span>อะไหล่รวม</span>
            <strong id="bm-pos-summary-parts">0 บาท</strong>
          </div>
          <div class="d-flex justify-content-between align-items-center mb-1" style="font-size:0.8rem;">
            <span>ส่วนลดทั้งบิล</span>
            <div class="d-flex align-items-center gap-1">
              <input type="number" id="bm-pos-discount" class="form-control form-control-sm" style="width:90px;text-align:right;" value="0" min="0" step="10">
              <span style="font-size:0.78rem;color:#6b7280;">บาท</span>
            </div>
          </div>
          <div class="d-flex justify-content-between" style="font-size:0.86rem;">
            <span>ยอดสุทธิ</span>
            <strong id="bm-pos-summary-grand">0 บาท</strong>
          </div>
          <div class="mt-1" style="font-size:0.72rem;color:#9ca3af;" id="bm-pos-summary-discount-note">
            ส่วนลด 0 บาท
          </div>
        </div>
      </div>
    </div>
  `;
}

// ---------- แถวรายการในบิล ----------

function addItemRow(type = "labor", description = "", qty = 1, unitPrice = 0) {
  if (!itemsBody) return;

  const tr = document.createElement("tr");
  const safeQty = Number.isFinite(Number(qty)) ? Number(qty) : 1;
  const safePrice = Number.isFinite(Number(unitPrice)) ? Number(unitPrice) : 0;

  tr.dataset.type = type;

  tr.innerHTML = `
    <td>
      <select class="form-select form-select-sm pos-item-type">
        <option value="labor" ${type === "labor" ? "selected" : ""}>ค่าแรง</option>
        <option value="part" ${type === "part" ? "selected" : ""}>อะไหล่</option>
      </select>
    </td>
    <td>
      <input
        type="text"
        class="form-control form-control-sm pos-item-desc"
        placeholder="เช่น เปลี่ยนน้ำมันเครื่อง / ผ้าเบรกหน้า"
        value="${description.replace(/"/g, "&quot;")}"
      >
    </td>
    <td>
      <input
        type="number"
        class="form-control form-control-sm pos-item-qty"
        min="0"
        step="0.5"
        value="${safeQty}"
      >
    </td>
    <td>
      <input
        type="number"
        class="form-control form-control-sm pos-item-price"
        min="0"
        step="10"
        value="${safePrice}"
      >
    </td>
    <td style="text-align:right;">
      <span class="pos-item-total">0</span>
    </td>
    <td style="text-align:center;">
      <button type="button" class="bm-btn-icon-only pos-item-remove" aria-label="ลบรายการนี้">
        <i class="bi bi-x"></i>
      </button>
    </td>
  `;

  itemsBody.appendChild(tr);
  recalcTotals();
}

function clearItems() {
  if (!itemsBody) return;
  itemsBody.innerHTML = "";
}

// ---------- คำนวณยอดรวมจากตาราง ----------

function recalcTotals() {
  let laborTotal = 0;
  let partsTotal = 0;

  if (!itemsBody) return;

  const rows = Array.from(itemsBody.querySelectorAll("tr"));

  rows.forEach((row) => {
    const typeSelect = row.querySelector(".pos-item-type");
    const qtyInput = row.querySelector(".pos-item-qty");
    const priceInput = row.querySelector(".pos-item-price");
    const totalSpan = row.querySelector(".pos-item-total");

    const type = typeSelect ? typeSelect.value : row.dataset.type || "labor";
    const qty = parseFloat(qtyInput?.value || "0") || 0;
    const price = parseFloat(priceInput?.value || "0") || 0;
    const rowTotal = qty * price;

    if (totalSpan) {
      totalSpan.textContent = formatNumber(rowTotal);
    }

    if (type === "labor") {
      laborTotal += rowTotal;
    } else {
      partsTotal += rowTotal;
    }
  });

  const discountVal = parseFloat(discountInput?.value || "0") || 0;
  const subtotal = laborTotal + partsTotal;
  const grand = Math.max(subtotal - discountVal, 0);

  if (summaryLaborEl) summaryLaborEl.textContent = formatCurrencyTHB(laborTotal);
  if (summaryPartsEl) summaryPartsEl.textContent = formatCurrencyTHB(partsTotal);
  if (summaryGrandEl) summaryGrandEl.textContent = formatCurrencyTHB(grand);

  if (summaryDiscountEl) {
    const note = discountVal > 0
      ? `ให้ส่วนลดทั้งบิล ${formatCurrencyTHB(discountVal)} (จากยอดรวม ${formatCurrencyTHB(subtotal)})`
      : "ส่วนลด 0 บาท";
    summaryDiscountEl.textContent = note;
  }

  updateCustomerMessage();
}

// ---------- ข้อความส่งลูกค้า ----------

function updateCustomerMessage() {
  if (!customerMessageEl) return;

  const billId = billIdEl?.textContent || "";
  const name = (customerNameInput?.value || "").trim() || "ลูกค้า";
  const plate = (vehiclePlateInput?.value || "").trim();
  const model = (vehicleModelInput?.value || "").trim();

  const laborText = summaryLaborEl?.textContent || "0 บาท";
  const partsText = summaryPartsEl?.textContent || "0 บาท";
  const grandText = summaryGrandEl?.textContent || "0 บาท";

  let vehicleText = "";
  if (model || plate) {
    vehicleText = `รถ ${model || ""}${plate ? " ทะเบียน " + plate : ""}`.trim();
  }

  const lines = [];
  if (billId) {
    lines.push(`บิลงานซ่อม ${billId}`);
  }
  lines.push(`เรียนคุณ${name}${vehicleText ? " - " + vehicleText : ""}`);
  lines.push(`ค่าแรง ${laborText} + ค่าอะไหล่ ${partsText}`);
  lines.push(`ยอดสุทธิที่ต้องชำระ ${grandText}`);
  lines.push(`ถ้ามีข้อสงสัยเกี่ยวกับงานซ่อมหรือค่าใช้จ่าย แจ้ง BEN MOTOR ได้เลยครับ`);

  customerMessageEl.value = lines.join("\n");
}

// ---------- Preset สูตรซ่อม ----------

function applyRecipePreset(presetKey) {
  let recipeId = null;
  if (presetKey === "oil") {
    recipeId = "R-0001";
  } else if (presetKey === "brake") {
    recipeId = "R-0002";
  } else if (presetKey === "full") {
    recipeId = "R-0003";
  }

  if (!recipeId) return;

  const recipe = demoRepairRecipes.find((r) => r.id === recipeId);
  if (!recipe) return;

  clearItems();

  // ค่าแรง
  (recipe.laborItems || []).forEach((item) => {
    addItemRow("labor", item.name || "", 1, item.price || 0);
  });

  // อะไหล่
  (recipe.partItems || []).forEach((item) => {
    const stock = findStockByCode(item.code);
    const price = stock ? stock.salePrice : 0;
    const qty = item.qty && item.qty > 0 ? item.qty : 1;
    addItemRow("part", item.name || (stock?.name || ""), qty, price);
  });

  if (recipeNoteEl) {
    recipeNoteEl.textContent =
      recipe.noteForMechanic ||
      "สูตรนี้ไม่มีคำแนะนำพิเศษ สามารถปรับเพิ่ม/ลดรายการได้ตามความเหมาะสม";
  }

  recalcTotals();
}

// ---------- Event handlers ----------

function handleItemsInput(event) {
  const target = event.target;
  if (
    target.classList.contains("pos-item-qty") ||
    target.classList.contains("pos-item-price") ||
    target.classList.contains("pos-item-type") ||
    target.classList.contains("pos-item-desc")
  ) {
    recalcTotals();
  }
}

function handleItemsClick(event) {
  const removeBtn = event.target.closest(".pos-item-remove");
  if (removeBtn) {
    const row = removeBtn.closest("tr");
    if (row && itemsBody) {
      itemsBody.removeChild(row);
      recalcTotals();
    }
  }
}

// ---------- Reset / Init bill ----------

function resetPOS() {
  if (billIdEl) billIdEl.textContent = generateBillId();
  if (datetimeEl) datetimeEl.textContent = formatDateTimeNow();

  if (paymentMethodSelect) paymentMethodSelect.value = "cash";
  if (billStatusSelect) billStatusSelect.value = "draft";

  if (customerNameInput) customerNameInput.value = "";
  if (customerPhoneInput) customerPhoneInput.value = "";
  if (customerLineInput) customerLineInput.value = "";
  if (customerTypeSelect) customerTypeSelect.value = "new";
  if (customerNoteInput) customerNoteInput.value = "";

  if (vehiclePlateInput) vehiclePlateInput.value = "";
  if (vehicleProvinceInput) vehicleProvinceInput.value = "";
  if (vehicleModelInput) vehicleModelInput.value = "";
  if (vehicleColorInput) vehicleColorInput.value = "";
  if (vehicleYearInput) vehicleYearInput.value = "";
  if (vehicleOdoInput) vehicleOdoInput.value = "";

  if (discountInput) discountInput.value = "0";

  clearItems();
  // เริ่มต้นด้วยแถวค่าแรงเปล่า 1 แถว
  addItemRow("labor", "", 1, 0);
  recalcTotals();
}

// ---------- Init DOM refs & events ----------

function cacheDomRefs() {
  billIdEl = $("#bm-pos-bill-id");
  datetimeEl = $("#bm-pos-datetime");
  paymentMethodSelect = $("#bm-pos-payment-method");
  billStatusSelect = $("#bm-pos-bill-status");

  customerNameInput = $("#bm-pos-customer-name");
  customerPhoneInput = $("#bm-pos-customer-phone");
  customerLineInput = $("#bm-pos-customer-line");
  customerTypeSelect = $("#bm-pos-customer-type");
  customerNoteInput = $("#bm-pos-customer-note");

  vehiclePlateInput = $("#bm-pos-vehicle-plate");
  vehicleProvinceInput = $("#bm-pos-vehicle-province");
  vehicleModelInput = $("#bm-pos-vehicle-model");
  vehicleColorInput = $("#bm-pos-vehicle-color");
  vehicleYearInput = $("#bm-pos-vehicle-year");
  vehicleOdoInput = $("#bm-pos-vehicle-odo");

  itemsBody = $("#bm-pos-items-body");
  summaryLaborEl = $("#bm-pos-summary-labor");
  summaryPartsEl = $("#bm-pos-summary-parts");
  summaryGrandEl = $("#bm-pos-summary-grand");
  summaryDiscountEl = $("#bm-pos-summary-discount-note");
  discountInput = $("#bm-pos-discount");
  customerMessageEl = $("#bm-pos-customer-message");
  recipeNoteEl = $("#bm-pos-recipe-note");

  addLaborBtn = $("#bm-pos-add-labor-row");
  addPartBtn = $("#bm-pos-add-part-row");
  resetBtn = $("#bm-pos-reset");
  presetOilBtn = $("#bm-pos-preset-oil");
  presetBrakeBtn = $("#bm-pos-preset-brake");
  presetFullBtn = $("#bm-pos-preset-full");
}

function attachEvents() {
  if (addLaborBtn) {
    addLaborBtn.addEventListener("click", () => addItemRow("labor"));
  }
  if (addPartBtn) {
    addPartBtn.addEventListener("click", () => addItemRow("part"));
  }
  if (resetBtn) {
    resetBtn.addEventListener("click", () => resetPOS());
  }

  if (presetOilBtn) {
    presetOilBtn.addEventListener("click", () => applyRecipePreset("oil"));
  }
  if (presetBrakeBtn) {
    presetBrakeBtn.addEventListener("click", () => applyRecipePreset("brake"));
  }
  if (presetFullBtn) {
    presetFullBtn.addEventListener("click", () => applyRecipePreset("full"));
  }

  if (itemsBody) {
    itemsBody.addEventListener("input", handleItemsInput);
    itemsBody.addEventListener("click", handleItemsClick);
  }

  // อัปเดตข้อความส่งลูกค้าทันทีเมื่อข้อมูลหลักเปลี่ยน
  const fieldsAffectingMessage = [
    customerNameInput,
    vehiclePlateInput,
    vehicleModelInput,
    summaryLaborEl,
    summaryPartsEl,
    summaryGrandEl
  ];

  fieldsAffectingMessage.forEach((el) => {
    if (!el) return;
    // ถ้าเป็น input ใช้ event "input" ถ้าเป็น span ใช้ MutationObserver ด้านล่าง
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      el.addEventListener("input", updateCustomerMessage);
    }
  });

  // ฟังการเปลี่ยนค่าจาก summary (span) ผ่าน MutationObserver
  const observeTargets = [summaryLaborEl, summaryPartsEl, summaryGrandEl];
  observeTargets.forEach((node) => {
    if (!node) return;
    const observer = new MutationObserver(updateCustomerMessage);
    observer.observe(node, { childList: true, characterData: true, subtree: true });
  });

  if (discountInput) {
    discountInput.addEventListener("input", () => recalcTotals());
  }
}

// ---------- Init ทั้งฟอร์ม POS ----------

function initPOS() {
  const section = document.querySelector("#section-pos");
  if (!section) return;

  const cardBody = section.querySelector(".bm-card-body");
  if (!cardBody) return;

  buildPosLayout(cardBody);
  cacheDomRefs();
  attachEvents();
  resetPOS();
}

document.addEventListener("DOMContentLoaded", initPOS);