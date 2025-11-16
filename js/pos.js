// BEN MOTOR POS – POS / เปิดบิลใบรับรถ

import {
  db,
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp
} from "./firebase-init.js";

import { formatCurrency, formatDateTime, showToast } from "./utils.js";

const jobsCol = collection(db, "jobs");
const stockCol = collection(db, "stock");

let posOpenedAt = new Date();
let stockCache = []; // เพิ่ม stockCache เข้ามา
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

  const rowId = "row-" + Date.now() + "-" + Math.floor(Math.random() * 1000);

  const isPart = type === "part";
  const typeBadge = isPart 
    ? `<span class="badge text-bg-success">อะไหล่</span>` 
    : `<span class="badge text-bg-primary">ค่าแรง</span>`;
  
  const partInputHtml = isPart 
    ? `<div class="input-group input-group-sm"><input type="text" class="form-control pos-item-desc" placeholder="ชื่ออะไหล่" required data-row-id="${rowId}"><button type="button" class="btn btn-outline-secondary pos-select-stock-btn" data-row-id="${rowId}"><i class="bi bi-box-seam"></i></button></div>`
    : `<input type="text" class="form-control pos-item-desc" placeholder="เช่น ค่าแรงเปลี่ยนถ่ายน้ำมันเครื่อง" required data-row-id="${rowId}">`;

  const html = `
    <tr data-row-id="${rowId}" data-item-type="${type}">
      <td>${typeBadge}</td>
      <td>${partInputHtml}</td>
      <td class="text-end">
        <input type="number" class="form-control form-control-sm text-end pos-item-qty" value="1" min="1" required data-row-id="${rowId}">
      </td>
      <td class="text-end">
        <input type="number" class="form-control form-control-sm text-end pos-item-price" value="0" min="0" required data-row-id="${rowId}">
      </td>
      <td class="text-end fw-semibold pos-item-total" data-row-id="${rowId}">0</td>
      <td class="text-center">
        <button type="button" class="btn btn-sm btn-outline-danger pos-item-remove-btn" data-row-id="${rowId}">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `;

  tbody.insertAdjacentHTML('beforeend', html);
  recalcPosSummary();
}

function recalcPosSummary() {
  const rows = document.querySelectorAll("#posItemsBody tr");
  let subtotalLabor = 0;
  let subtotalPart = 0;
  let grandSubtotal = 0;

  rows.forEach(row => {
    const qtyInput = row.querySelector(".pos-item-qty");
    const priceInput = row.querySelector(".pos-item-price");
    const totalEl = row.querySelector(".pos-item-total");
    const type = row.dataset.itemType;

    const qty = getNumberFromInput(qtyInput);
    const price = getNumberFromInput(priceInput);
    const total = qty * price;
    
    if (type === "labor") {
      subtotalLabor += total;
    } else if (type === "part") {
      subtotalPart += total;
    }
    
    if (totalEl) totalEl.textContent = formatCurrency(total);
  });
  
  grandSubtotal = subtotalLabor + subtotalPart;
  const discount = getNumberFromInput($("posDiscountInput"));
  const paid = getNumberFromInput($("posCustomerPaidInput"));
  
  const grandTotal = grandSubtotal - discount;
  const change = paid - grandTotal;

  setText("posSubtotalLabor", formatCurrency(subtotalLabor) + " บาท");
  setText("posSubtotalPart", formatCurrency(subtotalPart) + " บาท");
  setText("posGrandSubtotal", formatCurrency(grandSubtotal) + " บาท");
  setText("posDiscountText", formatCurrency(discount) + " บาท");
  setText("posGrandTotal", formatCurrency(grandTotal) + " บาท");
  setText("posChangeText", formatCurrency(change) + " บาท");
}

function handleItemChange(e) {
  const target = e.target;
  if (!target.classList.contains("pos-item-qty") && !target.classList.contains("pos-item-price")) {
    return;
  }
  recalcPosSummary();
}

function handleItemRemove(e) {
  const target = e.target;
  const btn = target.closest(".pos-item-remove-btn");
  if (!btn) return;
  
  const rowId = btn.getAttribute("data-row-id");
  const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
  if (row) {
    row.remove();
    recalcPosSummary();
  }
}

// -----------------------------
// Stock Modal Integration
// -----------------------------
async function loadStockCache() {
  const stockTbody = $("stockSelectBody");
  if (stockTbody) {
    stockTbody.innerHTML = '<tr><td colspan="5" class="text-center py-3 text-muted">กำลังโหลดข้อมูลสต็อก...</td></tr>';
  }
  
  try {
    const q = query(stockCol, orderBy("name", "asc"));
    const snap = await getDocs(q);

    stockCache = [];
    snap.forEach((docSnap) => {
      stockCache.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });
    
    renderStockSelectTable(stockCache);
  } catch (error) {
    console.error("โหลดข้อมูลสต็อกไม่สำเร็จ:", error);
    if (stockTbody) {
      stockTbody.innerHTML = ` <tr> <td colspan="5" class="text-center py-3 text-danger"> โหลดข้อมูลสต็อกไม่สำเร็จ </td> </tr> `;
    }
  }
}

function renderStockSelectTable(stockItems) {
  const tbody = $("stockSelectBody");
  if (!tbody) return;
  
  if (stockItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-3 text-muted">ไม่มีรายการอะไหล่ในสต็อก</td></tr>';
    return;
  }
  
  const html = stockItems.map(item => {
    const qty = item.qty || item.quantity || 0;
    const price = item.salePrice || item.price || 0;
    const lowStock = (item.minStock || 0) > 0 && qty <= (item.minStock || 0);

    return `
      <tr data-stock-id="${item.id}">
        <td>${item.name || "-"}</td>
        <td>${item.sku || "-"}</td>
        <td class="text-end ${lowStock ? 'text-danger fw-semibold' : ''}">${qty}</td>
        <td class="text-end">${formatCurrency(price)}</td>
        <td class="text-center">
          <button type="button" class="btn btn-sm btn-success pos-select-item-btn" data-stock-id="${item.id}">
            เลือก
          </button>
        </td>
      </tr>
    `;
  }).join("");
  
  tbody.innerHTML = html;
}

function handleSelectStock(e) {
  const target = e.target;
  const btn = target.closest(".pos-select-stock-btn");
  if (!btn) return;

  const rowId = btn.getAttribute("data-row-id");
  selectedRowForStock = rowId;
  
  // Load cache before showing modal
  loadStockCache(); 
  
  // Show modal
  const modalEl = $("stockSelectModal");
  if (modalEl) {
    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

function handleApplyStockSelection(e) {
  const target = e.target;
  const btn = target.closest(".pos-select-item-btn");
  if (!btn || !selectedRowForStock) return;
  
  const stockId = btn.getAttribute("data-stock-id");
  const selectedItem = stockCache.find(item => item.id === stockId);
  
  if (!selectedItem) {
    showToast("ไม่พบข้อมูลอะไหล่", "error");
    return;
  }
  
  // Fill data into the designated row
  const row = document.querySelector(`tr[data-row-id="${selectedRowForStock}"]`);
  if (row) {
    const descInput = row.querySelector(".pos-item-desc");
    const priceInput = row.querySelector(".pos-item-price");
    
    if (descInput) descInput.value = selectedItem.name || selectedItem.partName || "";
    if (priceInput) priceInput.value = String(selectedItem.salePrice || selectedItem.price || 0);
    
    // Set stock ID on the row for later inventory update
    row.dataset.stockRefId = selectedItem.id;
    
    recalcPosSummary();
  }
  
  // Hide modal
  const modalEl = $("stockSelectModal");
  if (modalEl) {
    const modal = window.bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
  }
  selectedRowForStock = null;
}

// -----------------------------
// Build job payload + customer message
// -----------------------------
function buildJobPayload() {
  const form = $("posForm");
  const rows = document.querySelectorAll("#posItemsBody tr");
  
  const items = [];
  let totalParts = 0;
  
  rows.forEach(row => {
    const qtyInput = row.querySelector(".pos-item-qty");
    const priceInput = row.querySelector(".pos-item-price");
    const descInput = row.querySelector(".pos-item-desc");
    
    const type = row.dataset.itemType;
    const description = descInput ? descInput.value.trim() : "-";
    const quantity = getNumberFromInput(qtyInput);
    const price = getNumberFromInput(priceInput);
    const stockRefId = row.dataset.stockRefId || null;
    
    items.push({
      type,
      description,
      quantity,
      price,
      stockRefId, // For stock update later
      subtotal: quantity * price
    });
    
    if (type === "part") {
      totalParts += quantity * price;
    }
  });

  const grandSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const discount = getNumberFromInput($("posDiscountInput"));
  const grandTotal = grandSubtotal - discount;
  const paid = getNumberFromInput($("posCustomerPaidInput"));

  return {
    customerName: $("posCustomerName").value.trim(),
    customerPhone: $("posCustomerPhone").value.trim(),
    vehicleModel: $("posVehicleModel").value.trim(),
    vehiclePlate: $("posVehiclePlate").value.trim(),
    vehicleMileage: getNumberFromInput($("posVehicleMileage")),
    jobDescription: $("posJobDescription").value.trim(),
    status: $("posJobStatus").value,
    items,
    discount,
    paid,
    total: grandTotal,
    change: paid - grandTotal,
    totalParts,
    totalLabor: grandSubtotal - totalParts,
    createdAt: serverTimestamp(),
    jobOpenedAt: posOpenedAt,
    // Add doneAt only if status is done/canceled, which is not typical for POS open bill
    // doneAt: jobStatus === 'done' || jobStatus === 'canceled' ? serverTimestamp() : null,
  };
}

function generateCustomerMessage(payload) {
    const { customerName, vehicleModel, vehiclePlate, jobDescription, total, status } = payload;
    const date = formatDateTime(payload.jobOpenedAt, true);

    const plateText = vehiclePlate ? ` (ทะเบียน ${vehiclePlate})` : '';
    let statusText = '';
    if (status === 'pending') statusText = 'รอการตรวจเช็ค';
    else if (status === 'in-progress') statusText = 'กำลังดำเนินการซ่อม';
    else if (status === 'awaiting-part') statusText = 'รออะไหล่';
    else if (status === 'ready') statusText = 'ซ่อมเสร็จ / พร้อมส่งมอบ';
    else if (status === 'done') statusText = 'ปิดบิลเรียบร้อย';
    else if (status === 'canceled') statusText = 'ยกเลิกงาน';
    
    const message = `
งานซ่อม #JOB${Date.now()}
เรียน คุณ${customerName}
รถรุ่น ${vehicleModel}${plateText} เข้าซ่อมวันที่ ${date}
อาการ: ${jobDescription}
สถานะปัจจุบัน: ${statusText}

ยอดรวม (โดยประมาณ): ${formatCurrency(total)} บาท
(ตรวจสอบยอดสุดท้ายกับทางร้านอีกครั้ง)

ขอบคุณที่ใช้บริการ BEN MOTOR
`;
    return message.trim();
}

function handleCustomerMessage() {
    const payload = buildJobPayload();
    const msg = generateCustomerMessage(payload);

    const msgTextarea = $("posCustomerMessageTextarea");
    if (msgTextarea) msgTextarea.value = msg;

    const copyBtn = $("posCustomerMessageCopyBtn");
    if (copyBtn) {
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(msg).then(() => {
                showToast("คัดลอกข้อความสำหรับลูกค้าแล้ว", "success");
            }).catch(err => {
                showToast("คัดลอกไม่สำเร็จ: " + err.message, "error");
            });
        };
    }

    const msgModalEl = $("posCustomerMessageModal"); // ID ที่ถูกต้องใน app.html
    if (msgModalEl) {
        const modal = window.bootstrap.Modal.getOrCreateInstance(msgModalEl);
        modal.show();
    }
}

// -----------------------------
// Save Bill (Job)
// -----------------------------
async function handleSaveBill() {
  const payload = buildJobPayload();
  const form = $("posForm");

  // Basic validation (form required check should cover most)
  if (!payload.customerName || !payload.vehicleModel || !payload.jobDescription || payload.total <= 0) {
      showToast("กรุณากรอกข้อมูลลูกค้า, รถ, รายละเอียดงาน และยอดรวมให้ครบถ้วน (ยอดต้อง > 0)", "error");
      return;
  }
  
  const saveBtn = $("posSaveBtn");
  if (saveBtn) saveBtn.disabled = true;

  try {
    // 1. Save Job to Firestore
    const newJobRef = await addDoc(jobsCol, payload);

    // 2. Update Stock (Decrement Qty)
    const stockUpdates = payload.items
      .filter(item => item.type === 'part' && item.stockRefId && item.quantity > 0)
      .map(async item => {
          const stockItem = stockCache.find(s => s.id === item.stockRefId);
          if (stockItem) {
              const currentQty = stockItem.qty || stockItem.quantity || 0;
              const newQty = currentQty - item.quantity;
              
              const ref = doc(db, "stock", item.stockRefId);
              await updateDoc(ref, {
                  qty: Math.max(0, newQty), // Ensure quantity doesn't go below 0
                  updatedAt: serverTimestamp()
              });
          }
      });
      
    await Promise.all(stockUpdates);

    showToast(`บันทึกงานซ่อม #JOB${newJobRef.id.substring(0, 5)} เรียบร้อย`, "success");

    // Show customer message modal after successful save
    handleCustomerMessage(payload);

    // Reset form after successful save
    form.reset();
    $("posDiscountInput").value = "0";
    $("posCustomerPaidInput").value = "0";
    $("#posItemsBody").innerHTML = ""; // Clear items
    createItemRow("labor"); // Add a default labor row
    recalcPosSummary();
    posOpenedAt = new Date(); // Reset opened time
    
  } catch (error) {
    console.error("บันทึกงานซ่อมไม่สำเร็จ:", error);
    showToast("บันทึกงานซ่อมไม่สำเร็จ กรุณาลองใหม่", "error");
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

function handlePrintBill() {
    showToast("ฟังก์ชันพิมพ์ใบแจ้งหนี้ยังไม่ถูกพัฒนา", "info");
}

function applyPreset(key) {
    // This function will apply preset data based on key (e.g., 'car', 'bike')
    // Placeholder logic for future development
    showToast(`ใช้ Preset: ${key} (ยังไม่ถูกพัฒนา)`, "info");
}

// -----------------------------
// Init
// -----------------------------
export function initPos() {
  const section = document.querySelector('[data-section="pos"]');
  if (!section) return;
  
  // Load stock when the section is shown (for part selection)
  section.addEventListener("data-loaded", loadStockCache);
  
  // Set default form values and initial row
  const tbody = $("posItemsBody");
  if (tbody && tbody.children.length === 0) {
      createItemRow("labor"); // Start with one labor row
  }
  
  // Form Events
  const addLaborBtn = $("addLaborItemBtn");
  const addPartBtn = $("addPartItemBtn");
  const discountInput = $("posDiscountInput");
  const paidInput = $("posCustomerPaidInput");
  const saveBtn = $("posSaveBtn");
  const printBtn = $("posPrintBtn");
  const stockSelectBody = $("stockSelectBody");

  // Global listener for dynamic rows in POS
  const posItemsBody = $("posItemsBody");
  if (posItemsBody) {
    posItemsBody.addEventListener("input", handleItemChange);
    posItemsBody.addEventListener("click", handleItemRemove);
    posItemsBody.addEventListener("click", handleSelectStock);
  }

  // Stock Select Modal Events (Handles item selection)
  if (stockSelectBody) {
      stockSelectBody.addEventListener("click", handleApplyStockSelection);
  }


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
  
  // Initial calculation on load
  recalcPosSummary();
}
