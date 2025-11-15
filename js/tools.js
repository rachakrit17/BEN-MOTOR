// js/tools.js
// เครื่องมือช่าง / เครื่องคิดเลขเล็ก ๆ สำหรับ BEN MOTOR POS
// - คำนวณกำไรต่อบิล (แรง + อะไหล่ + ต้นทุนอื่น ๆ)
// - เครื่องคิดเลขอัตราทดสเตอร์ (เทียบกับชุดเดิมว่าดีดหรือยืดขึ้นเท่าไหร่)
// - คำนวณจำนวนงานต่อวัน ที่ต้องทำให้ถึงเป้ารายได้ต่อเดือน
// ทั้งหมดทำงานในเครื่อง (ไม่เชื่อม Firebase) ใช้สำหรับช่วยคิดหน้างานให้ไวขึ้น

const $ = (selector) => document.querySelector(selector);

// ---------- Helpers ----------

function toNumber(value, fallback = 0) {
  const n = parseFloat(String(value).replace(/,/g, "").trim());
  if (Number.isNaN(n)) return fallback;
  return n;
}

function formatCurrencyTHB(value) {
  const num = Number(value) || 0;
  return num.toLocaleString("th-TH") + " บาท";
}

function formatNumber(value) {
  const num = Number(value) || 0;
  return num.toLocaleString("th-TH");
}

// ---------- Layout builder ----------

function buildToolsLayout(cardBody) {
  cardBody.innerHTML = `
    <div class="bm-form-section-title">เครื่องมือช่าง & เครื่องคิดเลข BEN MOTOR</div>
    <div class="bm-form-section-subtitle">
      รวมเครื่องคิดเลขที่ใช้บ่อยหน้างาน ช่วยตัดสินใจเรื่องราคา / สเตอร์ / เป้ารายวันได้ไวขึ้น
    </div>

    <div class="row g-2 g-md-3 mb-2">
      <!-- เครื่องคิดเลขกำไรต่อบิล -->
      <div class="col-12 col-lg-6">
        <div class="bm-subpanel h-100">
          <div class="bm-form-section-title" style="font-size:0.86rem;">คำนวณกำไรต่อบิล (งานเดียวจบ)</div>
          <div class="bm-form-section-subtitle">
            เอาไว้คร่าว ๆ ว่า บิลนี้เรากำไรประมาณเท่าไหร่ ควรตั้งราคายังไงไม่ให้ขาดทุน
          </div>

          <div class="row g-2 bm-form-grid-gap mt-1">
            <div class="col-6 col-md-6">
              <label for="bm-tools-profit-labor" class="form-label mb-1">ค่าแรงที่คิดกับลูกค้า</label>
              <input type="number" min="0" id="bm-tools-profit-labor" class="form-control form-control-sm" placeholder="เช่น 300">
            </div>
            <div class="col-6 col-md-6">
              <label for="bm-tools-profit-parts-sell" class="form-label mb-1">ราคาอะไหล่ที่ขายลูกค้า (รวม)</label>
              <input type="number" min="0" id="bm-tools-profit-parts-sell" class="form-control form-control-sm" placeholder="เช่น 450">
            </div>
            <div class="col-6 col-md-6">
              <label for="bm-tools-profit-parts-cost" class="form-label mb-1">ต้นทุนอะไหล่จริง (รวม)</label>
              <input type="number" min="0" id="bm-tools-profit-parts-cost" class="form-control form-control-sm" placeholder="เช่น 300">
            </div>
            <div class="col-6 col-md-6">
              <label for="bm-tools-profit-other-cost" class="form-label mb-1">ต้นทุนอื่น ๆ (เช่น น้ำยา, ค่าเดินทาง)</label>
              <input type="number" min="0" id="bm-tools-profit-other-cost" class="form-control form-control-sm" placeholder="เช่น 50">
            </div>
          </div>

          <div class="d-flex justify-content-end mt-2">
            <button type="button" id="bm-tools-profit-calc" class="bm-btn-outline-soft">
              <i class="bi bi-calculator"></i>
              คำนวณกำไรบิลนี้
            </button>
          </div>

          <div class="bm-subpanel mt-2" style="background:rgba(15,23,42,0.02);">
            <div style="font-size:0.78rem;color:#6b7280;margin-bottom:4px;">
              ผลลัพธ์คร่าว ๆ
            </div>
            <div style="font-size:0.8rem;">
              <div class="d-flex justify-content-between">
                <span>รายรับรวมจากลูกค้า</span>
                <strong id="bm-tools-profit-total-revenue">0 บาท</strong>
              </div>
              <div class="d-flex justify-content-between">
                <span>ต้นทุนรวม (อะไหล่ + อื่น ๆ)</span>
                <strong id="bm-tools-profit-total-cost">0 บาท</strong>
              </div>
              <div class="d-flex justify-content-between">
                <span>กำไรต่อบิล (ยังไม่หักค่าเช่าที่ / ค่าแรงตัวเอง)</span>
                <strong id="bm-tools-profit-profit">0 บาท</strong>
              </div>
              <div class="d-flex justify-content-between">
                <span>กำไรคิดเป็น % จากยอดบิล</span>
                <strong id="bm-tools-profit-margin">0%</strong>
              </div>
            </div>
            <div id="bm-tools-profit-note" style="font-size:0.74rem;color:#6b7280;margin-top:4px;">
              กรอกตัวเลขด้านบนแล้วกดคำนวณ ระบบจะช่วยประเมินคร่าว ๆ ว่าบิลนี้กำไรแค่ไหน
            </div>
          </div>
        </div>
      </div>

      <!-- เครื่องคิดเลขอัตราทดสเตอร์ -->
      <div class="col-12 col-lg-6">
        <div class="bm-subpanel h-100">
          <div class="bm-form-section-title" style="font-size:0.86rem;">อัตราทดสเตอร์ (เทียบกับชุดเดิม)</div>
          <div class="bm-form-section-subtitle">
            สำหรับคิดเล่น ๆ ว่าเปลี่ยนสเตอร์แล้ว อัตราทดเปลี่ยนไปเท่าไหร่ แนวโน้มดีดขึ้นหรือลื่นขึ้น
          </div>

          <div class="row g-2 bm-form-grid-gap mt-1">
            <div class="col-6">
              <label for="bm-tools-sprocket-front" class="form-label mb-1">ฟันสเตอร์หน้า (ชุดใหม่)</label>
              <input type="number" min="1" id="bm-tools-sprocket-front" class="form-control form-control-sm" placeholder="เช่น 14">
            </div>
            <div class="col-6">
              <label for="bm-tools-sprocket-rear" class="form-label mb-1">ฟันสเตอร์หลัง (ชุดใหม่)</label>
              <input type="number" min="1" id="bm-tools-sprocket-rear" class="form-control form-control-sm" placeholder="เช่น 36">
            </div>
            <div class="col-6">
              <label for="bm-tools-sprocket-front-base" class="form-label mb-1">ฟันสเตอร์หน้า (ชุดเดิม)</label>
              <input type="number" min="1" id="bm-tools-sprocket-front-base" class="form-control form-control-sm" placeholder="เช่น 14">
            </div>
            <div class="col-6">
              <label for="bm-tools-sprocket-rear-base" class="form-label mb-1">ฟันสเตอร์หลัง (ชุดเดิม)</label>
              <input type="number" min="1" id="bm-tools-sprocket-rear-base" class="form-control form-control-sm" placeholder="เช่น 38">
            </div>
          </div>

          <div class="d-flex justify-content-end mt-2">
            <button type="button" id="bm-tools-sprocket-calc" class="bm-btn-outline-soft">
              <i class="bi bi-speedometer2"></i>
              คำนวณอัตราทด
            </button>
          </div>

          <div class="bm-subpanel mt-2" style="background:rgba(15,23,42,0.02);">
            <div style="font-size:0.78rem;color:#6b7280;margin-bottom:4px;">
              ผลลัพธ์โดยประมาณ
            </div>
            <div style="font-size:0.8rem;">
              <div class="d-flex justify-content-between">
                <span>อัตราทดชุดเดิม</span>
                <strong id="bm-tools-sprocket-base-ratio">-</strong>
              </div>
              <div class="d-flex justify-content-between">
                <span>อัตราทดชุดใหม่</span>
                <strong id="bm-tools-sprocket-current-ratio">-</strong>
              </div>
              <div class="d-flex justify-content-between">
                <span>การเปลี่ยนแปลงโดยประมาณ</span>
                <strong id="bm-tools-sprocket-diff">-</strong>
              </div>
            </div>
            <div id="bm-tools-sprocket-comment" style="font-size:0.74rem;color:#6b7280;margin-top:4px;">
              ใช้เทียบแนวโน้ม "ดีด" (ทดชิดขึ้น, แรงบิดดีขึ้น) หรือ "ยืด" (ทดยาวขึ้น, รอบต่ำลง) – เป็นค่าทางทฤษฎีคร่าว ๆ
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- เป้ารายได้ต่อเดือน / งานต่อวัน -->
    <div class="row g-2 g-md-3">
      <div class="col-12 col-lg-7">
        <div class="bm-subpanel h-100">
          <div class="bm-form-section-title" style="font-size:0.86rem;">คำนวณจำนวนงานต่อวันให้ถึงเป้ารายได้</div>
          <div class="bm-form-section-subtitle">
            ลองใส่ค่าเช่าที่, ค่าใช้จ่ายต่อเดือน และเป้าที่อยากได้ เพื่อวางแผนคร่าว ๆ ว่าวันหนึ่งควรทำกี่งาน
          </div>

          <div class="row g-2 bm-form-grid-gap mt-1">
            <div class="col-6 col-md-6">
              <label for="bm-tools-target-monthly-cost" class="form-label mb-1">ค่าใช้จ่ายต่อเดือน (คงที่)</label>
              <input type="number" min="0" id="bm-tools-target-monthly-cost" class="form-control form-control-sm" placeholder="เช่น 15000">
              <div style="font-size:0.72rem;color:#9ca3af;margin-top:2px;">
                เช่น ค่าเช่าที่, ค่าไฟ, ค่าเน็ต, ผ่อนของ ฯลฯ
              </div>
            </div>
            <div class="col-6 col-md-6">
              <label for="bm-tools-target-profit" class="form-label mb-1">กำไรที่อยากได้ต่อเดือน</label>
              <input type="number" min="0" id="bm-tools-target-profit" class="form-control form-control-sm" placeholder="เช่น 20000">
              <div style="font-size:0.72rem;color:#9ca3af;margin-top:2px;">
                ส่วนที่อยากได้เพิ่มหลังหักค่าใช้จ่ายคงที่
              </div>
            </div>
            <div class="col-6 col-md-6">
              <label for="bm-tools-target-avg-bill" class="form-label mb-1">กำไรเฉลี่ย "ต่อบิล" ที่อยากทำให้ได้</label>
              <input type="number" min="0" id="bm-tools-target-avg-bill" class="form-control form-control-sm" placeholder="เช่น 200">
              <div style="font-size:0.72rem;color:#9ca3af;margin-top:2px;">
                เช่น ตั้งใจให้แต่ละบิลกำไรสุทธิราว ๆ 150–300 บาท
              </div>
            </div>
            <div class="col-6 col-md-6">
              <label for="bm-tools-target-working-days" class="form-label mb-1">จำนวนวันที่จะเปิดร้านต่อเดือน</label>
              <input type="number" min="1" max="31" id="bm-tools-target-working-days" class="form-control form-control-sm" placeholder="เช่น 26">
              <div style="font-size:0.72rem;color:#9ca3af;margin-top:2px;">
                เผื่อวันหยุด / วันปิดร้านไว้ด้วย
              </div>
            </div>
          </div>

          <div class="d-flex justify-content-end mt-2">
            <button type="button" id="bm-tools-target-calc" class="bm-btn-outline-soft">
              <i class="bi bi-flag"></i>
              คำนวณเป้าต่อวัน
            </button>
          </div>

          <div class="bm-subpanel mt-2" style="background:rgba(15,23,42,0.02);">
            <div style="font-size:0.78rem;color:#6b7280;margin-bottom:4px;">
              ผลลัพธ์ประมาณการ
            </div>
            <div style="font-size:0.8rem;">
              <div class="d-flex justify-content-between">
                <span>ยอดรวมที่ต้องครอบให้ได้ต่อเดือน</span>
                <strong id="bm-tools-target-total-target">0 บาท</strong>
              </div>
              <div class="d-flex justify-content-between">
                <span>จำนวนงานเฉลี่ยต่อวันที่ควรทำให้ถึงเป้า</span>
                <strong id="bm-tools-target-jobs-per-day">0 งาน/วัน</strong>
              </div>
            </div>
            <div id="bm-tools-target-note" style="font-size:0.74rem;color:#6b7280;margin-top:4px;">
              ใช้เป็นแนวทางคร่าว ๆ ว่า ถ้าอยากได้เท่ากับเงินเดือนประจำ + ค่าเช่าที่ ต้องทำงานเฉลี่ยวันละประมาณกี่คัน
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-5">
        <div class="bm-subpanel h-100">
          <div style="font-size:0.8rem;font-weight:600;margin-bottom:4px;">
            ทิปการใช้งานเครื่องมือ (ไกด์คร่าว ๆ)
          </div>
          <ul style="font-size:0.78rem;color:#4b5563;padding-left:1.05rem;">
            <li style="margin-bottom:4px;">
              ใช้ <strong>เครื่องคิดเลขกำไรต่อบิล</strong> หลังคิดราคาให้ลูกค้า เพื่อเช็กว่าไม่ต่ำเกินไป ถ้ากำไร &lt; 20–25% ลองเพิ่มบริการตรวจเช็กเพิ่มเล็กน้อย หรือขยับค่าแรง
            </li>
            <li style="margin-bottom:4px;">
              ใช้ <strong>เครื่องคิดเลขสเตอร์</strong> เวลาลูกค้าถามว่า "เปลี่ยนสเตอร์ชุดนี้แล้วจะดีดขึ้นแค่ไหน" – ตอบเป็นแนวโน้ม % ให้ดูภาพง่าย ๆ
            </li>
            <li style="margin-bottom:4px;">
              ใช้ <strong>เป้ารายได้ต่อเดือน</strong> วางแผนว่า ถ้าวันนี้งานบาง ลองทักลูกค้าประจำสัก 2–3 คน ให้เข้ามาเช็กระยะ จะช่วยให้ยอดเฉลี่ยไม่หล่น
            </li>
            <li style="margin-bottom:4px;">
              ตัวเลขทั้งหมดเป็น <em>ประมาณการ</em> ใช้ประกอบการตัดสินใจหน้างาน ช่วยให้รู้สึกคุมร้านได้มากขึ้น ไม่ใช่ตัวเลขบัญชีจริง
            </li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

// ---------- DOM refs ----------

let profitLaborInput;
let profitPartsSellInput;
let profitPartsCostInput;
let profitOtherCostInput;
let profitCalcBtn;
let profitTotalRevenueEl;
let profitTotalCostEl;
let profitProfitEl;
let profitMarginEl;
let profitNoteEl;

let sprocketFrontInput;
let sprocketRearInput;
let sprocketFrontBaseInput;
let sprocketRearBaseInput;
let sprocketCalcBtn;
let sprocketBaseRatioEl;
let sprocketCurrentRatioEl;
let sprocketDiffEl;
let sprocketCommentEl;

let targetMonthlyCostInput;
let targetProfitInput;
let targetAvgBillInput;
let targetWorkingDaysInput;
let targetCalcBtn;
let targetTotalTargetEl;
let targetJobsPerDayEl;
let targetNoteEl;

function cacheDomRefsTools() {
  // Profit
  profitLaborInput = $("#bm-tools-profit-labor");
  profitPartsSellInput = $("#bm-tools-profit-parts-sell");
  profitPartsCostInput = $("#bm-tools-profit-parts-cost");
  profitOtherCostInput = $("#bm-tools-profit-other-cost");
  profitCalcBtn = $("#bm-tools-profit-calc");
  profitTotalRevenueEl = $("#bm-tools-profit-total-revenue");
  profitTotalCostEl = $("#bm-tools-profit-total-cost");
  profitProfitEl = $("#bm-tools-profit-profit");
  profitMarginEl = $("#bm-tools-profit-margin");
  profitNoteEl = $("#bm-tools-profit-note");

  // Sprocket
  sprocketFrontInput = $("#bm-tools-sprocket-front");
  sprocketRearInput = $("#bm-tools-sprocket-rear");
  sprocketFrontBaseInput = $("#bm-tools-sprocket-front-base");
  sprocketRearBaseInput = $("#bm-tools-sprocket-rear-base");
  sprocketCalcBtn = $("#bm-tools-sprocket-calc");
  sprocketBaseRatioEl = $("#bm-tools-sprocket-base-ratio");
  sprocketCurrentRatioEl = $("#bm-tools-sprocket-current-ratio");
  sprocketDiffEl = $("#bm-tools-sprocket-diff");
  sprocketCommentEl = $("#bm-tools-sprocket-comment");

  // Target per day
  targetMonthlyCostInput = $("#bm-tools-target-monthly-cost");
  targetProfitInput = $("#bm-tools-target-profit");
  targetAvgBillInput = $("#bm-tools-target-avg-bill");
  targetWorkingDaysInput = $("#bm-tools-target-working-days");
  targetCalcBtn = $("#bm-tools-target-calc");
  targetTotalTargetEl = $("#bm-tools-target-total-target");
  targetJobsPerDayEl = $("#bm-tools-target-jobs-per-day");
  targetNoteEl = $("#bm-tools-target-note");
}

// ---------- Logic: Profit per bill ----------

function calcProfitPerBill() {
  const labor = toNumber(profitLaborInput?.value || 0);
  const partsSell = toNumber(profitPartsSellInput?.value || 0);
  const partsCost = toNumber(profitPartsCostInput?.value || 0);
  const otherCost = toNumber(profitOtherCostInput?.value || 0);

  const revenue = labor + partsSell;
  const totalCost = partsCost + otherCost;
  const profit = revenue - totalCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  if (profitTotalRevenueEl)
    profitTotalRevenueEl.textContent = formatCurrencyTHB(revenue);
  if (profitTotalCostEl)
    profitTotalCostEl.textContent = formatCurrencyTHB(totalCost);
  if (profitProfitEl)
    profitProfitEl.textContent = formatCurrencyTHB(profit);
  if (profitMarginEl)
    profitMarginEl.textContent = `${margin.toFixed(1)}%`;

  if (profitNoteEl) {
    let note = "";
    if (revenue === 0 && totalCost === 0) {
      note =
        "กรอกค่าแรง, ราคาอะไหล่ที่คิดลูกค้า และต้นทุนคร่าว ๆ ระบบจะช่วยประเมินกำไรต่อบิลให้";
    } else if (profit <= 0) {
      note =
        "บิลนี้กำไรติดลบหรือเกือบศูนย์ ลองดูว่าจำเป็นต้องให้ส่วนลดทั้งหมดไหม หรือควรปรับโครงสร้างราคาในอนาคต";
    } else if (margin < 20) {
      note =
        "กำไรต่อบิลต่ำกว่า ~20% ถ้าเป็นงานที่กินเวลามาก อาจพิจารณาขยับค่าแรง หรือจับคู่บริการเพิ่มเล็กน้อยในอนาคต";
    } else if (margin <= 40) {
      note =
        "กำไรต่อบิลอยู่ราว ๆ 20–40% ถือว่าโอเคสำหรับร้านซ่อมทั่วไป ลองเก็บสูตรนี้ไว้ในเมนู \"แนะนำการซ่อม\" สำหรับงานลักษณะคล้าย ๆ กัน";
    } else {
      note =
        "กำไรต่อบิลค่อนข้างดี (>40%) แต่อย่าลืมบาลานซ์กับความรู้สึกลูกค้า ให้รู้สึกว่าคุ้มกับคุณภาพงานและการบริการ";
    }
    profitNoteEl.textContent = note;
  }
}

// ---------- Logic: Sprocket ratio ----------

function calcSprocket() {
  const f = toNumber(sprocketFrontInput?.value || 0);
  const r = toNumber(sprocketRearInput?.value || 0);
  const fb = toNumber(sprocketFrontBaseInput?.value || 0);
  const rb = toNumber(sprocketRearBaseInput?.value || 0);

  if (!f || !r || !fb || !rb) {
    alert("กรุณากรอกฟันสเตอร์หน้า/หลัง ทั้งชุดใหม่และชุดเดิมให้ครบก่อนคำนวณ");
    return;
  }

  // อัตราทด = ฟันหลัง / ฟันหน้า (ยิ่งตัวเลขมาก ยิ่งทดชิด ดีดขึ้น แต่รอบสูง)
  const baseRatio = rb / fb;
  const currentRatio = r / f;
  const diffPercent = ((currentRatio - baseRatio) / baseRatio) * 100;

  const baseText = baseRatio.toFixed(3);
  const currentText = currentRatio.toFixed(3);

  if (sprocketBaseRatioEl) sprocketBaseRatioEl.textContent = baseText;
  if (sprocketCurrentRatioEl) sprocketCurrentRatioEl.textContent = currentText;

  let diffText = "";
  let comment = "";

  if (Math.abs(diffPercent) < 1) {
    diffText = "แทบไม่เปลี่ยน";
    comment =
      "อัตราทดชุดใหม่ใกล้เคียงชุดเดิมมาก ความรู้สึกในการขี่แทบไม่ต่างกัน อาจต่างเล็กน้อยที่รอบเครื่องเท่านั้น";
  } else if (diffPercent > 0) {
    diffText = `ทดชิดขึ้นประมาณ +${diffPercent.toFixed(1)}% (ดีดขึ้น แรงบิดดีขึ้น)`;
    if (diffPercent <= 5) {
      comment =
        "ทดชิดขึ้นเล็กน้อย รถจะมีกำลังต้นดีขึ้นนิดหน่อย รอบสูงขึ้นอีกนิด แต่วิ่งปลายยังโอเค";
    } else if (diffPercent <= 12) {
      comment =
        "ทดชิดขึ้นพอสมควร เน้นออกตัวดี ขึ้นเนินง่าย เหมาะกับขี่ในเมือง/บรรทุก แต่รอบปลายอาจสูงขึ้นและหมดเร็วขึ้น";
    } else {
      comment =
        "ทดชิดขึ้นเยอะมาก เน้นแรงจัด ๆ แต่ปลายอาจหมดไว รอบสูง เสียงเครื่องดังขึ้น เหมาะกับรถสนามหรือเล่นสนุกมากกว่าขี่เดินทางไกล";
    }
  } else {
    const p = Math.abs(diffPercent);
    diffText = `ทดยาวขึ้นประมาณ -${p.toFixed(1)}% (รอบต่ำลง ลื่นขึ้น)`;
    if (p <= 5) {
      comment =
        "ทดยาวขึ้นเล็กน้อย รอบจะตกลงนิดหน่อยเวลาวิ่งคงที่ ช่วยประหยัดน้ำมันขึ้นเล็กน้อย ความรู้สึกแรงต้นหายไปนิดเดียว";
    } else if (p <= 12) {
      comment =
        "ทดยาวพอสมควร รอบตกลงชัดเมื่อวิ่งความเร็วเท่าเดิม เหมาะกับขี่ทางยาว/เดินทางไกล แต่ต้นอาจหน่วงขึ้นเล็กน้อย";
    } else {
      comment =
        "ทดยาวมาก เน้นรอบต่ำเวลาวิ่งทางไกล แต่แรงต้นจะหายเยอะ ออกตัวอาจหน่วง ต้องคุยกับลูกค้าให้เข้าใจสไตล์การใช้งานก่อนเปลี่ยน";
    }
  }

  if (sprocketDiffEl) sprocketDiffEl.textContent = diffText;
  if (sprocketCommentEl) sprocketCommentEl.textContent = comment;
}

// ---------- Logic: Target jobs per day ----------

function calcTargetJobsPerDay() {
  const monthlyCost = toNumber(targetMonthlyCostInput?.value || 0);
  const wantProfit = toNumber(targetProfitInput?.value || 0);
  const avgProfitPerBill = toNumber(targetAvgBillInput?.value || 0);
  let workingDays = toNumber(targetWorkingDaysInput?.value || 0);

  if (!avgProfitPerBill || !workingDays) {
    alert(
      "กรุณากรอกกำไรเฉลี่ยต่อบิล และจำนวนวันที่จะเปิดร้านต่อเดือนให้ครบก่อนคำนวณ"
    );
    return;
  }

  if (workingDays <= 0) {
    workingDays = 26;
  }

  const totalTarget = monthlyCost + wantProfit;
  const jobsNeededTotal =
    avgProfitPerBill > 0 ? totalTarget / avgProfitPerBill : 0;
  const jobsPerDay = jobsNeededTotal / workingDays;

  if (targetTotalTargetEl)
    targetTotalTargetEl.textContent = formatCurrencyTHB(totalTarget);
  if (targetJobsPerDayEl)
    targetJobsPerDayEl.textContent = `${jobsPerDay.toFixed(1)} งาน/วัน`;

  if (targetNoteEl) {
    if (!totalTarget) {
      targetNoteEl.textContent =
        "ลองกรอกค่าใช้จ่ายต่อเดือน + กำไรที่อยากได้ แล้วระบบจะช่วยกะว่าควรทำกำไรเฉลี่ยต่อวันเท่าไหร่";
      return;
    }

    let note = `ถ้าอยากครอบค่าใช้จ่ายประมาณ ${formatCurrencyTHB(
      monthlyCost
    )} + กำไรที่ตั้งใจ ${formatCurrencyTHB(
      wantProfit
    )} ด้วยกำไรเฉลี่ยต่อบิล ${formatCurrencyTHB(
      avgProfitPerBill
    )} คุณควรทำงานให้ได้เฉลี่ยวันละประมาณ ${jobsPerDay.toFixed(
      1
    )} งาน`;

    if (jobsPerDay > 8) {
      note +=
        " (ตัวเลขค่อนข้างสูง อาจต้องเพิ่มกำไรต่อบิล หรือหาวิธีลดค่าใช้จ่ายคงที่ลงเล็กน้อย)";
    } else if (jobsPerDay > 4) {
      note +=
        " (ถือว่าโหดใช้ได้ แต่ยังพอเป็นไปได้ถ้าอยู่ทำทั้งวันและมีลูกค้าประจำเยอะ)";
    } else {
      note +=
        " (ถือว่าค่อนข้างชิว ถ้าเก็บงานเนียน ๆ และรักษาลูกค้าประจำดี ๆ จะไปถึงเป้าไม่ยาก)";
    }

    targetNoteEl.textContent = note;
  }
}

// ---------- Events ----------

function attachToolsEvents() {
  if (profitCalcBtn) {
    profitCalcBtn.addEventListener("click", calcProfitPerBill);
  }

  if (sprocketCalcBtn) {
    sprocketCalcBtn.addEventListener("click", calcSprocket);
  }

  if (targetCalcBtn) {
    targetCalcBtn.addEventListener("click", calcTargetJobsPerDay);
  }

  // ให้คำนวณอัตโนมัติเมื่อกรอกครบ/เปลี่ยนค่า (ไม่ต้องกดปุ่มทุกครั้งก็ได้)
  if (profitLaborInput) {
    [profitLaborInput, profitPartsSellInput, profitPartsCostInput, profitOtherCostInput].forEach(
      (el) => {
        if (!el) return;
        el.addEventListener("input", () => {
          // คำนวณแบบไม่เคร่ง ถ้าไม่มีอะไรกรอกก็ไม่เตือน
          calcProfitPerBill();
        });
      }
    );
  }

  if (sprocketFrontInput) {
    [sprocketFrontInput, sprocketRearInput, sprocketFrontBaseInput, sprocketRearBaseInput].forEach(
      (el) => {
        if (!el) return;
        el.addEventListener("change", () => {
          // ไม่ alert ถ้ายังกรอกไม่ครบ
          const f = toNumber(sprocketFrontInput.value || 0);
          const r = toNumber(sprocketRearInput.value || 0);
          const fb = toNumber(sprocketFrontBaseInput.value || 0);
          const rb = toNumber(sprocketRearBaseInput.value || 0);
          if (f && r && fb && rb) {
            calcSprocket();
          }
        });
      }
    );
  }

  if (targetMonthlyCostInput) {
    [
      targetMonthlyCostInput,
      targetProfitInput,
      targetAvgBillInput,
      targetWorkingDaysInput
    ].forEach((el) => {
      if (!el) return;
      el.addEventListener("input", () => {
        const avg = toNumber(targetAvgBillInput?.value || 0);
        const days = toNumber(targetWorkingDaysInput?.value || 0);
        if (avg > 0 && days > 0) {
          calcTargetJobsPerDay();
        }
      });
    });
  }
}

// ---------- Init ----------

function initToolsPage() {
  const section = document.querySelector("#section-tools");
  if (!section) return;

  const cardBody = section.querySelector(".bm-card-body");
  if (!cardBody) return;

  buildToolsLayout(cardBody);
  cacheDomRefsTools();
  attachToolsEvents();
}

document.addEventListener("DOMContentLoaded", initToolsPage);