// BEN MOTOR POS – POS / เปิดบิลใบรับรถ

import {
  db,
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  serverTimestamp
} from "./firebase-init.js";

import { formatCurrency, formatDateTime, showToast } from "./utils.js";

const jobsCol = collection(db, "jobs");
const stockCol = collection(db, "stock");

let posOpenedAt = new Date();
let selectedRowForStock = null;

// -----------------------------
// Helpers – DOM
// -----------------------------
function $(id) {
  return document.getElementById(id);
}

function getNumberFromInput(inputEl) {
  if (!inputEl) return 0;
  const raw = (inputEl.value || "").toString().replace(/,/g, "").trim();
  const num = Number(raw);
  if (!Number.isFinite(num)) return 0;
  return num;
}

function setText(id, txt) {
  const el = $(id);
  if (el) el.textContent = txt;
}

// -----------------------------
// Items table – เพิ่ม/ลบ/คำนวณ
// -----------------------------
function createItemRow(type) {
  const tbody = $("posItemsBody");
  if (!tbody) return;

  const rowId = "row-" + Date.now() + "-" + Math.floor(Math.random() * 99999);
  const isLabor = type === "labor";

  const tr = document.createElement("tr");
  tr.dataset.rowId = rowId;
  tr.innerHTML = `
    <td style="min-width: 80px;">
      <span class="bm-pos-item-type-badge ${
        isLabor ? "bm-pos-item-type-labor" : "bm-pos-item-type-part"
      }">
        ${isLabor ? "ค่าแรง" : "อะไหล่"}
      </span>
    </td>
    <td style="min-width: 170px;">
      <div class="input-group input-group-sm">
        <input type="text" class="form-control" placeholder="${
          isLabor ? "รายละเอียดงานซ่อม" : "ชื่ออะไหล่ / รายละเอียด"
        }">
        ${
          !isLabor
            ? `<button class="btn btn-outline-secondary pos-select-stock-btn" type="button">
                 <i class="bi bi-box-seam"></i>
               </button>`
            : ""
        }
      </div>
    </td>
    <td style="width: 80px;">
      <input type="number" class="form-control form-control-sm text-end" min="1" value="1">
    </td>
    <td style="width: 110px;">
      <input type="number" class="form-control form-control-sm text-end" min="0" step="1" value="0">
    </td>
    <td style="width: 110px;">
      <div class="text-end fw-semibold pos-line-total">0</div>
    </td>
    <td style="width: 50px;">
      <button type="button" class="btn btn-sm btn-link text-danger pos-remove-row-btn">
        <i class="bi bi-x-lg"></i>
      </button>
    </td>
  `;

  tbody.appendChild(tr);
  wireRowEvents(tr, type);
  recalcPosSummary();
}

function wireRowEvents(tr, type) {
  const qtyInput = tr.querySelector('td:nth-child(3) input');
  const priceInput = tr.querySelector('td:nth-child(4) input');
  const removeBtn = tr.querySelector(".pos-remove-row-btn");
  const selectStockBtn = tr.querySelector(".pos-select-stock-btn");

  const onChange = () => recalcPosSummary();

  if (qtyInput) qtyInput.addEventListener("input", onChange);
  if (priceInput) priceInput.addEventListener("input", onChange);

  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      tr.remove();
      recalcPosSummary();
    });
  }

  if (!selectStockBtn) return;

  selectStockBtn.addEventListener("click", async () => {
    selectedRowForStock = tr;
    await openStockPickerModal();
  });
}

function getItemsFromTable() {
  const tbody = $("posItemsBody");
  if (!tbody) return [];

  const rows = Array.from(tbody.querySelectorAll("tr"));
  const items = [];

  rows.forEach((tr) => {
    const typeBadge = tr.querySelector(".bm-pos-item-type-badge");
    const descInput = tr.querySelector('td:nth-child(2) input');
    const qtyInput = tr.querySelector('td:nth-child(3) input');
    const priceInput = tr.querySelector('td:nth-child(4) input');

    if (!typeBadge || !descInput) return;

    const typeLabel = typeBadge.textContent.trim();
    const type = typeLabel === "ค่าแรง" ? "labor" : "part";

    const description = descInput.value.trim();
    const qty = getNumberFromInput(qtyInput);
    const unitPrice = getNumberFromInput(priceInput);
    const lineTotal = qty * unitPrice;

    if (!description && lineTotal === 0) return;

    items.push({
      type,
      description,
      qty,
      unitPrice,
      lineTotal
    });
  });

  return items;
}

function recalcPosSummary() {
  const items = getItemsFromTable();
  let subtotal = 0;
  items.forEach((item) => {
    subtotal += item.lineTotal;
  });

  const discountInput = $("posDiscountInput");
  const paidInput = $("posCustomerPaidInput");

  const discount = getNumberFromInput(discountInput);
  let net = subtotal - discount;
  if (net < 0) net = 0;

  const paid = getNumberFromInput(paidInput);
  let change = paid - net;
  if (change < 0) change = 0;

  // อัปเดตตัวเลข
  setText("posSubtotalText", formatCurrency(subtotal));
  setText("posNetTotalText", formatCurrency(net));
  setText("posChangeText", formatCurrency(change));

  // ใส่ใน data attributes เผื่อใช้ตอนบันทึก
  const form = $("posForm");
  if (form) {
    form.dataset.subtotal = String(subtotal);
    form.dataset.discount = String(discount);
    form.dataset.net = String(net);
    form.dataset.paid = String(paid);
    form.dataset.change = String(change);
  }

  // อัปเดตยอดในแต่ละบรรทัด
  const tbody = $("posItemsBody");
  if (!tbody) return;

  const rows = Array.from(tbody.querySelectorAll("tr"));
  rows.forEach((tr) => {
    const qtyInput = tr.querySelector('td:nth-child(3) input');
    const priceInput = tr.querySelector('td:nth-child(4) input');
    const lineEl = tr.querySelector(".pos-line-total");

    if (!lineEl) return;

    const qty = getNumberFromInput(qtyInput);
    const price = getNumberFromInput(priceInput);
    const total = qty * price;

    lineEl.textContent = formatCurrency(total);
  });
}

// -----------------------------
// Stock Picker Modal
// -----------------------------
async function openStockPickerModal() {
  const modalEl = $("stockPickerModal");
  const bodyEl = $("stockPickerBody");

  if (!modalEl || !bodyEl) {
    showToast("ยังไม่ได้สร้างหน้าต่างเลือกสต็อกในหน้านี้", "info");
    return;
  }

  bodyEl.innerHTML = `
    <tr>
      <td colspan="5" class="text-center py-3 text-muted">
        กำลังโหลดรายการอะไหล่จากระบบ...
      </td>
    </tr>
  `;

  try {
    const qStock = query(stockCol, orderBy("name", "asc"));
    const snap = await getDocs(qStock);

    if (snap.empty) {
      bodyEl.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-3 text-muted">
            ยังไม่มีข้อมูลอะไหล่ในระบบ
          </td>
        </tr>
      `;
    } else {
      const rowsHtml = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const name = data.name || data.partName || "ไม่ระบุชื่ออะไหล่";
        const sku = data.sku || "";
        const category = data.category || "";
        const price = data.salePrice ?? data.price ?? 0;
        const qty = data.qty ?? data.quantity ?? data.stock ?? 0;

        rowsHtml.push(`
          <tr>
            <td>${name}</td>
            <td>${sku}</td>
            <td>${category}</td>
            <td class="text-end">${formatCurrency(price)}฿</td>
            <td class="text-end">
              <button type="button"
                class="btn btn-sm btn-outline-success stock-pick-btn"
                data-name="${name.replace(/"/g, "&quot;")}"
                data-price="${price}">
                เลือก
              </button>
            </td>
          </tr>
        `);
      });
      bodyEl.innerHTML = rowsHtml.join("");
    }
  } catch (error) {
    console.error("โหลดข้อมูลสต็อกไม่สำเร็จ:", error);
    bodyEl.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-3 text-danger">
          โหลดข้อมูลสต็อกไม่สำเร็จ
        </td>
      </tr>
    `;
  }

  // ติด event ให้ปุ่มเลือก
  bodyEl.addEventListener(
    "click",
    (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest(".stock-pick-btn");
      if (!btn || !selectedRowForStock) return;

      const name = btn.getAttribute("data-name") || "";
      const priceStr = btn.getAttribute("data-price") || "0";
      const price = Number(priceStr) || 0;

      const descInput = selectedRowForStock.querySelector(
        'td:nth-child(2) input'
      );
      const priceInput = selectedRowForStock.querySelector(
        'td:nth-child(4) input'
      );

      if (descInput) descInput.value = name;
      if (priceInput) priceInput.value = String(price);

      recalcPosSummary();

      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.hide();
    },
    { once: true }
  );

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

// -----------------------------
// Quick presets
// -----------------------------
function applyPreset(presetKey) {
  const tbody = $("posItemsBody");
  if (!tbody) return;

  // ล้างของเดิมก่อน
  tbody.innerHTML = "";

  if (presetKey === "front-tire") {
    createItemRow("labor");
    createItemRow("part");

    const rows = tbody.querySelectorAll("tr");
    if (rows[0]) {
      const descInput = rows[0].querySelector('td:nth-child(2) input');
      const qtyInput = rows[0].querySelector('td:nth-child(3) input');
      const priceInput = rows[0].querySelector('td:nth-child(4) input');
      if (descInput) descInput.value = "ค่าแรงเปลี่ยนยางหน้า";
      if (qtyInput) qtyInput.value = "1";
      if (priceInput) priceInput.value = "80";
    }
    if (rows[1]) {
      const descInput = rows[1].querySelector('td:nth-child(2) input');
      const qtyInput = rows[1].querySelector('td:nth-child(3) input');
      const priceInput = rows[1].querySelector('td:nth-child(4) input');
      if (descInput) descInput.value = "ยางหน้า มอเตอร์ไซค์";
      if (qtyInput) qtyInput.value = "1";
      if (priceInput) priceInput.value = "350";
    }
  } else if (presetKey === "oil-change") {
    createItemRow("labor");
    createItemRow("part");

    const rows = tbody.querySelectorAll("tr");
    if (rows[0]) {
      const descInput = rows[0].querySelector('td:nth-child(2) input');
      const qtyInput = rows[0].querySelector('td:nth-child(3) input');
      const priceInput = rows[0].querySelector('td:nth-child(4) input');
      if (descInput) descInput.value = "ค่าแรงถ่ายน้ำมันเครื่อง";
      if (qtyInput) qtyInput.value = "1";
      if (priceInput) priceInput.value = "60";
    }
    if (rows[1]) {
      const descInput = rows[1].querySelector('td:nth-child(2) input');
      const qtyInput = rows[1].querySelector('td:nth-child(3) input');
      const priceInput = rows[1].querySelector('td:nth-child(4) input');
      if (descInput) descInput.value = "น้ำมันเครื่อง";
      if (qtyInput) qtyInput.value = "1";
      if (priceInput) priceInput.value = "120";
    }
  } else if (presetKey === "brake-change") {
    createItemRow("labor");
    createItemRow("part");

    const rows = tbody.querySelectorAll("tr");
    if (rows[0]) {
      const descInput = rows[0].querySelector('td:nth-child(2) input');
      const qtyInput = rows[0].querySelector('td:nth-child(3) input');
      const priceInput = rows[0].querySelector('td:nth-child(4) input');
      if (descInput) descInput.value = "ค่าแรงเปลี่ยนผ้าเบรกหน้า";
      if (qtyInput) qtyInput.value = "1";
      if (priceInput) priceInput.value = "80";
    }
    if (rows[1]) {
      const descInput = rows[1].querySelector('td:nth-child(2) input');
      const qtyInput = rows[1].querySelector('td:nth-child(3) input');
      const priceInput = rows[1].querySelector('td:nth-child(4) input');
      if (descInput) descInput.value = "ผ้าเบรกหน้า";
      if (qtyInput) qtyInput.value = "1";
      if (priceInput) priceInput.value = "150";
    }
  }

  recalcPosSummary();
}

// -----------------------------
// Build job payload + customer message
// -----------------------------
function buildJobPayload() {
  const form = $("posForm");
  if (!form) return null;

  const customerName = $("posCustomerName")?.value.trim() || "";
  const customerPhone = $("posCustomerPhone")?.value.trim() || "";
  const customerChannel = $("posCustomerChannel")?.value.trim() || "";

  const vehicleModel = $("posVehicleModel")?.value.trim() || "";
  const vehiclePlate = $("posVehiclePlate")?.value.trim() || "";
  const vehicleMileage = $("posVehicleMileage")?.value.trim() || "";

  const jobType = $("posJobType")?.value || "";
  const jobUrgency = $("posJobUrgency")?.value || "";
  const jobTags = $("posJobTags")?.value.trim() || "";

  const customerNote = $("posCustomerNote")?.value.trim() || "";
  const internalNote = $("posInternalNote")?.value.trim() || "";

  const items = getItemsFromTable();
  if (!items.length) {
    showToast("กรุณาเพิ่มรายการในบิลอย่างน้อย 1 รายการ", "error");
    return null;
  }

  const subtotal = Number(form.dataset.subtotal || "0");
  const discount = Number(form.dataset.discount || "0");
  const net = Number(form.dataset.net || "0");
  const paid = Number(form.dataset.paid || "0");
  const change = Number(form.dataset.change || "0");

  if (!customerName && !vehiclePlate) {
    showToast("กรุณากรอกชื่อลูกค้าหรือทะเบียนรถอย่างน้อย 1 ช่อง", "error");
    return null;
  }

  const now = new Date();

  const docData = {
    customer: {
      name: customerName,
      phone: customerPhone,
      channel: customerChannel
    },
    vehicle: {
      model: vehicleModel,
      plate: vehiclePlate,
      mileage: vehicleMileage
    },
    jobType,
    priority: jobUrgency,
    tags: jobTags,
    customerNote,
    internalNote,
    items,
    subtotal,
    discount,
    totalNet: net,
    total: net,
    paid,
    change,
    status: "queue",
    createdAt: serverTimestamp(),
    openedAt: posOpenedAt,
    createdLocalAt: now,
    createdSource: "pos"
  };

  return docData;
}

function buildCustomerMessage(jobDoc) {
  const name = jobDoc.customer?.name || "ลูกค้า";
  const plate = jobDoc.vehicle?.plate || "";
  const firstItems = (jobDoc.items || []).slice(0, 3);
  const itemNames = firstItems.map((i) => i.description).filter(Boolean);

  let jobDesc = "";
  if (itemNames.length) {
    jobDesc = itemNames.join(" + ");
  } else {
    jobDesc = jobDoc.jobType || "งานซ่อมรถมอเตอร์ไซค์";
  }

  const netText = formatCurrency(jobDoc.totalNet || 0);
  const paidText = formatCurrency(jobDoc.paid || 0);
  const changeText = formatCurrency(jobDoc.change || 0);

  const parts = [];
  parts.push(`เรียนคุณ${name}${plate ? ` (${plate})` : ""}`);
  parts.push(`งานซ่อม: ${jobDesc}`);
  parts.push(`ยอดรวม ${netText} บาท`);
  if (jobDoc.paid > 0) {
    parts.push(`รับเงิน ${paidText} บาท`);
    parts.push(`เงินทอน ${changeText} บาท`);
  }
  parts.push("ขอบคุณที่ใช้บริการ BEN MOTOR");

  return parts.join("\n");
}

// -----------------------------
// Save job
// -----------------------------
async function handleSaveBill() {
  const saveBtn = $("posSaveBtn");
  if (saveBtn) saveBtn.disabled = true;

  try {
    const payload = buildJobPayload();
    if (!payload) {
      if (saveBtn) saveBtn.disabled = false;
      return;
    }

    const docRef = await addDoc(jobsCol, payload);

    const message = buildCustomerMessage(payload);

    showToast("บันทึกบิลเรียบร้อย", "success");

    const msgTextarea = $("posCustomerMessageText");
    const msgModalEl = $("posCustomerMessageModal");
    const copyBtn = $("posCopyCustomerMessageBtn");

    if (msgTextarea) {
      msgTextarea.value = message;
    }

    if (msgModalEl) {
      const modal = bootstrap.Modal.getOrCreateInstance(msgModalEl);
      modal.show();
    } else {
      if (navigator.clipboard && message) {
        try {
          await navigator.clipboard.writeText(message);
          showToast("คัดลอกข้อความส่งลูกค้าให้แล้ว", "success");
        } catch {
          alert(message);
        }
      } else {
        alert(message);
      }
    }

    if (copyBtn) {
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(message);
          showToast("คัดลอกข้อความเรียบร้อย", "success");
        } catch {
          showToast("คัดลอกข้อความไม่สำเร็จ", "error");
        }
      };
    }

    // ไม่ล้างฟอร์มทั้งหมด เผื่อจะใช้อ้างอิงต่อ
    console.log("สร้างใบงานใหม่ jobs/" + docRef.id);
  } catch (error) {
    console.error("บันทึกบิลไม่สำเร็จ:", error);
    showToast("บันทึกบิลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", "error");
  } finally {
    const saveBtn2 = $("posSaveBtn");
    if (saveBtn2) saveBtn2.disabled = false;
  }
}

// -----------------------------
// Print (เดโม)
// -----------------------------
function handlePrintBill() {
  showToast("โหมดปริ๊นท์สามารถใช้ฟังก์ชัน Print ของเบราว์เซอร์ได้เลย", "info");
  window.print();
}

// -----------------------------
// Init POS
// -----------------------------
function initPOS() {
  const section = document.querySelector('[data-section="pos"]');
  if (!section) return;

  posOpenedAt = new Date();
  const openedAtEl = $("posOpenedAtText");
  if (openedAtEl) {
    openedAtEl.textContent = formatDateTime(posOpenedAt);
  }

  const addLaborBtn = $("addLaborItemBtn");
  const addPartBtn = $("addPartItemBtn");
  const discountInput = $("posDiscountInput");
  const paidInput = $("posCustomerPaidInput");
  const saveBtn = $("posSaveBtn");
  const printBtn = $("posPrintBtn");

  const presetButtons = document.querySelectorAll("[data-pos-preset]");

  if (addLaborBtn) {
    addLaborBtn.addEventListener("click", () => createItemRow("labor"));
  }
  if (addPartBtn) {
    addPartBtn.addEventListener("click", () => createItemRow("part"));
  }

  if (discountInput) {
    discountInput.addEventListener("input", () => recalcPosSummary());
  }
  if (paidInput) {
    paidInput.addEventListener("input", () => recalcPosSummary());
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      recalcPosSummary();
      handleSaveBill();
    });
  }

  if (printBtn) {
    printBtn.addEventListener("click", handlePrintBill);
  }

  presetButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-pos-preset");
      if (!key) return;
      applyPreset(key);
    });
  });

  // เริ่มต้นมีแถวว่างอย่างน้อย 1 ค่าแรง
  const tbody = $("posItemsBody");
  if (tbody && !tbody.querySelector("tr")) {
    createItemRow("labor");
  }

  recalcPosSummary();
}

// -----------------------------
// Bootstrap
// -----------------------------
document.addEventListener("DOMContentLoaded", () => {
  initPOS();

});
console.log("pos.js loaded OK");
