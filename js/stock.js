// BEN MOTOR POS – Stock & Parts / สต็อกอะไหล่

import {
  db,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  // where, // ไม่ได้ใช้
  orderBy,
  serverTimestamp
} from "./firebase-init.js";

import { formatCurrency, showToast } from "./utils.js";

const stockCol = collection(db, "stock");

let stockCache = [];
let currentEditingStock = null;

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
// Filters
// -----------------------------
function getFilterValues() {
  const searchInput = $("stockSearchInput");
  const categorySelect = $("stockCategoryFilter");
  const lowOnlyCheckbox = $("stockLowOnlyToggle");

  const search = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const category = categorySelect ? categorySelect.value : "all";
  const lowOnly = lowOnlyCheckbox ? lowOnlyCheckbox.checked : false;

  return { search, category, lowOnly };
}

function applyStockFilters() {
  const { search, category, lowOnly } = getFilterValues();
  let filtered = [...stockCache];

  if (category && category !== "all") {
    filtered = filtered.filter(
      (item) => (item.category || "").toLowerCase() === category.toLowerCase()
    );
  }

  if (lowOnly) {
    filtered = filtered.filter((item) => {
      const qty = safeNumber(
        item.qty ?? item.quantity ?? item.stock ?? 0,
        0
      );
      const minStock = safeNumber(item.minStock ?? item.min ?? 0, 0);
      return minStock > 0 && qty <= minStock;
    });
  }

  if (search) {
    filtered = filtered.filter((item) => {
      const name = (item.name || item.partName || "").toLowerCase();
      const sku = (item.sku || "").toLowerCase();
      const categoryLabel = (item.category || "").toLowerCase();
      const haystack = `${name} ${sku} ${categoryLabel}`;
      return haystack.includes(search);
    });
  }

  renderStockTable(filtered);
}

// -----------------------------
// Load stock from Firestore
// -----------------------------
async function loadStockList() {
  const tbody = $("stockTableBody");
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-3 text-muted">
          กำลังโหลดข้อมูลสต็อกอะไหล่จากระบบ...
        </td>
      </tr>
    `;
  }

  try {
    const q = query(stockCol, orderBy("name", "asc"));
    const snap = await getDocs(q);

    stockCache = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      stockCache.push({
        id: docSnap.id,
        ...data
      });
    });

    applyStockFilters();
  } catch (error) {
    console.error("โหลดข้อมูลสต็อกไม่สำเร็จ:", error);
    showToast("โหลดข้อมูลสต็อกไม่สำเร็จ", "error");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-3 text-danger">
            โหลดข้อมูลสต็อกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง
          </td>
        </tr>
      `;
    }
  }
}

// -----------------------------
// Render stock table
// -----------------------------
function renderStockTable(items) {
  const tbody = $("stockTableBody");
  const emptyEl = $("stockTableEmpty");

  if (!tbody || !emptyEl) return;

  if (items.length === 0) {
    tbody.innerHTML = "";
    tbody.style.display = "none";
    emptyEl.style.display = "block";
    return;
  }

  const rowsHtml = items.map((item) => {
    const name = item.name || item.partName || "ไม่ระบุชื่ออะไหล่";
    const sku = item.sku || "";
    const category = item.category || item.type || "-";
    const costPrice = safeNumber(item.costPrice ?? item.buyPrice ?? 0);
    const salePrice = safeNumber(item.salePrice ?? item.price ?? 0);
    const qty = safeNumber(
      item.qty ?? item.quantity ?? item.stock ?? 0,
      0
    );
    const minStock = safeNumber(item.minStock ?? item.min ?? 0, 0);

    const isLow = minStock > 0 && qty <= minStock;

    const qtyClass = isLow ? "text-danger fw-semibold" : "";
    const qtyBadge = isLow
      ? `<span class="badge rounded-pill text-bg-danger ms-2">ใกล้หมด</span>`
      : "";
    
    // ตารางใน app.html มี 7 คอลัมน์
    return `
      <tr data-stock-id="${item.id}">
        <td>${name}</td>
        <td>${sku || "-"}</td>
        <td>${category}</td>
        <td class="text-end ${qtyClass}">
          ${qty} ${qtyBadge}
        </td>
        <td class="text-end">${formatCurrency(costPrice)}</td>
        <td class="text-end">${formatCurrency(salePrice)}</td>
        <td class="text-end">
          <button type="button"
            class="btn btn-sm btn-outline-secondary stock-edit-btn"
            data-bs-toggle="modal"
            data-bs-target="#stockEditModal"
          >
            แก้ไข
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = rowsHtml.join("");
  tbody.style.display = "table-row-group";
  emptyEl.style.display = "none";
}

// -----------------------------
// Open / Fill Edit Modal
// -----------------------------
function openStockEditModal(stockItem) {
  currentEditingStock = stockItem || null;

  const modalEl = $("stockEditModal"); // ID ที่ถูกต้อง
  if (!modalEl) {
    showToast(
      "ไม่พบ Modal สำหรับแก้ไขสต็อก (id=\"stockEditModal\")",
      "error"
    );
    return;
  }
  
  // IDs ที่ถูกแก้ไขให้ตรงกับ app.html ฉบับสมบูรณ์
  const nameInput = $("stockEditName");
  const skuInput = $("stockEditSKU");
  const categoryInput = $("stockEditCategory");
  const costInput = $("stockEditCostPrice");
  const saleInput = $("stockEditSalePrice");
  const qtyInput = $("stockEditQuantity");
  const minStockInput = $("stockEditMinQuantity");
  const titleEl = $("stockEditModalLabel"); 

  if (currentEditingStock) {
    if (titleEl) titleEl.textContent = "แก้ไขอะไหล่ในสต็อก";
    if (nameInput) nameInput.value = currentEditingStock.name || currentEditingStock.partName || "";
    if (skuInput) skuInput.value = currentEditingStock.sku || "";
    if (categoryInput) categoryInput.value = currentEditingStock.category || currentEditingStock.type || "other";
    if (costInput)
      costInput.value = String(
        safeNumber(currentEditingStock.costPrice ?? currentEditingStock.buyPrice ?? 0)
      );
    if (saleInput)
      saleInput.value = String(
        safeNumber(currentEditingStock.salePrice ?? currentEditingStock.price ?? 0)
      );
    if (qtyInput)
      qtyInput.value = String(
        safeNumber(currentEditingStock.qty ?? currentEditingStock.quantity ?? currentEditingStock.stock ?? 0)
      );
    if (minStockInput)
      minStockInput.value = String(
        safeNumber(currentEditingStock.minStock ?? currentEditingStock.min ?? 0)
      );
  } else {
    if (titleEl) titleEl.textContent = "เพิ่มอะไหล่ใหม่เข้าสต็อก";
    if (nameInput) nameInput.value = "";
    if (skuInput) skuInput.value = "";
    if (categoryInput) categoryInput.value = "engine"; // Set default
    if (costInput) costInput.value = "";
    if (saleInput) saleInput.value = "";
    if (qtyInput) qtyInput.value = "";
    if (minStockInput) minStockInput.value = "0";
  }

  // เนื่องจากเราใช้ data-bs-target ใน HTML ปุ่มแล้ว การเรียก Modal.show ตรงนี้จึงไม่จำเป็น
  // แต่ถ้าต้องการให้เปิดจากปุ่มอื่น ๆ ที่ไม่มี data-bs-target ก็สามารถใช้โค้ดนี้ได้
  // const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  // modal.show();
}

// -----------------------------
// Save stock (Add / Update)
// -----------------------------
async function handleStockSave(e) {
  if (e && e.preventDefault) e.preventDefault();

  // IDs ที่ถูกแก้ไขให้ตรงกับ app.html ฉบับสมบูรณ์
  const nameInput = $("stockEditName");
  const skuInput = $("stockEditSKU");
  const categoryInput = $("stockEditCategory");
  const costInput = $("stockEditCostPrice");
  const saleInput = $("stockEditSalePrice");
  const qtyInput = $("stockEditQuantity");
  const minStockInput = $("stockEditMinQuantity");
  const saveBtn = $("stockEditSaveBtn"); 
  
  // ตรวจสอบความพร้อมของ DOM
  if (!nameInput || !qtyInput || !saleInput) {
    showToast("ฟอร์มแก้ไขสต็อกยังไม่ครบในหน้าเว็บ", "error");
    return;
  }

  const name = nameInput.value.trim();
  const sku = skuInput ? skuInput.value.trim() : "";
  const category = categoryInput ? categoryInput.value.trim() : "";
  const costPrice = safeNumber(costInput ? costInput.value || 0 : 0);
  const salePrice = safeNumber(saleInput.value || 0);
  const qty = safeNumber(qtyInput.value || 0);
  const minStock = safeNumber(minStockInput ? minStockInput.value || 0 : 0);

  if (!name) {
    showToast("กรุณากรอกชื่ออะไหล่", "error");
    return;
  }
  if (!salePrice || salePrice <= 0) {
    showToast("กรุณากรอกราคาขายที่ถูกต้อง", "error");
    return;
  }

  if (saveBtn) saveBtn.disabled = true;

  const id = currentEditingStock ? currentEditingStock.id : "";
  const now = new Date();

  const payload = {
    name,
    sku,
    category,
    costPrice,
    salePrice,
    qty,
    minStock,
    updatedAt: serverTimestamp(),
    updatedLocalAt: now
  };

  try {
    if (id) {
      const ref = doc(db, "stock", id);
      await updateDoc(ref, payload);
      showToast("อัปเดตข้อมูลอะไหล่เรียบร้อย", "success");
    } else {
      const newPayload = {
        ...payload,
        createdAt: serverTimestamp(),
        createdLocalAt: now
      };
      await addDoc(stockCol, newPayload);
      showToast("เพิ่มอะไหล่ใหม่เข้าสต็อกเรียบร้อย", "success");
    }

    const modalEl = $("stockEditModal");
    if (modalEl) {
      const modal = window.bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }

    currentEditingStock = null;
    loadStockList();
  } catch (error) {
    console.error("บันทึกข้อมูลสต็อกไม่สำเร็จ:", error);
    showToast("บันทึกข้อมูลสต็อกไม่สำเร็จ", "error");
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

// -----------------------------
// Init stock section
// -----------------------------
export function initStock() {
  const section = document.querySelector('[data-section="stock"]');
  if (!section) return;

  const searchInput = $("stockSearchInput");
  const categorySelect = $("stockCategoryFilter");
  const lowOnlyCheckbox = $("stockLowOnlyToggle");
  const addNewBtn = $("stockAddNewBtn");
  const reloadBtn = $("stockReloadBtn");
  const saveBtn = $("stockEditSaveBtn"); 
  const editForm = $("stockEditForm");
  const tbody = $("stockTableBody");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      applyStockFilters();
    });
  }

  if (categorySelect) {
    categorySelect.addEventListener("change", () => {
      applyStockFilters();
    });
  }

  if (lowOnlyCheckbox) {
    lowOnlyCheckbox.addEventListener("change", () => {
      applyStockFilters();
    });
  }

  if (addNewBtn) {
    addNewBtn.addEventListener("click", () => {
      openStockEditModal(null); // เปิด Modal เพื่อเพิ่มใหม่
    });
  }

  if (reloadBtn) {
    reloadBtn.addEventListener("click", () => {
      loadStockList();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", handleStockSave);
  }

  if (editForm) {
    editForm.addEventListener("submit", handleStockSave);
  }

  if (tbody) {
    // ใช้ event delegation สำหรับปุ่มแก้ไข
    tbody.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest(".stock-edit-btn");
      if (!btn) return;

      const row = btn.closest("tr[data-stock-id]");
      if (!row) return;
      const id = row.getAttribute("data-stock-id");
      if (!id) return;

      const item = stockCache.find((s) => s.id === id);
      if (!item) return;

      openStockEditModal(item);
      // เนื่องจากปุ่มมี data-bs-target="#stockEditModal" อยู่แล้ว Modal จะเปิดเอง
    });
  }

  // เรียกโหลดข้อมูลเมื่อส่วน Stock ถูกเปิดขึ้นมา
  section.addEventListener("data-loaded", loadStockList);
  
  if (section.classList.contains("active")) {
      loadStockList();
  }
}
