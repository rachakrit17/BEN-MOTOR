// js/reports.js
(function () {
  // ---------------------------
  // Helpers
  // ---------------------------
  function safeParseJSON(str, fallback) {
    try {
      if (!str) return fallback;
      const v = JSON.parse(str);
      return Array.isArray(v) ? v : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function parseDateLike(val) {
    if (!val && val !== 0) return null;
    if (val instanceof Date) return val;

    if (typeof val === "number") {
      // assume timestamp (ms or s)
      if (String(val).length <= 10) {
        return new Date(val * 1000);
      }
      return new Date(val);
    }

    if (typeof val === "string") {
      const trimmed = val.trim();
      if (!trimmed) return null;
      // numeric string timestamp
      if (/^\d+$/.test(trimmed)) {
        if (trimmed.length <= 10) {
          return new Date(parseInt(trimmed, 10) * 1000);
        }
        return new Date(parseInt(trimmed, 10));
      }
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) return d;
    }

    return null;
  }

  function pickFirstDate(obj, keys) {
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        const d = parseDateLike(obj[k]);
        if (d) return d;
      }
    }
    return null;
  }

  function pickNumber(obj, keys, defaultValue) {
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        const v = obj[k];
        if (typeof v === "number" && !isNaN(v)) return v;
        if (typeof v === "string") {
          const n = Number(v.replace(/,/g, ""));
          if (!isNaN(n)) return n;
        }
      }
    }
    return defaultValue;
  }

  function inRange(date, fromDate, toDate) {
    if (!date) return false;
    const t = date.getTime();
    if (fromDate && t < fromDate.setHours(0, 0, 0, 0)) return false;
    if (toDate && t > toDate.setHours(23, 59, 59, 999)) return false;
    return true;
  }

  function formatMoney(num) {
    const n = Number(num) || 0;
    return n.toLocaleString("th-TH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }) + " บาท";
  }

  function formatInt(num, suffix) {
    const n = Number(num) || 0;
    return (
      n.toLocaleString("th-TH", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }) + (suffix || "")
    );
  }

  function formatDateTimeTH(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return "-";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  }

  function formatDateInput(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getGroupKey(date, groupBy) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return "ไม่ทราบวันที่";
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");

    if (groupBy === "year") return `${yyyy}`;
    if (groupBy === "month") return `${yyyy}-${mm}`;
    // day
    return `${yyyy}-${mm}-${dd}`;
  }

  // ---------------------------
  // Load data from localStorage
  // (โครงสร้างฟิลด์ยืดหยุ่น อ่านแบบ defensive)
  // ---------------------------
  function loadAllRawData() {
    const jobs = safeParseJSON(localStorage.getItem("bm_jobs"), []);
    const vehicles = safeParseJSON(localStorage.getItem("bm_vehicles"), []);
    const stock = safeParseJSON(localStorage.getItem("bm_stockItems"), []);
    const pos = safeParseJSON(localStorage.getItem("bm_posReceipts"), []);
    return { jobs, vehicles, stock, pos };
  }

  // ---------------------------
  // Filtering + Aggregation
  // ---------------------------
  function buildFilteredData(allData, filters) {
    const { fromDate, toDate, dataType, groupBy } = filters;

    const result = {
      jobs: [],
      vehicles: [],
      stock: [],
      pos: [],
      summaryRows: [],
      summaryTotals: {
        totalRecords: 0,
        income: 0,
        cost: 0,
        netProfit: 0,
        jobsCount: 0,
        vehiclesSold: 0,
      },
    };

    const groupMap = new Map(); // key -> aggregate

    function ensureGroup(date) {
      const key = getGroupKey(date, groupBy);
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          income: 0,
          cost: 0,
          netProfit: 0,
          jobsCount: 0,
          vehiclesSold: 0,
        });
      }
      return groupMap.get(key);
    }

    // Jobs
    if (dataType === "all" || dataType === "jobs") {
      for (const job of allData.jobs) {
        const d = pickFirstDate(job, [
          "createdAt",
          "openedAt",
          "dateTime",
          "date",
          "timestamp",
        ]);
        if (!inRange(d, fromDate, toDate)) continue;

        const income = pickNumber(job, ["netTotal", "totalNet", "net", "total"], 0);
        const cost = pickNumber(job, ["costTotal", "totalCost", "partsCost"], 0);

        result.jobs.push({
          raw: job,
          date: d,
          income,
          cost,
        });

        const g = ensureGroup(d || fromDate || toDate || new Date());
        g.income += income;
        g.cost += cost;
        g.netProfit = g.income - g.cost;
        g.jobsCount += 1;

        result.summaryTotals.totalRecords += 1;
        result.summaryTotals.income += income;
        result.summaryTotals.cost += cost;
        result.summaryTotals.jobsCount += 1;
      }
    }

    // Vehicles
    if (dataType === "all" || dataType === "vehicles") {
      for (const v of allData.vehicles) {
        const buyDate = pickFirstDate(v, ["buyDate", "createdAt", "date"]);
        const sellDate = pickFirstDate(v, ["soldAt", "saleDate", "closedAt"]);
        const mainDate = sellDate || buyDate;
        if (!inRange(mainDate, fromDate, toDate)) continue;

        const buyPrice = pickNumber(v, ["buyPrice", "purchasePrice"], 0);
        const salePrice = pickNumber(v, ["salePrice", "sellPrice"], 0);
        const repairCost = pickNumber(v, ["repairCost", "fixCost"], 0);
        const cost = buyPrice + repairCost;
        const profit = salePrice - cost;

        result.vehicles.push({
          raw: v,
          buyDate,
          sellDate,
          income: salePrice,
          cost,
          profit,
        });

        const g = ensureGroup(mainDate || fromDate || toDate || new Date());
        g.income += salePrice;
        g.cost += cost;
        g.netProfit = g.income - g.cost;
        if (salePrice > 0) {
          g.vehiclesSold += 1;
          result.summaryTotals.vehiclesSold += 1;
        }

        result.summaryTotals.totalRecords += 1;
        result.summaryTotals.income += salePrice;
        result.summaryTotals.cost += cost;
      }
    }

    // POS receipts
    if (dataType === "all" || dataType === "pos") {
      for (const r of allData.pos) {
        const d = pickFirstDate(r, ["createdAt", "dateTime", "date", "timestamp"]);
        if (!inRange(d, fromDate, toDate)) continue;

        const income = pickNumber(r, ["netTotal", "total", "grandTotal"], 0);
        result.pos.push({
          raw: r,
          date: d,
          income,
        });

        const g = ensureGroup(d || fromDate || toDate || new Date());
        g.income += income;
        g.netProfit = g.income - g.cost;

        result.summaryTotals.totalRecords += 1;
        result.summaryTotals.income += income;
      }
    }

    // Stock (มูลค่าคงเหลือ ใช้ข้อมูลล่าสุด ไม่เน้นช่วงเวลา)
    if (dataType === "all" || dataType === "stock") {
      for (const s of allData.stock) {
        const qty = pickNumber(s, ["qty", "quantity", "stockQty"], 0);
        const cost = pickNumber(s, ["cost", "costPrice"], 0);
        const value = qty * cost;
        result.stock.push({
          raw: s,
          qty,
          cost,
          value,
        });
        // ไม่ดันเข้า summaryTotals.income/cost เพราะเป็นมูลค่าคงเหลือ
      }
    }

    // สรุปแต่ละช่วงเวลา
    result.summaryRows = Array.from(groupMap.values()).sort((a, b) =>
      a.key.localeCompare(b.key)
    );
    result.summaryTotals.netProfit =
      result.summaryTotals.income - result.summaryTotals.cost;

    return result;
  }

  // ---------------------------
  // Rendering
  // ---------------------------
  function clearTbody(id) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  }

  function renderSummaryCards(agg) {
    const t = agg.summaryTotals;

    const elTotalRecords = document.getElementById("summaryTotalRecords");
    const elTotalIncome = document.getElementById("summaryTotalIncome");
    const elTotalCost = document.getElementById("summaryTotalCost");
    const elNetProfit = document.getElementById("summaryNetProfit");
    const elJobsCount = document.getElementById("summaryJobsCount");
    const elVehiclesSold = document.getElementById("summaryVehiclesSold");

    if (elTotalRecords)
      elTotalRecords.textContent = formatInt(t.totalRecords, " รายการ");
    if (elTotalIncome) elTotalIncome.textContent = formatMoney(t.income);
    if (elTotalCost) elTotalCost.textContent = formatMoney(t.cost);
    if (elNetProfit) elNetProfit.textContent = formatMoney(t.netProfit);
    if (elJobsCount) elJobsCount.textContent = formatInt(t.jobsCount, " งาน");
    if (elVehiclesSold)
      elVehiclesSold.textContent = formatInt(t.vehiclesSold, " คัน");
  }

  function renderSummaryTable(agg) {
    const tbody = document.getElementById("summaryTableBody");
    const emptyState = document.getElementById("summaryTableEmpty");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!agg.summaryRows.length) {
      if (emptyState) emptyState.classList.remove("d-none");
      return;
    }
    if (emptyState) emptyState.classList.add("d-none");

    for (const row of agg.summaryRows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.key}</td>
        <td class="text-end">${formatMoney(row.income)}</td>
        <td class="text-end">${formatMoney(row.cost)}</td>
        <td class="text-end">${formatMoney(row.netProfit)}</td>
        <td class="text-end">${formatInt(row.jobsCount, "")}</td>
        <td class="text-end">${formatInt(row.vehiclesSold, "")}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  function renderJobsTable(agg) {
    const tbody = document.getElementById("jobsReportBody");
    const emptyState = document.getElementById("jobsReportEmpty");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!agg.jobs.length) {
      if (emptyState) emptyState.classList.remove("d-none");
      return;
    }
    if (emptyState) emptyState.classList.add("d-none");

    for (const j of agg.jobs) {
      const job = j.raw || {};
      const tr = document.createElement("tr");
      const vehicleLabel =
        (job.vehiclePlate || "") +
        (job.vehicleModel ? " / " + job.vehicleModel : "");
      const customerLabel =
        (job.customerName || "") +
        (job.customerPhone ? " / " + job.customerPhone : "");
      const status = job.statusLabel || job.status || "-";
      const note = job.note || job.customerNote || "";

      tr.innerHTML = `
        <td>${formatDateTimeTH(j.date)}</td>
        <td>${vehicleLabel || "-"}</td>
        <td>${customerLabel || "-"}</td>
        <td class="text-end">${formatMoney(j.income)}</td>
        <td class="text-center">${status}</td>
        <td>${note}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  function renderVehiclesTable(agg) {
    const tbody = document.getElementById("vehiclesReportBody");
    const emptyState = document.getElementById("vehiclesReportEmpty");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!agg.vehicles.length) {
      if (emptyState) emptyState.classList.remove("d-none");
      return;
    }
    if (emptyState) emptyState.classList.add("d-none");

    for (const v of agg.vehicles) {
      const raw = v.raw || {};
      const modelPlate =
        (raw.model || raw.vehicleModel || "") +
        (raw.plate || raw.vehiclePlate
          ? " / " + (raw.plate || raw.vehiclePlate)
          : "");
      const status = raw.statusLabel || raw.status || "-";
      const buyDateText = formatDateTimeTH(v.buyDate || v.sellDate);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${buyDateText}</td>
        <td>${modelPlate || "-"}</td>
        <td class="text-end">${formatMoney(v.cost - pickNumber(raw, ["repairCost", "fixCost"], 0))}</td>
        <td class="text-end">${formatMoney(v.income)}</td>
        <td class="text-end">${formatMoney(v.profit)}</td>
        <td>${status}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  function renderStockTable(agg) {
    const tbody = document.getElementById("stockReportBody");
    const emptyState = document.getElementById("stockReportEmpty");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!agg.stock.length) {
      if (emptyState) emptyState.classList.remove("d-none");
      return;
    }
    if (emptyState) emptyState.classList.add("d-none");

    for (const s of agg.stock) {
      const raw = s.raw || {};
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${raw.name || raw.itemName || "-"}</td>
        <td>${raw.category || "-"}</td>
        <td class="text-end">${formatMoney(s.cost)}</td>
        <td class="text-end">${formatMoney(pickNumber(raw, ["price", "sellPrice"], 0))}</td>
        <td class="text-center">${formatInt(s.qty, "")}</td>
        <td class="text-end">${formatMoney(s.value)}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  function renderPosTable(agg) {
    const tbody = document.getElementById("posReportBody");
    const emptyState = document.getElementById("posReportEmpty");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!agg.pos.length) {
      if (emptyState) emptyState.classList.remove("d-none");
      return;
    }
    if (emptyState) emptyState.classList.add("d-none");

    for (const p of agg.pos) {
      const raw = p.raw || {};
      const tr = document.createElement("tr");
      const billLabel =
        (raw.billNo || raw.invoiceNo || "-") +
        (raw.typeLabel || raw.type ? " / " + (raw.typeLabel || raw.type) : "");
      tr.innerHTML = `
        <td>${formatDateTimeTH(p.date)}</td>
        <td>${billLabel}</td>
        <td>${raw.customerName || "-"}</td>
        <td class="text-end">${formatMoney(p.income)}</td>
        <td>${raw.paymentMethod || "-"}</td>
        <td>${raw.note || ""}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  // ---------------------------
  // Export helpers
  // ---------------------------
  function downloadFile(filename, mime, content) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportJSON(agg, filters) {
    const payload = {
      generatedAt: new Date().toISOString(),
      filters,
      summaryTotals: agg.summaryTotals,
      summaryRows: agg.summaryRows,
      jobs: agg.jobs.map((j) => j.raw),
      vehicles: agg.vehicles.map((v) => v.raw),
      stock: agg.stock.map((s) => s.raw),
      pos: agg.pos.map((p) => p.raw),
    };
    downloadFile(
      "ben-motor-report.json",
      "application/json",
      JSON.stringify(payload, null, 2)
    );
  }

  function exportCSV(agg) {
    const header = [
      "ช่วงเวลา",
      "รายรับ",
      "ต้นทุน",
      "กำไรสุทธิ",
      "จำนวนงานซ่อม",
      "จำนวนรถขายแล้ว",
    ];
    const lines = [header.join(",")];

    for (const row of agg.summaryRows) {
      lines.push(
        [
          `"${row.key}"`,
          row.income,
          row.cost,
          row.netProfit,
          row.jobsCount,
          row.vehiclesSold,
        ].join(",")
      );
    }

    const csv = lines.join("\n");
    downloadFile(
      "ben-motor-report-summary.csv",
      "text/csv;charset=utf-8;",
      csv
    );
  }

  // ---------------------------
  // Date range label & time label
  // ---------------------------
  function updateDateRangeLabel() {
    const from = document.getElementById("filterDateFrom")?.value || "";
    const to = document.getElementById("filterDateTo")?.value || "";
    const label = document.getElementById("reportDateRangeLabel");
    if (!label) return;

    if (!from && !to) {
      label.textContent = "ยังไม่ได้เลือกช่วงเวลา";
    } else if (from && to) {
      label.textContent = "ช่วงวันที่ " + from + " ถึง " + to;
    } else if (from && !to) {
      label.textContent = "ตั้งแต่วันที่ " + from;
    } else if (!from && to) {
      label.textContent = "ถึงวันที่ " + to;
    }
  }

  function updateGeneratedAtLabel() {
    const el = document.getElementById("reportGeneratedAt");
    if (!el) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    el.textContent = `${hh}:${mm}:${ss}`;
  }

  function setQuickRange(type) {
    const today = new Date();
    let from = new Date(today);

    if (type === "today") {
      // from = today
    } else if (type === "7") {
      from.setDate(today.getDate() - 6);
    } else if (type === "30") {
      from.setDate(today.getDate() - 29);
    } else if (type === "month") {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    const fromInput = document.getElementById("filterDateFrom");
    const toInput = document.getElementById("filterDateTo");
    if (fromInput && toInput) {
      fromInput.value = formatDateInput(from);
      toInput.value = formatDateInput(today);
      updateDateRangeLabel();
    }
  }

  // ---------------------------
  // Main report runner
  // ---------------------------
  function runReport(allData) {
    const fromVal = document.getElementById("filterDateFrom")?.value || "";
    const toVal = document.getElementById("filterDateTo")?.value || "";
    const groupBy =
      document.getElementById("filterGroupBy")?.value || "day";
    const dataType =
      document.getElementById("filterDataType")?.value || "all";

    const fromDate = fromVal ? new Date(fromVal + "T00:00:00") : null;
    const toDate = toVal ? new Date(toVal + "T23:59:59") : null;

    const filters = { fromDate, toDate, groupBy, dataType };

    const agg = buildFilteredData(allData, filters);
    renderSummaryCards(agg);
    renderSummaryTable(agg);
    renderJobsTable(agg);
    renderVehiclesTable(agg);
    renderStockTable(agg);
    renderPosTable(agg);
    updateDateRangeLabel();
    updateGeneratedAtLabel();

    return { agg, filters };
  }

  // ---------------------------
  // Init
  // ---------------------------
  document.addEventListener("DOMContentLoaded", function () {
    const allData = loadAllRawData();

    // quick range buttons
    document
      .querySelectorAll("[data-quick-range]")
      .forEach(function (btn) {
        btn.addEventListener("click", function () {
          const type = this.getAttribute("data-quick-range");
          setQuickRange(type);
        });
      });

    const fromInput = document.getElementById("filterDateFrom");
    const toInput = document.getElementById("filterDateTo");
    if (fromInput)
      fromInput.addEventListener("change", updateDateRangeLabel);
    if (toInput)
      toInput.addEventListener("change", updateDateRangeLabel);

    const filterForm = document.getElementById("reportFilterForm");
    let lastAgg = null;
    let lastFilters = null;

    if (filterForm) {
      filterForm.addEventListener("submit", function (e) {
        e.preventDefault();
        const r = runReport(allData);
        lastAgg = r.agg;
        lastFilters = r.filters;
      });
    }

    const resetBtn = document.getElementById("resetFilterBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        setTimeout(function () {
          updateDateRangeLabel();
          const r = runReport(allData);
          lastAgg = r.agg;
          lastFilters = r.filters;
        }, 0);
      });
    }

    // Export buttons
    const exportJsonBtn = document.getElementById("exportJsonBtn");
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener("click", function () {
        if (!lastAgg || !lastFilters) {
          const r = runReport(allData);
          lastAgg = r.agg;
          lastFilters = r.filters;
        }
        exportJSON(lastAgg, lastFilters);
      });
    }

    const exportCsvBtn = document.getElementById("exportCsvBtn");
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener("click", function () {
        if (!lastAgg) {
          const r = runReport(allData);
          lastAgg = r.agg;
          lastFilters = r.filters;
        }
        exportCSV(lastAgg);
      });
    }

    const printBtn = document.getElementById("printReportBtn");
    if (printBtn) {
      printBtn.addEventListener("click", function () {
        window.print();
      });
    }

    // ตั้งค่าเริ่มต้น: quick range = 30 วันล่าสุด
    setQuickRange("30");
    const r = runReport(allData);
    lastAgg = r.agg;
    lastFilters = r.filters;
  });
})();