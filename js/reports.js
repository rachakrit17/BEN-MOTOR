// js/reports.js
// สรุปยอด / รายงาน ของ BEN MOTOR POS
// - ใช้ demoJobs จาก data-mock.js
// - เลือกช่วงเวลา (วันนี้, 7 วัน, 30 วัน, ทั้งหมด, กำหนดเอง)
// - สรุปรายรับ, แยกค่าแรง/อะไหล่, จำนวนงาน, บิลเฉลี่ย, อัตราปิดงาน
// - แสดงสรุปรายวัน + Top งานที่ทำยอดสูงสุด
// - สร้าง "ภารกิจ/แนะนำ" แบบขำ ๆ ให้ช่างดูว่าโฟกัสอะไรดี

import { JOB_STATUS, demoJobs } from "./data-mock.js";

const $ = (selector) => document.querySelector(selector);

// ---------- Helpers ----------

function formatCurrencyTHB(value) {
  const num = Number(value) || 0;
  return num.toLocaleString("th-TH") + " บาท";
}

function formatNumber(value) {
  const num = Number(value) || 0;
  return num.toLocaleString("th-TH");
}

function formatDateShort(isoString) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "2-digit"
  });
}

function formatDateKey(dateObj) {
  if (!(dateObj instanceof Date)) return "";
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateOnlyFromISO(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return null;
  const only = new Date(d);
  only.setHours(0, 0, 0, 0);
  return only;
}

// ---------- Range helpers ----------

function getQuickRange(option) {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  let from = null;
  let to = null;
  let label = "";

  if (option === "today") {
    from = new Date(today);
    to = new Date(today);
    label = "วันนี้";
  } else if (option === "7d") {
    from = new Date(today);
    from.setDate(from.getDate() - 6);
    to = new Date(today);
    label = "ย้อนหลัง 7 วัน";
  } else if (option === "30d") {
    from = new Date(today);
    from.setDate(from.getDate() - 29);
    to = new Date(today);
    label = "ย้อนหลัง 30 วัน";
  } else if (option === "this-month") {
    from = new Date(today.getFullYear(), today.getMonth(), 1);
    to = new Date(today);
    label = "เดือนนี้";
  } else if (option === "all") {
    // หา min/max จาก demoJobs
    let minDate = null;
    let maxDate = null;
    demoJobs.forEach((job) => {
      const d = parseDateOnlyFromISO(job.createdAt);
      if (!d) return;
      if (!minDate || d < minDate) minDate = d;
      if (!maxDate || d > maxDate) maxDate = d;
    });
    if (!minDate || !maxDate) {
      minDate = new Date(today);
      maxDate = new Date(today);
    }
    from = minDate;
    to = maxDate;
    label = "ข้อมูลทั้งหมดในระบบจำลอง";
  } else {
    from = new Date(today);
    to = new Date(today);
    label = "ช่วงเวลา";
  }

  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  return { from, to, label };
}

function filterJobsByRange(fromDate, toDate) {
  if (!fromDate || !toDate) return demoJobs.slice();

  const fromTime = fromDate.getTime();
  const toTime = toDate.getTime();

  return demoJobs.filter((job) => {
    if (!job.createdAt) return false;
    const d = new Date(job.createdAt);
    if (Number.isNaN(d.getTime())) return false;
    const t = d.getTime();
    return t >= fromTime && t <= toTime;
  });
}

// ---------- State ----------

let currentRange = null;

// ---------- DOM refs ----------

let rangeSelect;
let dateFromInput;
let dateToInput;
let applyRangeBtn;

let rangeLabelEl;

let statTotalRevenueEl;
let statLaborEl;
let statPartsEl;
let statJobsEl;
let statAvgBillEl;
let statDoneRateEl;

let dailyListContainer;
let topJobsContainer;
let achievementsContainer;

// ---------- Layout builder ----------

function buildReportsLayout(cardBody) {
  cardBody.innerHTML = `
    <div class="bm-form-section-title">สรุปยอด & รายงานร้านซ่อม</div>
    <div class="bm-form-section-subtitle">
      ดูภาพรวมรายได้, งานที่ปิดแล้ว, งานที่ทำเงินสูงสุด และไอเดียว่า "วันนี้ควรโฟกัสอะไร"
    </div>

    <div class="row g-2 g-md-3 align-items-end mb-2">
      <div class="col-12 col-md-4">
        <label for="bm-reports-range" class="form-label mb-1">ช่วงเวลาที่ต้องการดู</label>
        <select id="bm-reports-range" class="form-select form-select-sm">
          <option value="today">วันนี้</option>
          <option value="7d">ย้อนหลัง 7 วัน</option>
          <option value="30d">ย้อนหลัง 30 วัน</option>
          <option value="this-month">เดือนนี้</option>
          <option value="all">ทั้งหมด (ตามข้อมูลจำลอง)</option>
          <option value="custom">กำหนดเอง</option>
        </select>
      </div>
      <div class="col-6 col-md-3">
        <label for="bm-reports-date-from" class="form-label mb-1">จากวันที่</label>
        <input type="date" id="bm-reports-date-from" class="form-control form-control-sm">
      </div>
      <div class="col-6 col-md-3">
        <label for="bm-reports-date-to" class="form-label mb-1">ถึงวันที่</label>
        <input type="date" id="bm-reports-date-to" class="form-control form-control-sm">
      </div>
      <div class="col-12 col-md-2">
        <button
          type="button"
          id="bm-reports-apply-range"
          class="bm-btn-outline-soft w-100"
          style="margin-top:1.6rem;"
        >
          <i class="bi bi-bar-chart-line"></i>
          ดูรายงาน
        </button>
      </div>
    </div>

    <div class="bm-subpanel mb-2">
      <div class="d-flex justify-content-between align-items-center mb-1">
        <div style="font-size:0.78rem;color:#6b7280;">
          ช่วงข้อมูลที่แสดงตอนนี้
        </div>
        <div id="bm-reports-range-label" style="font-size:0.78rem;color:#111827;font-weight:600;">
          -
        </div>
      </div>
      <div class="row g-2 g-md-3">
        <div class="col-6 col-md-4 col-lg-2">
          <div class="bm-subpanel text-center">
            <div style="font-size:0.7rem;color:#6b7280;">รายรับรวม (แรง+อะไหล่)</div>
            <div id="bm-reports-stat-total" style="font-size:1rem;font-weight:700;">0 บาท</div>
          </div>
        </div>
        <div class="col-6 col-md-4 col-lg-2">
          <div class="bm-subpanel text-center">
            <div style="font-size:0.7rem;color:#6b7280;">ค่าแรงรวม</div>
            <div id="bm-reports-stat-labor" style="font-size:1rem;font-weight:700;">0 บาท</div>
          </div>
        </div>
        <div class="col-6 col-md-4 col-lg-2">
          <div class="bm-subpanel text-center">
            <div style="font-size:0.7rem;color:#6b7280;">อะไหล่รวม</div>
            <div id="bm-reports-stat-parts" style="font-size:1rem;font-weight:700;">0 บาท</div>
          </div>
        </div>
        <div class="col-6 col-md-4 col-lg-2">
          <div class="bm-subpanel text-center">
            <div style="font-size:0.7rem;color:#6b7280;">จำนวนงานทั้งหมด</div>
            <div id="bm-reports-stat-jobs" style="font-size:1rem;font-weight:700;">0</div>
          </div>
        </div>
        <div class="col-6 col-md-4 col-lg-2">
          <div class="bm-subpanel text-center">
            <div style="font-size:0.7rem;color:#6b7280;">บิลเฉลี่ย/คัน</div>
            <div id="bm-reports-stat-avg-bill" style="font-size:1rem;font-weight:700;">0 บาท</div>
          </div>
        </div>
        <div class="col-6 col-md-4 col-lg-2">
          <div class="bm-subpanel text-center">
            <div style="font-size:0.7rem;color:#6b7280;">อัตราปิดงาน</div>
            <div id="bm-reports-stat-done-rate" style="font-size:1rem;font-weight:700;">0%</div>
          </div>
        </div>
      </div>
    </div>

    <div class="row g-2 g-md-3 mb-2">
      <div class="col-12 col-lg-6">
        <div class="bm-subpanel" style="min-height:220px;">
          <div style="font-size:0.8rem;font-weight:600;margin-bottom:4px;">
            ภาพรวมรายวัน (รายรับ & จำนวนงาน)
          </div>
          <div id="bm-reports-daily-list" class="bm-scroll-y-soft" style="max-height:260px;overflow-y:auto;font-size:0.8rem;"></div>
          <div style="font-size:0.72rem;color:#9ca3af;margin-top:4px;">
            * ยังเป็นการสรุปแบบตัวเลขง่าย ๆ ยังไม่ใช่กราฟจริง แต่ช่วยให้เห็นวันไหนเงียบ/วันไหนงานแน่น
          </div>
        </div>
      </div>
      <div class="col-12 col-lg-6">
        <div class="bm-subpanel" style="min-height:220px;">
          <div style="font-size:0.8rem;font-weight:600;margin-bottom:4px;">
            งานที่ทำเงินสูงสุดในช่วงนี้ (Top Jobs)
          </div>
          <div id="bm-reports-top-jobs" class="bm-scroll-y-soft" style="max-height:260px;overflow-y:auto;"></div>
        </div>
      </div>
    </div>

    <div class="bm-subpanel">
      <div style="font-size:0.8rem;font-weight:600;margin-bottom:4px;">
        ภารกิจ / ข้อเสนอแนะสำหรับช่าง (Auto-coach)
      </div>
      <div id="bm-reports-achievements" style="font-size:0.8rem;color:#4b5563;"></div>
    </div>
  `;
}

// ---------- Cache DOM refs ----------

function cacheDomRefs() {
  rangeSelect = $("#bm-reports-range");
  dateFromInput = $("#bm-reports-date-from");
  dateToInput = $("#bm-reports-date-to");
  applyRangeBtn = $("#bm-reports-apply-range");

  rangeLabelEl = $("#bm-reports-range-label");

  statTotalRevenueEl = $("#bm-reports-stat-total");
  statLaborEl = $("#bm-reports-stat-labor");
  statPartsEl = $("#bm-reports-stat-parts");
  statJobsEl = $("#bm-reports-stat-jobs");
  statAvgBillEl = $("#bm-reports-stat-avg-bill");
  statDoneRateEl = $("#bm-reports-stat-done-rate");

  dailyListContainer = $("#bm-reports-daily-list");
  topJobsContainer = $("#bm-reports-top-jobs");
  achievementsContainer = $("#bm-reports-achievements");
}

// ---------- Core reporting logic ----------

function computeAndRenderReports() {
  if (!currentRange) {
    currentRange = getQuickRange("today");
  }

  const jobsInRange = filterJobsByRange(currentRange.from, currentRange.to);

  // รายการที่ถือว่า "สร้างรายได้" = ปิดงานแล้ว หรืออย่างน้อยรอชำระเงิน
  const revenueJobs = jobsInRange.filter(
    (job) =>
      job.status === JOB_STATUS.DONE || job.status === JOB_STATUS.WAIT_PAY
  );

  let laborSum = 0;
  let partsSum = 0;

  revenueJobs.forEach((job) => {
    laborSum += Number(job.totalLabor) || 0;
    partsSum += Number(job.totalParts) || 0;
  });

  const totalRevenue = laborSum + partsSum;
  const jobCount = jobsInRange.length;
  const avgBill =
    revenueJobs.length > 0 ? totalRevenue / revenueJobs.length : 0;

  const doneCount = jobsInRange.filter(
    (job) => job.status === JOB_STATUS.DONE
  ).length;
  const doneRate = jobCount > 0 ? (doneCount / jobCount) * 100 : 0;

  // สรุปตัวเลขบนหัวการ์ด
  if (statTotalRevenueEl)
    statTotalRevenueEl.textContent = formatCurrencyTHB(totalRevenue);
  if (statLaborEl) statLaborEl.textContent = formatCurrencyTHB(laborSum);
  if (statPartsEl) statPartsEl.textContent = formatCurrencyTHB(partsSum);
  if (statJobsEl) statJobsEl.textContent = formatNumber(jobCount);
  if (statAvgBillEl) statAvgBillEl.textContent = formatCurrencyTHB(avgBill);
  if (statDoneRateEl)
    statDoneRateEl.textContent = `${doneRate.toFixed(0)}%`;

  if (rangeLabelEl) {
    const fromKey = formatDateKey(currentRange.from);
    const toKey = formatDateKey(currentRange.to);
    rangeLabelEl.textContent = `${currentRange.label} (${formatDateShort(
      fromKey
    )} - ${formatDateShort(toKey)})`;
  }

  renderDailySummary(jobsInRange);
  renderTopJobs(revenueJobs);
  renderAchievements({
    totalRevenue,
    laborSum,
    partsSum,
    jobCount,
    doneRate,
    revenueJobsCount: revenueJobs.length
  });
}

// ---------- Daily summary ----------

function renderDailySummary(jobsInRange) {
  if (!dailyListContainer) return;

  dailyListContainer.innerHTML = "";

  if (!jobsInRange.length) {
    const div = document.createElement("div");
    div.className = "bm-text-muted";
    div.innerHTML =
      "ยังไม่มีงานซ่อมในช่วงเวลานี้<br>ลองเลือกช่วงที่กว้างขึ้น เช่น 30 วัน หรือทั้งหมด";
    dailyListContainer.appendChild(div);
    return;
  }

  // สรุปตามวันที่
  const map = new Map();
  jobsInRange.forEach((job) => {
    const d = parseDateOnlyFromISO(job.createdAt);
    if (!d) return;
    const key = formatDateKey(d);
    if (!map.has(key)) {
      map.set(key, {
        dateKey: key,
        jobs: 0,
        revenue: 0
      });
    }
    const entry = map.get(key);
    entry.jobs += 1;

    if (
      job.status === JOB_STATUS.DONE ||
      job.status === JOB_STATUS.WAIT_PAY
    ) {
      const total =
        (Number(job.totalLabor) || 0) + (Number(job.totalParts) || 0);
      entry.revenue += total;
    }
  });

  const rows = Array.from(map.values()).sort((a, b) =>
    a.dateKey < b.dateKey ? -1 : 1
  );

  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "d-flex justify-content-between align-items-center mb-1";

    const dateText = formatDateShort(row.dateKey);
    const jobsText = `${formatNumber(row.jobs)} งาน`;
    const revenueText = formatCurrencyTHB(row.revenue);

    item.innerHTML = `
      <div>
        <div style="font-size:0.8rem;font-weight:600;">${dateText}</div>
        <div style="font-size:0.74rem;color:#6b7280;">${jobsText}</div>
      </div>
      <div style="text-align:right;font-size:0.8rem;font-weight:600;">
        ${revenueText}
      </div>
    `;
    dailyListContainer.appendChild(item);
  });
}

// ---------- Top jobs ----------

function renderTopJobs(revenueJobs) {
  if (!topJobsContainer) return;

  topJobsContainer.innerHTML = "";

  if (!revenueJobs.length) {
    const div = document.createElement("div");
    div.className = "bm-text-muted";
    div.style.fontSize = "0.8rem";
    div.innerHTML =
      "ยังไม่มีบิลที่ปิดยอดในช่วงเวลานี้<br>เมื่องานถูกเปลี่ยนสถานะเป็น \"เสร็จแล้ว\" หรือ \"รอชำระเงิน\" จะถูกนำมาสรุปตรงนี้";
    topJobsContainer.appendChild(div);
    return;
  }

  const jobsSorted = revenueJobs
    .slice()
    .sort((a, b) => {
      const ta =
        (Number(a.totalLabor) || 0) + (Number(a.totalParts) || 0);
      const tb =
        (Number(b.totalLabor) || 0) + (Number(b.totalParts) || 0);
      return tb - ta;
    })
    .slice(0, 5);

  jobsSorted.forEach((job, index) => {
    const card = document.createElement("div");
    card.className = "bm-card mb-2";

    const total =
      (Number(job.totalLabor) || 0) + (Number(job.totalParts) || 0);

    const dateText = formatDateShort(job.createdAt);
    const labelStatus =
      job.status === JOB_STATUS.DONE
        ? "เสร็จแล้ว"
        : job.status === JOB_STATUS.WAIT_PAY
        ? "รอชำระเงิน"
        : "สถานะอื่น";

    const plate = job.plate || "-";
    const model = job.vehicleModel || "";
    const customer = job.customerName || "ไม่ระบุชื่อ";

    card.innerHTML = `
      <div class="bm-card-body">
        <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
          <div>
            <div style="font-size:0.8rem;font-weight:600;">
              #${index + 1} งาน ${plate}${model ? " • " + model : ""}
            </div>
            <div style="font-size:0.74rem;color:#6b7280;">
              ลูกค้า: ${customer}
            </div>
            <div style="font-size:0.72rem;color:#9ca3af;">
              วันที่เปิดงาน: ${dateText}
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.78rem;font-weight:600;">
              ${formatCurrencyTHB(total)}
            </div>
            <div style="font-size:0.72rem;color:#6b7280;">
              แรง: ${formatNumber(job.totalLabor || 0)} / อะไหล่: ${formatNumber(
      job.totalParts || 0
    )}
            </div>
            <div style="font-size:0.7rem;color:#6b7280;margin-top:2px;">
              สถานะ: ${labelStatus}
            </div>
          </div>
        </div>
        ${
          job.tags && job.tags.length
            ? `<div style="font-size:0.72rem;color:#6b7280;">
                 <span class="bm-tag"><i class="bi bi-tags"></i>${job.tags
                   .slice(0, 3)
                   .join(" • ")}</span>
               </div>`
            : ""
        }
      </div>
    `;

    topJobsContainer.appendChild(card);
  });
}

// ---------- Achievements / Suggestions ----------

function renderAchievements(stats) {
  if (!achievementsContainer) return;

  achievementsContainer.innerHTML = "";

  const {
    totalRevenue,
    laborSum,
    partsSum,
    jobCount,
    doneRate,
    revenueJobsCount
  } = stats;

  const suggestions = [];

  if (jobCount === 0) {
    suggestions.push(
      "ช่วงเวลานี้ยังไม่มีงานในระบบ ลองโฟกัสด้านการโปรโมตร้าน หรือทักลูกค้าประจำให้เข้ามาเช็กสภาพรถก่อนออกทริป"
    );
  } else {
    if (totalRevenue > 3000) {
      suggestions.push(
        "ยอดรวมถือว่าดี ใช้เวลาเงียบ ๆ สักนิด จดสูตรงานที่ทำบ่อย ๆ เพิ่มในเมนู \"แนะนำการซ่อม\" จะช่วยเปิดบิลเร็วขึ้นอีก"
      );
    } else {
      suggestions.push(
        "ยอดรวมยังไม่สูงมาก ลองจับคู่บริการ เช่น \"เปลี่ยนน้ำมันเครื่อง + เช็กระบบเบรก\" แล้วเสนอเป็นแพ็กเกจเพิ่มให้ลูกค้า"
      );
    }

    if (doneRate >= 70) {
      suggestions.push(
        `อัตราปิดงานประมาณ ${doneRate.toFixed(
          0
        )}% ถือว่าค่อนข้างดี ลองดูว่ายังมีงานค้างตัวไหนที่คุยลูกค้าแล้วปิดได้เลยบ้าง`
      );
    } else if (doneRate > 0) {
      suggestions.push(
        `อัตราปิดงานตอนนี้ราว ๆ ${doneRate.toFixed(
          0
        )}% อาจมีงานที่ \"รออะไหล่\" หรือ \"รอชำระเงิน\" ค้างอยู่ ลองเข้าไปเช็กในเมนูงานซ่อมเพื่อเคลียร์ให้จบ`
      );
    }

    if (laborSum > partsSum * 1.2) {
      suggestions.push(
        "สัดส่วนค่าแรงมากกว่าอะไหล่ค่อนข้างเยอะ แสดงว่าคุณขาย \"ฝีมือ\" ได้ดี ลองจด Note สูตรการตั้งเครื่อง/เซ็ตช่วงล่างที่ลูกค้าชมบ่อย ๆ เก็บไว้เป็นจุดขาย"
      );
    } else if (partsSum > laborSum * 1.5) {
      suggestions.push(
        "สัดส่วนรายได้จากอะไหล่สูงกว่าค่าแรงมาก ลองดูว่ามีงานไหนที่สามารถเพิ่มบริการตรวจเช็ก/เซ็ตค่าพิเศษ เพื่อให้ค่าแรงสมดุลมากขึ้น"
      );
    }

    if (revenueJobsCount >= 3) {
      suggestions.push(
        "มีหลายบิลที่ปิดยอดเรียบร้อยแล้ว ลองเลือก 1-2 งานที่ทำออกมาดีเป็นพิเศษ แล้วถ่ายรูป/เก็บ Before-After ไว้ใช้ทำคอนเทนต์โปรโมตร้านภายหลัง"
      );
    }
  }

  if (!suggestions.length) {
    suggestions.push(
      "ยังไม่มีข้อมูลเพียงพอสำหรับแนะนำ ลองเพิ่มงานซ่อมลงในระบบอีกสักหน่อย แล้วกลับมาดูรายงานอีกครั้ง"
    );
  }

  const ul = document.createElement("ul");
  ul.style.paddingLeft = "1.1rem";
  ul.style.marginBottom = "0";

  suggestions.forEach((text) => {
    const li = document.createElement("li");
    li.style.marginBottom = "2px";
    li.textContent = text;
    ul.appendChild(li);
  });

  achievementsContainer.appendChild(ul);
}

// ---------- Events ----------

function onApplyRange() {
  const selected = rangeSelect ? rangeSelect.value : "today";

  if (selected === "custom") {
    const fromVal = dateFromInput?.value || "";
    const toVal = dateToInput?.value || "";

    if (!fromVal || !toVal) {
      alert("กรุณาเลือกทั้งวันที่เริ่มต้นและวันที่สิ้นสุดก่อน");
      return;
    }

    const from = new Date(fromVal + "T00:00:00");
    const to = new Date(toVal + "T23:59:59");
    if (from > to) {
      alert("วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด");
      return;
    }

    currentRange = {
      from,
      to,
      label: "ช่วงกำหนดเอง"
    };
  } else {
    currentRange = getQuickRange(selected);

    // อัปเดต date input ให้ตรงกับ quick range (แค่แสดงให้เห็น)
    if (dateFromInput && dateToInput) {
      const fromKey = formatDateKey(currentRange.from);
      const toKey = formatDateKey(currentRange.to);
      dateFromInput.value = fromKey;
      dateToInput.value = toKey;
    }
  }

  computeAndRenderReports();
}

function attachEvents() {
  if (applyRangeBtn) {
    applyRangeBtn.addEventListener("click", onApplyRange);
  }
  if (rangeSelect) {
    rangeSelect.addEventListener("change", () => {
      const selected = rangeSelect.value;
      const isCustom = selected === "custom";
      if (dateFromInput) dateFromInput.disabled = !isCustom;
      if (dateToInput) dateToInput.disabled = !isCustom;
    });
  }
}

// ---------- Init ----------

function initReportsPage() {
  const section = $("#section-reports");
  if (!section) return;

  const cardBody = section.querySelector(".bm-card-body");
  if (!cardBody) return;

  buildReportsLayout(cardBody);
  cacheDomRefs();
  attachEvents();

  // เริ่มต้นที่ "วันนี้"
  currentRange = getQuickRange("today");
  if (dateFromInput && dateToInput) {
    const fromKey = formatDateKey(currentRange.from);
    const toKey = formatDateKey(currentRange.to);
    dateFromInput.value = fromKey;
    dateToInput.value = toKey;
    dateFromInput.disabled = true;
    dateToInput.disabled = true;
  }

  computeAndRenderReports();
}

document.addEventListener("DOMContentLoaded", initReportsPage);