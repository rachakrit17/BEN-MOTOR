// BEN MOTOR POS – Reports & Statistics

import { showToast } from "./utils.js";
import { 
  db, 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  where 
} from "./firebase-init.js";

// -----------------------------
// Helpers
// -----------------------------
function $(id) {
  return document.getElementById(id);
}

// -----------------------------
// Data Loading & Rendering (Placeholder)
// -----------------------------
async function loadReportsData() {
  // ฟังก์ชันนี้จะทำหน้าที่ดึงข้อมูลที่ซับซ้อนมาแสดงในหน้ารายงาน
  // ตัวอย่างเช่น การคำนวณยอดขายรวมของเดือนนี้, กำไรจากรถซื้อ-ขาย ฯลฯ

  showToast("กำลังโหลดข้อมูลสำหรับหน้ารายงาน...", "info");
  
  // Placeholder logic for future development
  try {
    // **ตัวอย่าง:** ดึงข้อมูลรถที่ขายแล้วเพื่อสรุปกำไร
    const vehiclesCol = collection(db, "vehicles");
    const qSold = query(vehiclesCol, where("status", "==", "sold"));
    const snap = await getDocs(qSold);
    
    let totalProfit = 0;
    snap.forEach(docSnap => {
        const data = docSnap.data();
        totalProfit += data.profit || 0;
    });

    // **ตัวอย่าง:** ดึงข้อมูลรถที่ค้างสต็อก
    const qInStock = query(vehiclesCol, where("status", "==", "in-stock"));
    const stockSnap = await getDocs(qInStock);
    
    let totalStockValue = 0;
    stockSnap.forEach(docSnap => {
        const data = docSnap.data();
        // มูลค่ารถค้างสต็อก = ราคาซื้อเข้า + ค่าใช้จ่ายอื่น
        totalStockValue += (data.buyPrice || 0) + (data.extraCost || 0); 
    });
    
    // **ตัวอย่าง:** อัปเดตข้อมูลบนหน้าจอ (ต้องใส่ formatCurrency ด้วย)
    // if ($('reportTotalProfit')) {
    //     $('reportTotalProfit').textContent = formatCurrency(totalProfit) + ' บาท';
    // }
    // if ($('reportTotalStockValue')) {
    //     $('reportTotalStockValue').textContent = formatCurrency(totalStockValue) + ' บาท';
    // }

    showToast(`โหลดข้อมูลรายงานเสร็จสิ้น (พบรถที่ขายแล้ว ${snap.docs.length} คัน)`, "success");

  } catch (error) {
    console.error("โหลดข้อมูลรายงานไม่สำเร็จ:", error);
    showToast("โหลดข้อมูลรายงานไม่สำเร็จ", "error");
  }
}

// -----------------------------
// Init
// -----------------------------
export function initReports() {
  const section = document.querySelector('[data-section="reports"]');
  if (!section) return;

  // เรียกโหลดข้อมูลเมื่อส่วน Reports ถูกเปิดขึ้นมา
  section.addEventListener("data-loaded", loadReportsData);
  
  if (section.classList.contains("active")) {
      loadReportsData();
  }
}
