// js/data-mock.js
// ชุดข้อมูลจำลองสำหรับ BEN MOTOR POS
// ใช้ทดสอบหน้าแดชบอร์ด, งานซ่อม, สต็อก, ลูกค้า และสูตรซ่อม
// ก่อนเชื่อมกับ Firestore จริงในภายหลัง

// ---------- งานซ่อม (Jobs) ----------

export const JOB_STATUS = {
  QUEUE: "queue",              // รอรับเข้า/รอเริ่มงาน
  IN_PROGRESS: "in-progress",  // กำลังซ่อม
  WAITING_PARTS: "waiting-parts", // รออะไหล่มา
  WAIT_PAY: "wait-pay",        // งานเสร็จ รอลูกค้าชำระเงิน/รับรถ
  DONE: "done"                 // ปิดงานเรียบร้อย
};

export const JOB_PRIORITY = {
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high",
  URGENT: "urgent"
};

export const demoJobs = [
  {
    id: "J-240001",
    plate: "1กข 1234",
    province: "กรุงเทพฯ",
    customerName: "คุณต้น",
    customerPhone: "081-111-2233",
    vehicleModel: "Honda Click 125i",
    vehicleColor: "ขาว-แดง",
    status: JOB_STATUS.IN_PROGRESS,
    priority: JOB_PRIORITY.HIGH,
    createdAt: "2024-11-15T09:10:00+07:00",
    updatedAt: "2024-11-15T10:00:00+07:00",
    dueAt: "2024-11-15T12:00:00+07:00",
    estHours: 2,
    totalLabor: 450,
    totalParts: 620,
    tags: ["น้ำมันเครื่อง", "เช็กระยะ"],
    notes: "ลูกค้าบอกว่าออกทริปบ่อย ขอเช็กโซ่-สเตอร์ให้ด้วย",
    source: "หน้าร้าน",
    isOverdue: false
  },
  {
    id: "J-240002",
    plate: "ขพ 7654",
    province: "ปทุมธานี",
    customerName: "คุณเบิร์ด",
    customerPhone: "089-555-7788",
    vehicleModel: "Yamaha Aerox 155",
    vehicleColor: "ดำ-เหลือง",
    status: JOB_STATUS.WAITING_PARTS,
    priority: JOB_PRIORITY.NORMAL,
    createdAt: "2024-11-14T16:20:00+07:00",
    updatedAt: "2024-11-15T09:15:00+07:00",
    dueAt: "2024-11-16T18:00:00+07:00",
    estHours: 3,
    totalLabor: 650,
    totalParts: 1800,
    tags: ["เปลี่ยนผ้าเบรก", "เปลี่ยนจานเบรก"],
    notes: "จานหน้าเบี้ยว รออะไหล่จากร้านอะไหล่หน้าปากซอย",
    source: "โทรนัด",
    isOverdue: false
  },
  {
    id: "J-240003",
    plate: "2กง 9900",
    province: "นนทบุรี",
    customerName: "คุณนัท",
    customerPhone: "082-333-4499",
    vehicleModel: "Honda Wave 110i",
    vehicleColor: "แดง",
    status: JOB_STATUS.QUEUE,
    priority: JOB_PRIORITY.NORMAL,
    createdAt: "2024-11-15T11:05:00+07:00",
    updatedAt: "2024-11-15T11:05:00+07:00",
    dueAt: null,
    estHours: 1.5,
    totalLabor: 0,
    totalParts: 0,
    tags: ["เช็กรถก่อนขาย"],
    notes: "ลูกค้าจะเอาไปขายฝาก ถ้าทำไม่ทันให้โทรแจ้ง",
    source: "หน้าร้าน",
    isOverdue: false
  },
  {
    id: "J-240004",
    plate: "งท 2222",
    province: "กรุงเทพฯ",
    customerName: "คุณก้อง",
    customerPhone: "086-888-9990",
    vehicleModel: "Kawasaki Kaze ZX",
    vehicleColor: "เขียว-ดำ",
    status: JOB_STATUS.WAIT_PAY,
    priority: JOB_PRIORITY.URGENT,
    createdAt: "2024-11-14T13:40:00+07:00",
    updatedAt: "2024-11-15T09:30:00+07:00",
    dueAt: "2024-11-15T18:00:00+07:00",
    estHours: 4,
    totalLabor: 850,
    totalParts: 2200,
    tags: ["โอเวอร์ฮอลเครื่องบน", "เปลี่ยนโซ่-สเตอร์"],
    notes: "ลูกค้าจะมารับช่วงเย็น ขอช่วยปิดงานให้ทันวันนี้",
    source: "ลูกค้าประจำ",
    isOverdue: false
  },
  {
    id: "J-240005",
    plate: "3กล 4567",
    province: "กรุงเทพฯ",
    customerName: "คุณมาย",
    customerPhone: "091-000-1122",
    vehicleModel: "Honda PCX 160",
    vehicleColor: "น้ำตาล",
    status: JOB_STATUS.DONE,
    priority: JOB_PRIORITY.LOW,
    createdAt: "2024-11-13T15:10:00+07:00",
    updatedAt: "2024-11-14T10:15:00+07:00",
    dueAt: "2024-11-14T12:00:00+07:00",
    estHours: 1.5,
    totalLabor: 300,
    totalParts: 450,
    tags: ["ล้างคาร์บู/หัวฉีด", "ปรับรอบเดินเบา"],
    notes: "แจ้งลูกค้าแล้วว่าสามารถมารับรถได้ทุกเวลา",
    source: "หน้าร้าน",
    isOverdue: false
  }
];

// ---------- สรุปยอดวันนี้แบบคร่าว ๆ (ใช้หน้า Dashboard) ----------

export const demoTodaySummary = {
  date: "2024-11-15",
  totalJobs: 5,
  jobsInProgress: 1,
  jobsWaitingParts: 1,
  jobsWaitPay: 1,
  jobsDoneToday: 1,
  revenueLabor: 2250,    // รวมค่าแรงวันนี้
  revenueParts: 4670,    // รวมค่าอะไหล่วันนี้
  stockLowCount: 3,      // จำนวนอะไหล่ใกล้หมด
  regularCustomersCount: 18
};

// ---------- สต็อก & อะไหล่ ----------

export const demoStock = [
  {
    id: "P-0001",
    code: "OIL-10W40-1L",
    name: "น้ำมันเครื่อง 10W-40 กึ่งสังเคราะห์ 1 ลิตร",
    category: "น้ำมันเครื่อง",
    unit: "แกลลอน",
    costPrice: 120,
    salePrice: 180,
    qty: 6,
    minQty: 4,
    location: "ชั้นหน้าแคชเชียร์",
    compatibleModels: ["Wave", "Click", "Scoopy", "PCX"],
    isFastMoving: true,
    lastUpdated: "2024-11-15T08:30:00+07:00"
  },
  {
    id: "P-0002",
    code: "BRK-SHOE-WAVE",
    name: "ผ้าเบรกดรัมหลัง Wave 110/125",
    category: "ผ้าเบรก",
    unit: "ชุด",
    costPrice: 70,
    salePrice: 130,
    qty: 3,
    minQty: 5,
    location: "ชั้นอะไหล่เบรก",
    compatibleModels: ["Honda Wave 110i", "Honda Wave 125i"],
    isFastMoving: true,
    lastUpdated: "2024-11-14T17:10:00+07:00"
  },
  {
    id: "P-0003",
    code: "SPARK-NGK-CR7HSA",
    name: "หัวเทียน NGK CR7HSA",
    category: "หัวเทียน",
    unit: "หัว",
    costPrice: 55,
    salePrice: 90,
    qty: 10,
    minQty: 6,
    location: "ตู้หัวเทียน",
    compatibleModels: ["Wave", "Dream", "Click"],
    isFastMoving: true,
    lastUpdated: "2024-11-13T11:00:00+07:00"
  },
  {
    id: "P-0004",
    code: "CHAIN-428H-120L",
    name: "โซ่ 428H 120 ข้อ",
    category: "โซ่-สเตอร์",
    unit: "เส้น",
    costPrice: 210,
    salePrice: 320,
    qty: 2,
    minQty: 3,
    location: "ชั้นโซ่-สเตอร์",
    compatibleModels: ["Kaze ZX", "KSR", "Sonic"],
    isFastMoving: false,
    lastUpdated: "2024-11-10T09:15:00+07:00"
  },
  {
    id: "P-0005",
    code: "TUBE-17-250-275",
    name: "ยางใน 2.50/2.75-17",
    category: "ยางใน",
    unit: "เส้น",
    costPrice: 60,
    salePrice: 110,
    qty: 1,
    minQty: 5,
    location: "ชั้นยางใน",
    compatibleModels: ["Wave", "Dream"],
    isFastMoving: true,
    lastUpdated: "2024-11-15T09:00:00+07:00"
  }
];

// ---------- ลูกค้า & รถลูกค้า ----------

export const demoCustomers = [
  {
    id: "C-0001",
    name: "คุณต้น",
    phone: "081-111-2233",
    lineId: "ton.workshop",
    type: "ลูกค้าประจำ",
    tags: ["สายเที่ยว", "ดูแลเรื่องทัวร์"],
    notes: "ชอบออกทริปยาว ขอให้ช่วยเช็กรถละเอียด ๆ ก่อนทุกทริป",
    vehicles: [
      {
        plate: "1กข 1234",
        province: "กรุงเทพฯ",
        model: "Honda Click 125i",
        color: "ขาว-แดง",
        year: 2022,
        favorite: true,
        lastServiceAt: "2024-11-15",
        note: "เปลี่ยนน้ำมันเครื่องทุก 2,500 กม."
      }
    ]
  },
  {
    id: "C-0002",
    name: "คุณก้อง",
    phone: "086-888-9990",
    lineId: "kawagon",
    type: "ลูกค้าประจำ",
    tags: ["Kawasaki", "สายแต่ง"],
    notes: "เล่น Kaze ZX แต่งสวย ขอเซ็ตให้ขี่มันแต่ยังใช้งานได้ทุกวัน",
    vehicles: [
      {
        plate: "งท 2222",
        province: "กรุงเทพฯ",
        model: "Kawasaki Kaze ZX",
        color: "เขียว-ดำ",
        year: 2005,
        favorite: true,
        lastServiceAt: "2024-11-14",
        note: "เพิ่งโอเวอร์ฮอลเครื่องบน เปลี่ยนโซ่-สเตอร์แล้ว"
      }
    ]
  },
  {
    id: "C-0003",
    name: "คุณมาย",
    phone: "091-000-1122",
    lineId: "",
    type: "ลูกค้าขาจร",
    tags: ["สายทำงาน"],
    notes: "ใช้รถไปทำงานทุกวัน ต้องรีบใช้งานคืนก่อนเย็น",
    vehicles: [
      {
        plate: "3กล 4567",
        province: "กรุงเทพฯ",
        model: "Honda PCX 160",
        color: "น้ำตาล",
        year: 2021,
        favorite: false,
        lastServiceAt: "2024-11-13",
        note: ""
      }
    ]
  }
];

// ---------- สูตรซ่อม / ความรู้แนะนำการซ่อม ----------

export const demoRepairRecipes = [
  {
    id: "R-0001",
    name: "เซ็ตเปลี่ยนน้ำมันเครื่อง + เช็กเบื้องต้น",
    group: "ดูแลตามระยะ",
    symptomCategory: "บำรุงรักษาปกติ",
    estimatedMinutes: 25,
    laborItems: [
      { name: "ถ่ายน้ำมันเครื่อง", price: 150 },
      { name: "เช็กเบา ๆ ระบบเบรก / ยาง / โซ่", price: 80 }
    ],
    partItems: [
      { code: "OIL-10W40-1L", name: "น้ำมันเครื่อง 10W-40 กึ่งสังเคราะห์ 1 ลิตร", qty: 1 }
    ],
    noteForMechanic: "ถ้าพบอะไรผิดปกติให้แจ้งลูกค้าก่อนอัปงานเพิ่ม",
    tags: ["เร็ว", "งานพื้นฐาน"],
    autoPOSTemplate: true
  },
  {
    id: "R-0002",
    name: "แก้อาการเบรกหน้าแล้วรถส่าย / จานคด",
    group: "ระบบเบรก",
    symptomCategory: "เบรก",
    estimatedMinutes: 45,
    laborItems: [
      { name: "ถอดจานเบรกหน้า + ทำความสะอาด", price: 250 },
      { name: "ตั้งศูนย์ล้อหน้า/ตรวจลูกปืนล้อ", price: 150 }
    ],
    partItems: [
      { code: "BRK-SHOE-WAVE", name: "ผ้าเบรกดรัมหลัง Wave", qty: 0 }, // ตัวอย่าง mapping
    ],
    noteForMechanic: "ทดสอบขี่จริงหน้าร้าน หลังประกอบให้เช็กน็อตทั้งหมดอีกครั้ง",
    tags: ["เน้นความปลอดภัย"],
    autoPOSTemplate: true
  },
  {
    id: "R-0003",
    name: "เช็กทั้งคันก่อนขาย/รับซื้อ",
    group: "รับซื้อรถ",
    symptomCategory: "ตรวจเช็กก่อนซื้อ",
    estimatedMinutes: 60,
    laborItems: [
      { name: "ตรวจระบบเครื่องยนต์เบื้องต้น", price: 250 },
      { name: "ตรวจเฟรม / คัสซี / หัวคอ / โครงรถ", price: 200 },
      { name: "เช็กระบบไฟ, สัญญาณ, ไฟเลี้ยวและไฟเบรก", price: 150 }
    ],
    partItems: [],
    noteForMechanic: "จดรายการตำหนิไว้ ใช้ประกอบตอนคุยราคา/ขายต่อ",
    tags: ["รับซื้อรถ", "ประเมินราคา"],
    autoPOSTemplate: false
  }
];

// ---------- ฟังก์ชัน helper สำหรับ mock ----------

/**
 * คืนค่าจำนวนงานใน demoJobs ตาม status
 * @param {string} status
 * @returns {number}
 */
export function countJobsByStatus(status) {
  return demoJobs.filter((job) => job.status === status).length;
}

/**
 * คืนค่าจำนวนอะไหล่ที่ต่ำกว่าจุดสั่งซื้อ (minQty)
 */
export function countLowStock() {
  return demoStock.filter((item) => item.qty <= item.minQty).length;
}

/**
 * คืนค่าจำนวนลูกค้าประจำ
 */
export function countRegularCustomers() {
  return demoCustomers.filter((c) => c.type === "ลูกค้าประจำ").length;
}