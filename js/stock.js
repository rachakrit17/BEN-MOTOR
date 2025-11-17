// BEN MOTOR POS – Stock & Parts / สต็อกอะไหล่

import {
  db,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
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

// แปลงค่าจาก Firestore Timestamp / string -> yyyy-mm-dd (สำหรับโชว์/ใส่ input[type=date])
function normalizeDateField(v) {
  if (!v) return "";
  let d = v;

  // Firestore Timestamp
  if (typeof v === "object" && typeof v.toDate === "function") {
    d = v.toDate();
  } else if (typeof v === "string" || typeof v === "number") {
    d = new Date(v);
  }

  if (!(d instanceof Date) || isNaN(d.getTime())) return "";

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// -----------------------------
// Filters
// -----------------------------
function getFilterValues() {
  const searchInput = $("stockSearchInput");
  const categorySelect = $("stockCategoryFilter");
  // const lowOnlyCheckbox = $("stockLowOnlyToggle"); // ยังไม่ใช้

  const search = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const category = categorySelect ? categorySelect.value : "all";

  return { search, category, lowOnly: false };
}

function applyStockFilters() {
  const { search, category } = getFilterValues();
  let filtered = [...stockCache];

  if (category && category !== "all") {
    filtered = filtered.filter(
      (item) => (item.category || "").toLowerCase() === category.toLowerCase()
    );
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
        <td colspan="10" class="text-center py-3 text-muted">
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
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="text-center py-3 text-danger">
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
  if (!tbody) return;

  const emptyStateEl = $("stockEmptyState");
  if (!items.length) {
    tbody.innerHTML = "";
    if (emptyStateEl) emptyStateEl.classList.remove("d-none");
    return;
  } else {
    if (emptyStateEl) emptyStateEl.classList.add("d-none");
  }

  let lowCount = 0;

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
    if (isLow) lowCount += 1;

    const qtyClass = isLow ? "text-danger fw-semibold" : "";

    const categoryMap = {
      brake: "ระบบเบรก",
      engine: "เครื่องยนต์",
      tire: "ยาง / ล้อ",
      electric: "ระบบไฟ",
      other: "อื่นๆ"
    };

    const categoryLabel =
      category && categoryMap[category.toLowerCase()]
        ? categoryMap[category.toLowerCase()]
        : category;

    // ฟิลด์ใหม่
    const receivedAtStr = normalizeDateField(
      item.receivedAt || item.receivedDate || ""
    );
    const note = item.note || item.notes || "";

    return `
<tr data-stock-id="${item.id}" class="bm-stock-row">
  <td>
    <div class="fw-semibold">${name}</div>
  <td>${categoryLabel}</td>
  <td class="text-end small">
    ${costPrice ? formatCurrency(costPrice) : "-"}
  </td>
  <td class="text-end small">
    ${salePrice ? formatCurrency(salePrice) : "-"}
  </td>
  <td class="text-center small ${qtyClass}">
    ${qty}
  </td>
  <td class="text-center small">
    ${minStock}
  </td>
  <td>${sku || "-"}</td>
  <td>${receivedAtStr || "-"}</td>
  <td>${note || "-"}</td>
  <td class="text-end">
    <button type="button"
      class="btn btn-sm btn-outline-secondary stock-edit-btn">
      แก้ไข
    </button>
  </td>
</tr>
    `;
  });

  tbody.innerHTML = rowsHtml.join("");
}

// -----------------------------
// Open / Fill Edit Modal
// -----------------------------
function openStockEditModal(stockItem) {
  currentEditingStock = stockItem || null;

  const modalEl = $("stockItemModal");
  if (!modalEl) {
    const msg = [
      'ยังไม่ได้สร้างหน้าต่างแก้ไขสต็อก (Modal id="stockItemModal") บนหน้าเว็บ',
      "ระบบสามารถทำงานได้ แต่จะไม่สามารถเพิ่ม/แก้ไขอะไหล่ผ่าน UI นี้ได้"
    ].join("\n");
    alert(msg);
    return;
  }

  const idInput = $("stockItemId");
  const nameInput = $("stockItemName");
  const skuInput = $("stockItemSku");
  const categoryInput = $("stockItemCategory");
  const costInput = $("stockItemCost");
  const saleInput = $("stockItemPrice");
  const qtyInput = $("stockItemQty");
  const minStockInput = $("stockItemMin");
  const receivedAtInput = $("stockItemReceivedAt"); // ใหม่
  const noteInput = $("stockItemNote");             // ใหม่
  const titleEl = $("stockItemModalTitle");

  if (currentEditingStock) {
    if (titleEl) titleEl.textContent = "แก้ไขอะไหล่ในสต็อก";
    if (idInput) idInput.value = currentEditingStock.id || "";
    if (nameInput)
      nameInput.value =
        currentEditingStock.name || currentEditingStock.partName || "";
    if (skuInput) skuInput.value = currentEditingStock.sku || "";
    if (categoryInput)
      categoryInput.value =
        currentEditingStock.category || currentEditingStock.type || "";
    if (costInput)
      costInput.value = String(
        safeNumber(
          currentEditingStock.costPrice ?? currentEditingStock.buyPrice ?? 0
        )
      );
    if (saleInput)
      saleInput.value = String(
        safeNumber(
          currentEditingStock.salePrice ?? currentEditingStock.price ?? 0
        )
      );
    if (qtyInput)
      qtyInput.value = String(
        safeNumber(
          currentEditingStock.qty ??
            currentEditingStock.quantity ??
            currentEditingStock.stock ??
            0
        )
      );
    if (minStockInput)
      minStockInput.value = String(
        safeNumber(currentEditingStock.minStock ?? currentEditingStock.min ?? 0)
      );

    if (receivedAtInput) {
      const receivedStr = normalizeDateField(
        currentEditingStock.receivedAt || currentEditingStock.receivedDate || ""
      );
      receivedAtInput.value = receivedStr;
    }
    if (noteInput) {
      noteInput.value =
        currentEditingStock.note || currentEditingStock.notes || "";
    }
  } else {
    if (titleEl) titleEl.textContent = "เพิ่มอะไหล่ใหม่เข้าสต็อก";
    if (idInput) idInput.value = "";
    if (nameInput) nameInput.value = "";
    if (skuInput) skuInput.value = "";
    if (categoryInput) categoryInput.value = "other";
    if (costInput) costInput.value = "0";
    if (saleInput) saleInput.value = "0";
    if (qtyInput) qtyInput.value = "0";
    if (minStockInput) minStockInput.value = "1";
    if (receivedAtInput) receivedAtInput.value = "";
    if (noteInput) noteInput.value = "";
  }

  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

// -----------------------------
// Save stock (Add / Update)
// -----------------------------
async function handleStockSave(e) {
  if (e && e.preventDefault) e.preventDefault();

  const idInput = $("stockItemId");
  const nameInput = $("stockItemName");
  const skuInput = $("stockItemSku");
  const categoryInput = $("stockItemCategory");
  const costInput = $("stockItemCost");
  const saleInput = $("stockItemPrice");
  const qtyInput = $("stockItemQty");
  const minStockInput = $("stockItemMin");
  const receivedAtInput = $("stockItemReceivedAt"); // ใหม่
  const noteInput = $("stockItemNote");             // ใหม่
  const saveBtn = $("stockItemSaveBtn");

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
  const receivedAt = receivedAtInput ? receivedAtInput.value : "";
  const note = noteInput ? noteInput.value.trim() : "";

  if (!name) {
    showToast("กรุณากรอกชื่ออะไหล่", "error");
    nameInput.focus();
    return;
  }
  if (!salePrice) {
    showToast("กรุณากรอกราคาขาย", "error");
    saleInput.focus();
    return;
  }
  if (!qty) {
    showToast("กรุณากรอกจำนวนคงเหลือ", "error");
    qtyInput.focus();
    return;
  }

  if (saveBtn) saveBtn.disabled = true;

  const id = idInput ? idInput.value.trim() : "";
  const now = new Date();

  const payload = {
    name,
    sku,
    category,
    costPrice,
    salePrice,
    qty,
    minStock,
    receivedAt, // วันที่รับเข้า (string yyyy-mm-dd)
    note,       // หมายเหตุ
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

    const modalEl = $("stockItemModal");
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
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
function initStock() {
  const section = document.querySelector('[data-section="stock"]');
  if (!section) return;

  const searchInput = $("stockSearchInput");
  const categorySelect = $("stockCategoryFilter");
  const addNewBtn = $("stockAddItemBtn");
  const reloadBtn = $("stockReloadBtn");
  const saveBtn = $("stockItemSaveBtn");
  const editForm = $("stockItemForm");
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

  if (addNewBtn) {
    addNewBtn.addEventListener("click", () => {
      openStockEditModal(null);
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
    });
  }

  loadStockList();
}

// -----------------------------
// Bootstrap
// -----------------------------
document.addEventListener("DOMContentLoaded", () => {
  initStock();
});