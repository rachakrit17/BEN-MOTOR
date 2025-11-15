// js/repair-knowledge.js
// เมนู "แนะนำการซ่อม" ของ BEN MOTOR POS
// - ใช้ demoRepairRecipes จาก data-mock.js
// - ค้นหาตามชื่อสูตร/อาการ/แท็ก
// - กรองตามกลุ่มงาน (group) / หมวดอาการ (symptomCategory)
// - แสดงรายละเอียดสูตรซ่อม + แยกค่าแรง/อะไหล่
// - ปุ่ม "ใช้สูตรนี้เตรียมเปิดบิล" จะร่างข้อความรายการงาน/อะไหล่ให้ ก๊อปไปใช้ใน POS ได้ทันที

import { demoRepairRecipes, demoStock } from "./data-mock.js";

const $ = (selector) => document.querySelector(selector);

// ---------- Helpers ----------

function formatCurrencyTHB(value) {
  const num = Number(value) || 0;
  return num.toLocaleString("th-TH") + " บาท";
}

function formatMinutes(mins) {
  const m = Number(mins) || 0;
  if (m <= 0) return "-";
  if (m < 60) return `${m} นาที`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (r === 0) return `${h} ชม.`;
  return `${h} ชม. ${r} นาที`;
}

function findStockByCode(code) {
  if (!code) return null;
  return demoStock.find((item) => item.code === code) || null;
}

// ---------- State ----------
let allRecipes = demoRepairRecipes.slice();
let filteredRecipes = allRecipes.slice();
let selectedRecipeId = allRecipes[0]?.id || null;

// ---------- DOM refs ----------
let searchInput;
let groupSelect;
let symptomSelect;
let favoritesOnlyCheckbox;
let clearFilterBtn;

let listContainer;
let detailContainer;
let posTemplateTextarea;
let copyPosTemplateBtn;

// ---------- Layout ----------

function buildRepairLayout(cardBody) {
  cardBody.innerHTML = `
    <div class="bm-form-section-title">แนะนำการซ่อม (สูตรประจำตัวช่าง)</div>
    <div class="bm-form-section-subtitle">
      เก็บสูตรซ่อมที่ใช้งานบ่อย แยกตามอาการ/ระบบรถ และดึงไปใช้ตอนเปิดบิลได้ไวกว่าเขียนใหม่ทุกครั้ง
    </div>

    <div class="row g-2 g-md-3 align-items-end mb-2">
      <div class="col-12 col-md-5">
        <label for="bm-repair-search" class="form-label mb-1">ค้นหาสูตรซ่อม</label>
        <input
          type="text"
          id="bm-repair-search"
          class="form-control form-control-sm"
          placeholder="พิมพ์ชื่อสูตร, อาการ, แท็ก, หมายเหตุ"
        >
      </div>
      <div class="col-6 col-md-3">
        <label for="bm-repair-group-filter" class="form-label mb-1">กลุ่มงานซ่อม</label>
        <select id="bm-repair-group-filter" class="form-select form-select-sm">
          <option value="all">สูตรทั้งหมด</option>
        </select>
      </div>
      <div class="col-6 col-md-3">
        <label for="bm-repair-symptom-filter" class="form-label mb-1">ระบบ / อาการ</label>
        <select id="bm-repair-symptom-filter" class="form-select form-select-sm">
          <option value="all">ทุกอาการ</option>
        </select>
      </div>
      <div class="col-6 col-md-3 mt-1 mt-md-0">
        <div class="form-check" style="font-size:0.78rem;">
          <input class="form-check-input" type="checkbox" value="" id="bm-repair-favorites-only">
          <label class="form-check-label" for="bm-repair-favorites-only">
            แสดงเฉพาะสูตรที่ใช้เปิดบิลบ่อย
          </label>
        </div>
      </div>
      <div class="col-6 col-md-2">
        <button
          type="button"
          id="bm-repair-clear-filter"
          class="bm-btn-outline-soft w-100"
          style="margin-top:1.6rem;"
        >
          <i class="bi bi-x-circle"></i>
          ล้างตัวกรอง
        </button>
      </div>
    </div>

    <div class="row g-2 g-md-3">
      <div class="col-12 col-lg-5">
        <div class="bm-subpanel" style="max-height:420px;overflow-y:auto;">
          <div style="font-size:0.78rem;color:#6b7280;margin-bottom:6px;">
            รายการสูตรซ่อมทั้งหมด
          </div>
          <div id="bm-repair-list" class="bm-scroll-y-soft"></div>
        </div>
      </div>
      <div class="col-12 col-lg-7">
        <div class="bm-subpanel mb-2">
          <div style="font-size:0.78rem;color:#6b7280;margin-bottom:4px;">
            รายละเอียดสูตรซ่อม / วิธีทำงาน / หมายเหตุ
          </div>
          <div id="bm-repair-detail">
            <div style="font-size:0.8rem;color:#9ca3af;">
              เลือกสูตรซ่อมจากด้านซ้ายเพื่อดูรายละเอียด และเตรียมรายการไปใช้ตอนเปิดบิล
            </div>
          </div>
        </div>

        <div class="bm-subpanel">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <div>
              <div class="bm-form-section-title" style="font-size:0.84rem;margin-bottom:0;">
                ข้อความ / รายการสำหรับใช้ในบิล
              </div>
              <div class="bm-form-section-subtitle" style="margin-bottom:0;">
                ระบบจะร่างรายการค่าแรงและอะไหล่ตามสูตรซ่อมที่เลือก ให้ก๊อปไปวางที่หน้า "เปิดบิล" ได้เลย
              </div>
            </div>
            <div>
              <button type="button" id="bm-repair-copy-pos-template" class="bm-btn-outline-soft">
                <i class="bi bi-clipboard"></i>
                คัดลอกข้อความ
              </button>
            </div>
          </div>
          <textarea
            id="bm-repair-pos-template"
            rows="6"
            class="form-control"
            style="font-size:0.8rem;"
            placeholder="เลือกสูตรซ่อมด้านซ้าย แล้วกดปุ่ม &quot;ใช้สูตรนี้เตรียมเปิดบิล&quot; จากรายละเอียดด้านบน ข้อความจะถูกสร้างอัตโนมัติ"
          ></textarea>
        </div>
      </div>
    </div>
  `;
}

// ---------- Filters population ----------

function populateFilterOptions() {
  if (groupSelect) {
    // ถ้า select มี option มากกว่า 1 แสดงว่ามีใน HTML อยู่แล้ว ไม่เติมซ้ำ
    if (groupSelect.options.length <= 1) {
      const groups = Array.from(
        new Set(
          allRecipes
            .map((r) => r.group)
            .filter((g) => typeof g === "string" && g.trim() !== "")
        )
      ).sort((a, b) => a.localeCompare(b));

      groups.forEach((g) => {
        const opt = document.createElement("option");
        opt.value = g;
        opt.textContent = g;
        groupSelect.appendChild(opt);
      });
    }
  }

  if (symptomSelect) {
    if (symptomSelect.options.length <= 1) {
      const syms = Array.from(
        new Set(
          allRecipes
            .map((r) => r.symptomCategory)
            .filter((g) => typeof g === "string" && g.trim() !== "")
        )
      ).sort((a, b) => a.localeCompare(b));

      syms.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        symptomSelect.appendChild(opt);
      });
    }
  }
}

// ---------- Filters logic ----------

function applyRepairFilters() {
  const searchText = (searchInput?.value || "").trim().toLowerCase();
  const groupVal = groupSelect?.value || "all";
  const symptomVal = symptomSelect?.value || "all";
  const favoritesOnly = !!(favoritesOnlyCheckbox && favoritesOnlyCheckbox.checked);

  filteredRecipes = allRecipes.filter((r) => {
    if (groupVal !== "all" && r.group !== groupVal) {
      return false;
    }
    if (symptomVal !== "all" && r.symptomCategory !== symptomVal) {
      return false;
    }

    if (favoritesOnly && !r.autoPOSTemplate) {
      return false;
    }

    if (searchText) {
      const haystack = [
        r.name,
        r.group,
        r.symptomCategory,
        r.noteForMechanic,
        ...(r.tags || []),
        ...(r.laborItems || []).map((li) => li.name),
        ...(r.partItems || []).map((pi) => pi.name)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(searchText)) {
        return false;
      }
    }

    return true;
  });

  // เรียงตาม group + ชื่อ
  filteredRecipes.sort((a, b) => {
    const ga = (a.group || "").localeCompare(b.group || "");
    if (ga !== 0) return ga;
    return (a.name || "").localeCompare(b.name || "");
  });

  if (!filteredRecipes.find((r) => r.id === selectedRecipeId)) {
    selectedRecipeId = filteredRecipes[0]?.id || null;
  }

  renderRecipeList();
  renderRecipeDetail();
}

function clearRepairFilters() {
  if (searchInput) searchInput.value = "";
  if (groupSelect) groupSelect.value = "all";
  if (symptomSelect) symptomSelect.value = "all";
  if (favoritesOnlyCheckbox) favoritesOnlyCheckbox.checked = false;
  applyRepairFilters();
}

// ---------- Render list (left) ----------

function renderRecipeList() {
  if (!listContainer) return;

  listContainer.innerHTML = "";

  if (!filteredRecipes.length) {
    const div = document.createElement("div");
    div.className = "bm-placeholder";
    div.innerHTML = `
      ยังไม่พบสูตรซ่อมที่ตรงกับเงื่อนไข
      <br>
      ลองล้างตัวกรอง หรือค้นหาด้วยคำอื่นอีกครั้ง
    `;
    listContainer.appendChild(div);
    return;
  }

  filteredRecipes.forEach((r) => {
    const card = document.createElement("div");
    card.className = "bm-card mb-2 bm-recipe-card";
    card.dataset.recipeId = r.id || "";

    const isSelected = r.id === selectedRecipeId;
    if (isSelected) {
      card.style.borderColor = "rgba(19, 179, 139, 0.7)";
      card.style.boxShadow = "0 0 0 1px rgba(19, 179, 139, 0.5)";
    }

    const tags = (r.tags || []).join(" • ");
    const laborCount = (r.laborItems || []).length;
    const partsCount = (r.partItems || []).length;

    const estTime = formatMinutes(r.estimatedMinutes);
    const isFavorite = !!r.autoPOSTemplate;

    card.innerHTML = `
      <div class="bm-card-body">
        <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
          <div>
            <div style="font-size:0.84rem;font-weight:600;" class="bm-text-ellipsis" title="${r.name || ""}">
              ${r.name || "-"}
            </div>
            <div style="font-size:0.74rem;color:#6b7280;">
              ${r.group || "ไม่ระบุกลุ่ม"} • ${r.symptomCategory || "ไม่ระบุอาการ"}
            </div>
          </div>
          <div style="text-align:right;">
            <span class="bm-pill ${isFavorite ? "bm-pill-primary" : "bm-pill-soft"}" style="font-size:0.7rem;">
              ใช้เปิดบิล: ${isFavorite ? "บ่อย" : "บางครั้ง"}
            </span>
            <div style="font-size:0.7rem;color:#6b7280;margin-top:2px;">
              เวลาประมาณ: ${estTime}
            </div>
          </div>
        </div>
        <div style="font-size:0.74rem;color:#6b7280;">
          ค่าแรง ${laborCount} รายการ • อะไหล่ ${partsCount} รายการ
        </div>
        <div style="font-size:0.72rem;color:#6b7280;margin-top:4px;">
          ${
            tags
              ? `<span class="bm-tag"><i class="bi bi-tools"></i>${tags}</span>`
              : `<span class="bm-text-muted">ยังไม่มีแท็กพิเศษ</span>`
          }
        </div>
      </div>
    `;

    listContainer.appendChild(card);
  });
}

// ---------- Render detail (right top) ----------

function renderRecipeDetail() {
  if (!detailContainer) return;

  const recipe = filteredRecipes.find((r) => r.id === selectedRecipeId);
  if (!recipe) {
    detailContainer.innerHTML = `
      <div style="font-size:0.8rem;color:#9ca3af;">
        เลือกสูตรซ่อมจากด้านซ้ายเพื่อดูรายละเอียด และเตรียมรายการไปใช้ตอนเปิดบิล
      </div>
    `;
    if (posTemplateTextarea) {
      posTemplateTextarea.value = "";
    }
    return;
  }

  const tags = (recipe.tags || []).join(" • ");
  const estTime = formatMinutes(recipe.estimatedMinutes);
  const isFavorite = !!recipe.autoPOSTemplate;

  const laborRows = (recipe.laborItems || [])
    .map((li) => {
      const priceText = formatCurrencyTHB(li.price || 0);
      return `<tr>
        <td style="font-size:0.78rem;">${li.name || "-"}</td>
        <td style="text-align:right;font-size:0.78rem;">${priceText}</td>
      </tr>`;
    })
    .join("");

  const partRows = (recipe.partItems || [])
    .map((pi) => {
      const stock = findStockByCode(pi.code);
      const name = pi.name || stock?.name || "-";
      const qty = pi.qty && pi.qty > 0 ? pi.qty : 1;
      const price = stock ? stock.salePrice : 0;
      const priceText = price ? formatCurrencyTHB(price) : "-";
      const codeText = pi.code || stock?.code || "";
      return `<tr>
        <td style="font-size:0.78rem;">
          ${name}
          ${
            codeText
              ? `<div style="font-size:0.7rem;color:#6b7280;">รหัส: ${codeText}</div>`
              : ""
          }
        </td>
        <td style="text-align:right;font-size:0.78rem;">${qty}</td>
        <td style="text-align:right;font-size:0.78rem;">${priceText}</td>
      </tr>`;
    })
    .join("");

  detailContainer.innerHTML = `
    <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
      <div>
        <div style="font-size:0.9rem;font-weight:700;">
          ${recipe.name || "-"}
        </div>
        <div style="font-size:0.78rem;color:#6b7280;">
          กลุ่มงาน: ${recipe.group || "ไม่ระบุกลุ่ม"} • ระบบ/อาการ: ${
    recipe.symptomCategory || "ไม่ระบุอาการ"
  }
        </div>
        <div style="font-size:0.76rem;color:#6b7280;margin-top:2px;">
          เวลาประมาณ: ${estTime}
        </div>
      </div>
      <div style="text-align:right;">
        <span class="bm-pill ${isFavorite ? "bm-pill-primary" : "bm-pill-soft"}" style="font-size:0.7rem;">
          ใช้สร้างบิลอัตโนมัติ: ${isFavorite ? "เปิดใช้" : "ปิดอยู่"}
        </span>
        ${
          tags
            ? `<div style="font-size:0.74rem;color:#4b5563;margin-top:4px;">
                แท็ก: ${tags}
              </div>`
            : ""
        }
      </div>
    </div>

    <div class="row g-2 g-md-3">
      <div class="col-12 col-md-6">
        <div class="bm-subpanel">
          <div style="font-size:0.8rem;font-weight:600;margin-bottom:4px;">
            รายการค่าแรง
          </div>
          ${
            laborRows
              ? `<div class="table-responsive">
                  <table class="bm-table bm-table-sm">
                    <thead>
                      <tr>
                        <th>รายละเอียดงาน</th>
                        <th style="text-align:right;">ราคาค่าแรง</th>
                      </tr>
                    </thead>
                    <tbody>${laborRows}</tbody>
                  </table>
                </div>`
              : `<div class="bm-text-muted" style="font-size:0.78rem;">
                  สูตรนี้ยังไม่ได้กำหนดรายการค่าแรง
                </div>`
          }
        </div>
      </div>
      <div class="col-12 col-md-6">
        <div class="bm-subpanel">
          <div style="font-size:0.8rem;font-weight:600;margin-bottom:4px;">
            รายการอะไหล่ที่ใช้บ่อยกับสูตรนี้
          </div>
          ${
            partRows
              ? `<div class="table-responsive">
                  <table class="bm-table bm-table-sm">
                    <thead>
                      <tr>
                        <th>อะไหล่</th>
                        <th style="text-align:right;">จำนวน</th>
                        <th style="text-align:right;">ราคาต่อหน่วย (อ้างอิง)</th>
                      </tr>
                    </thead>
                    <tbody>${partRows}</tbody>
                  </table>
                </div>`
              : `<div class="bm-text-muted" style="font-size:0.78rem;">
                  สูตรนี้ยังไม่ได้ผูกกับอะไหล่เฉพาะ สามารถเติมเองภายหลังได้
                </div>`
          }
        </div>
      </div>
    </div>

    ${
      recipe.noteForMechanic
        ? `<div class="bm-subpanel mt-2" style="font-size:0.8rem;">
            <div style="font-weight:600;margin-bottom:2px;">
              หมายเหตุสำหรับช่าง
            </div>
            <div style="color:#4b5563;">${recipe.noteForMechanic}</div>
          </div>`
        : ""
    }

    <div class="d-flex justify-content-end mt-2">
      <button type="button" class="bm-btn-outline-soft" id="bm-repair-use-for-pos">
        <i class="bi bi-receipt-cutoff"></i>
        ใช้สูตรนี้เตรียมเปิดบิล
      </button>
    </div>
  `;

  // ปุ่ม "ใช้สูตรนี้เตรียมเปิดบิล"
  const useBtn = detailContainer.querySelector("#bm-repair-use-for-pos");
  if (useBtn) {
    useBtn.addEventListener("click", () => {
      buildPosTemplateFromRecipe(recipe);
    });
  }

  // อัปเดต highlight ใน list
  if (listContainer) {
    const cards = listContainer.querySelectorAll(".bm-recipe-card");
    cards.forEach((card) => {
      const id = card.dataset.recipeId;
      if (id === recipe.id) {
        card.style.borderColor = "rgba(19, 179, 139, 0.7)";
        card.style.boxShadow = "0 0 0 1px rgba(19, 179, 139, 0.5)";
      } else {
        card.style.borderColor = "rgba(229, 231, 235, 0.9)";
        card.style.boxShadow = "";
      }
    });
  }
}

// ---------- POS template builder (ข้อความไว้ก๊อปไปหน้าเปิดบิล) ----------

function buildPosTemplateFromRecipe(recipe) {
  if (!posTemplateTextarea || !recipe) return;

  const lines = [];

  lines.push(`สูตรซ่อม: ${recipe.name || "-"}`);
  if (recipe.group || recipe.symptomCategory) {
    lines.push(
      `กลุ่มงาน: ${recipe.group || "-"} | ระบบ/อาการ: ${
        recipe.symptomCategory || "-"
      }`
    );
  }
  if (recipe.estimatedMinutes) {
    lines.push(`เวลาประมาณ: ${formatMinutes(recipe.estimatedMinutes)}`);
  }

  lines.push("");
  lines.push("รายการค่าแรง:");
  if (recipe.laborItems && recipe.laborItems.length) {
    recipe.laborItems.forEach((li, idx) => {
      const price = formatCurrencyTHB(li.price || 0);
      lines.push(`${idx + 1}. ${li.name || "-"} (${price})`);
    });
  } else {
    lines.push("- ยังไม่ได้ระบุรายการค่าแรง");
  }

  lines.push("");
  lines.push("รายการอะไหล่:");
  if (recipe.partItems && recipe.partItems.length) {
    recipe.partItems.forEach((pi, idx) => {
      const stock = findStockByCode(pi.code);
      const name = pi.name || stock?.name || "-";
      const qty = pi.qty && pi.qty > 0 ? pi.qty : 1;
      const price = stock ? formatCurrencyTHB(stock.salePrice) : "ไม่ระบุราคา";
      const codeText = pi.code || stock?.code || "";
      const extra = codeText ? ` [รหัส: ${codeText}]` : "";
      lines.push(
        `${idx + 1}. ${name}${extra} x ${qty} (${price}/หน่วย อ้างอิงจากสต็อก)`
      );
    });
  } else {
    lines.push("- ยังไม่ได้ระบุรายการอะไหล่");
  }

  if (recipe.noteForMechanic) {
    lines.push("");
    lines.push("หมายเหตุสำหรับช่าง/หน้าร้าน:");
    lines.push(recipe.noteForMechanic);
  }

  posTemplateTextarea.value = lines.join("\n");
  posTemplateTextarea.focus();
  posTemplateTextarea.select();
}

// ---------- Events ----------

function handleListClick(event) {
  const card = event.target.closest(".bm-recipe-card");
  if (!card) return;
  const id = card.dataset.recipeId;
  if (!id) return;

  selectedRecipeId = id;
  renderRecipeDetail();
}

function attachRepairEvents() {
  if (searchInput) {
    searchInput.addEventListener("input", applyRepairFilters);
  }
  if (groupSelect) {
    groupSelect.addEventListener("change", applyRepairFilters);
  }
  if (symptomSelect) {
    symptomSelect.addEventListener("change", applyRepairFilters);
  }
  if (favoritesOnlyCheckbox) {
    favoritesOnlyCheckbox.addEventListener("change", applyRepairFilters);
  }
  if (clearFilterBtn) {
    clearFilterBtn.addEventListener("click", clearRepairFilters);
  }
  if (listContainer) {
    listContainer.addEventListener("click", handleListClick);
  }

  if (copyPosTemplateBtn && posTemplateTextarea) {
    copyPosTemplateBtn.addEventListener("click", async () => {
      const text = posTemplateTextarea.value || "";
      if (!text.trim()) {
        alert("ยังไม่มีข้อความสำหรับใช้ในบิล กรุณาเลือกสูตรซ่อมและกดปุ่ม \"ใช้สูตรนี้เตรียมเปิดบิล\" ก่อน");
        return;
      }

      try {
        await navigator.clipboard.writeText(text);
        alert("คัดลอกข้อความไปยังคลิปบอร์ดแล้ว นำไปวางที่หน้า \"เปิดบิล\" ได้เลย");
      } catch (err) {
        console.warn("Clipboard error:", err);
        alert("เบราว์เซอร์ไม่อนุญาตให้คัดลอกอัตโนมัติ คุณสามารถกดคัดลอกเองจากการเลือกข้อความได้");
      }
    });
  }
}

// ---------- Cache DOM refs ----------

function cacheDomRefs() {
  searchInput = $("#bm-repair-search");
  groupSelect = $("#bm-repair-group-filter");
  symptomSelect = $("#bm-repair-symptom-filter");
  favoritesOnlyCheckbox = $("#bm-repair-favorites-only");
  clearFilterBtn = $("#bm-repair-clear-filter");

  listContainer = $("#bm-repair-list");
  detailContainer = $("#bm-repair-detail");
  posTemplateTextarea = $("#bm-repair-pos-template");
  copyPosTemplateBtn = $("#bm-repair-copy-pos-template");
}

// ---------- Init ----------

function initRepairKnowledgePage() {
  const section = $("#section-repair-knowledge");
  if (!section) return;

  const cardBody = section.querySelector(".bm-card-body");
  if (!cardBody) return;

  buildRepairLayout(cardBody);
  cacheDomRefs();
  populateFilterOptions();
  applyRepairFilters();
  attachRepairEvents();
}

document.addEventListener("DOMContentLoaded", initRepairKnowledgePage);