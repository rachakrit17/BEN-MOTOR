// BEN MOTOR POS – Utilities (format & toast)

// -----------------------------
// Date helpers
// -----------------------------
function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") {
    return value.toDate();
  }
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed);
  }
  return null;
}

const THAI_MONTH_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค."
];

export function formatCurrency(value) {
  const num =
    typeof value === "number"
      ? value
      : Number((value || "").toString().replace(/,/g, ""));
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

export function formatDate(value) {
  const d = toDate(value);
  if (!d) return "-";

  const day = d.getDate();
  const month = THAI_MONTH_SHORT[d.getMonth()] || "";
  const year = d.getFullYear() + 543;

  return `${day} ${month} ${year}`;
}

export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return "-";

  const day = d.getDate();
  const month = THAI_MONTH_SHORT[d.getMonth()] || "";
  const year = d.getFullYear() + 543;

  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");

  return `${day} ${month} ${year} ${hh}:${mm} น.`;
}

// -----------------------------
// Toast helpers (Bootstrap 5)
// -----------------------------
function ensureToastContainer() {
  let container = document.getElementById("bmToastContainer");
  if (container) return container;

  container = document.createElement("div");
  container.id = "bmToastContainer";
  container.className =
    "toast-container position-fixed top-0 end-0 p-3";
  container.style.zIndex = "1080";
  document.body.appendChild(container);
  return container;
}

export function showToast(message, type = "info") {
  if (typeof document === "undefined") {
    console.log("TOAST:", type, message);
    return;
  }

  const container = ensureToastContainer();

  const toastEl = document.createElement("div");
  toastEl.className = "toast align-items-center border-0";
  toastEl.setAttribute("role", "alert");
  toastEl.setAttribute("aria-live", "assertive");
  toastEl.setAttribute("aria-atomic", "true");

  let bgClass = "text-bg-primary";
  if (type === "success") bgClass = "text-bg-success";
  else if (type === "error") bgClass = "text-bg-danger";
  else if (type === "warning") bgClass = "text-bg-warning";
  else if (type === "info") bgClass = "text-bg-primary";

  toastEl.classList.add(bgClass);

  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;

  container.appendChild(toastEl);

  if (window.bootstrap && typeof window.bootstrap.Toast === "function") {
    const toast = new window.bootstrap.Toast(toastEl, {
      delay: 3500
    });
    toast.show();
    toastEl.addEventListener("hidden.bs.toast", () => {
      toastEl.remove();
    });
  } else {
    // ถ้าไม่มี Bootstrap Toast ให้ fallback เป็น alert แล้วลบ element ทิ้ง
    alert(message);
    toastEl.remove();
  }
}