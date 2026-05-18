import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where, addDoc, doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ⚙️ 1. ปลั๊กพ่วงเชื่อมต่อระบบกลาง Firebase อู่ BEN MOTOR ตรงรุ่น
const firebaseConfig = {
  apiKey: "AIzaSyBZuJ0Gpsz61oF0yrmKcreBsOfpJqPffYo",
  authDomain: "ben-motor.firebaseapp.com",
  projectId: "ben-motor",
  storageBucket: "ben-motor.firebasestorage.app",
  messagingSenderId: "814162692446",
  appId: "1:814162692446:web:7753156248d76938fce7cf"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 🛑 รหัส API KEY ของกูเกิล (ใส่รหัสแท้ใช้งานของลูกพี่ตรงนี้เงียบ ๆ ได้เลยครับ)
const GEMINI_API_KEY = "AIzaSyAG-klU4R8wUlwKG3U3a_j2eR5zkq1-Glg"; 

let currentUid = null;
let currentProfile = null;

// 🧠 คลังความจำแชท J.A.R.V.I.S ดึงจากฮาร์ดดิสก์เบราว์เซอร์ถาวร ปิดเปิดเว็บใหม่ความจำไม่ล้าง
let chatHistory = JSON.parse(localStorage.getItem("ben_motor_ai_permanent_memory") || "[]");

// --- 🛠️ 2. ระบบสร้างปุ่มกดและหน้าต่างแชทลอยได้อัตโนมัติ (Dynamic UI Injection) ---
function injectAIWidget() {
    const style = document.createElement('style');
    style.innerHTML = `
        .ai-fab { position: fixed; bottom: 85px; right: 20px; width: 60px; height: 60px; z-index: 2000; border-radius: 50%; box-shadow: 0 4px 15px rgba(0,0,0,0.2); transition: all 0.3s; }
        .ai-fab:hover { transform: scale(1.05); }
        .ai-window { position: fixed; bottom: 155px; right: 20px; width: 360px; max-width: 92vw; height: 520px; z-index: 2000; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.25); }
        .ai-chat-box { overflow-y: auto; flex-grow: 1; display: flex; flex-direction: column; gap: 10px; background-color: #f8f9fa; }
    `;
    document.head.appendChild(style);

    // สร้างปุ่มหุ่นยนต์ลอยได้
    const fab = document.createElement('button');
    fab.id = 'dynamicAiToggleBtn';
    fab.className = 'btn btn-dark ai-fab d-flex align-items-center justify-content-center border-2 border-white';
    fab.innerHTML = '<i class="bi bi-robot fs-2 text-warning"></i>';
    document.body.appendChild(fab);

    // สร้างกล่องแชทพรีเมียม
    const win = document.createElement('div');
    win.id = 'dynamicAiWindow';
    win.className = 'card ai-window border-0 rounded-4 d-none';
    win.innerHTML = `
        <div class="card-header bg-dark text-white d-flex justify-content-between align-items-center py-3">
            <h6 class="mb-0 fw-bold d-flex align-items-center"><i class="bi bi-robot text-warning me-2 fs-5"></i> J.A.R.V.I.S ผู้จัดการส่วนตัว</h6>
            <div class="d-flex align-items-center gap-2">
                <button type="button" class="btn btn-sm btn-outline-danger border-0 p-1" id="clearAiMemoryBtn" title="ล้างความจำแชท"><i class="bi bi-trash3 text-danger"></i></button>
                <button type="button" class="btn-close btn-close-white" id="dynamicAiCloseBtn"></button>
            </div>
        </div>
        <div class="card-body p-3 ai-chat-box" id="dynamicAiChatBox">
            <div class="d-flex justify-content-start">
                <div class="bg-white border rounded-3 p-2 px-3 small shadow-sm" style="max-width: 85%;">
                    สวัสดีครับลูกพี่เบน! ผมคุมระบบหลังบ้านให้เรียบร้อยแล้ว สั่งเปิดบิล เช็คสต๊อก หรือลงบัญชีผ่านแชทนี้ได้เลยครับ! 🔧🤖
                </div>
            </div>
        </div>
        <div class="card-footer bg-white border-top p-2">
            <form id="dynamicAiForm" class="input-group">
                <input type="text" id="dynamicAiInput" class="form-control border-success-subtle bg-light rounded-start-pill ps-3 small" placeholder="พิมพ์สั่งงาน เช่น ปะยาง PCX 120..." autocomplete="off" required>
                <button class="btn btn-success rounded-end-pill px-3" type="submit" id="dynamicAiSendBtn"><i class="bi bi-send-fill"></i></button>
            </form>
        </div>
    `;
    document.body.appendChild(win);
}

// 🧠 ฟังก์ชันจัดระเบียบฟองสบู่ข้อความแชท
function appendAiMessage(sender, text) {
    const box = document.getElementById("dynamicAiChatBox");
    if (!box) return;
    const div = document.createElement("div");
    div.className = `d-flex justify-content-${sender === 'user' ? 'end' : 'start'}`;
    const bubble = document.createElement("div");
    bubble.className = `rounded-3 p-2 px-3 small shadow-sm ${sender === 'user' ? 'bg-success text-white' : 'bg-white border text-dark'}`;
    bubble.style.maxWidth = "85%";
    bubble.innerHTML = text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    div.appendChild(bubble);
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

// 🧠 ฟังก์ชันสแกนข้อมูลเรียลไทม์ป้อนใส่ความจำชั่วคราวให้ AI หน้างาน
async function getLiveShopContext() {
    const today = new Date().toISOString().split("T")[0];
    let context = `[ฐานข้อมูลสดเรียลไทม์อู่ BEN MOTOR]\n`;
    try {
        const stockSnap = await getDocs(query(collection(db, "stock"), where("isDeleted", "==", false)));
        let stockItems = [];
        stockSnap.forEach(doc => {
            const d = doc.data();
            stockItems.push(`- IDอะไหล่: ${doc.id} | ชื่อสินค้า: ${d.name} | คงเหลือในคลัง: ${d.qty} ชิ้น | ราคาขายหน้าร้าน: ${d.salePrice} บาท`);
        });
        context += `📦 **ตารางสต๊อกสินค้าหน้าร้านปัจจุบัน:**\n${stockItems.join("\n")}\n\n`;

        const jobsSnap = await getDocs(query(collection(db, "jobs"), where("isDeleted", "==", false), where("status", "==", "repairing")));
        let pendingJobs = [];
        jobsSnap.forEach(doc => pendingJobs.push(`- IDงานซ่อม: ${doc.id} | ทะเบียนรถ: ${doc.data().plate} | ปัญหาอาการ: ${doc.data().problem}`));
        context += `🔧 **รายการรถกำลังซ่อมค้างอยู่ในอู่ตอนนี้:**\n${pendingJobs.join("\n")}\n\n`;

        const vSnap = await getDocs(query(collection(db, "vehicles"), where("isDeleted", "==", false), where("status", "==", "in_stock")));
        let vehicles = [];
        vSnap.forEach(doc => vehicles.push(`- IDรถมือสอง: ${doc.id} | ยี่ห้อรุ่น: ${doc.data().brand} ${doc.data().model} | ทะเบียน: ${doc.data().plate}`));
        context += `🏍️ **รถมอเตอร์ไซค์มือสองพร้อมขายในเต็นท์:**\n${vehicles.join("\n")}\n`;
    } catch (error) { console.error("Context Data Crash:", error); }
    return context;
}

// 🧠 ชุดพิมพ์เขียวเครื่องมือควบคุมระบบ POS ทั้งร้าน (Master Tools Array Specifications)
const aiFunctionTools = [{
    functionDeclarations: [
        {
            name: "create_bill",
            description: "เปิดบิลใบงานซ่อมรถมอเตอร์ไซค์คันใหม่เข้าสู่ระบบ",
            parameters: {
                type: "OBJECT",
                properties: {
                    plate: { type: "STRING", description: "ป้ายทะเบียนรถมอเตอร์ไซค์ (บังคับ)" },
                    customerName: { type: "STRING", description: "ชื่อลูกค้าผู้ครอบครองรถ" },
                    customerPhone: { type: "STRING", description: "เบอร์โทรศัพท์ติดต่อลูกค้า" },
                    brand: { type: "STRING", description: "ยี่ห้อรถ เช่น Honda, Yamaha" },
                    model: { type: "STRING", description: "รุ่นรถมอเตอร์ไซค์ เช่น Wave 110i, Click" },
                    problem: { type: "STRING", description: "อาการเสียหรืองานบริการซ่อมที่ระบุหน้างาน" },
                    priority: { type: "STRING", description: "ระดับความด่วนของงานซ่อม: 'normal', 'high' (ด่วนมาก), 'low'" },
                    paymentMethod: { type: "STRING", description: "วิธีการจ่ายเงิน: 'cash' (เงินสด), 'transfer' (เงินโอน), 'pending' (ค้างชำระไว้ก่อน)" },
                    parts: {
                        type: "ARRAY",
                        description: "รายการอะไหล่ในคลังสินค้าที่เบิกออกมาใช้ตัดสต๊อก",
                        items: {
                            type: "OBJECT",
                            properties: {
                                stockId: { type: "STRING", description: "IDอะไหล่ แท้ตรงจากฐานข้อมูลสต๊อกหน้าร้าน" },
                                qty: { type: "NUMBER", description: "จำนวนชิ้นที่เบิกใช้งาน" }
                            }
                        }
                    },
                    laborItems: {
                        type: "ARRAY",
                        description: "รายการค่าบริการ ซ่อมแซม หรือค่าแรงช่างที่ไม่มีวัตถุในคลังสินค้า",
                        items: {
                            type: "OBJECT",
                            properties: {
                                name: { type: "STRING", description: "ชื่องานบริการซ่อม เช่น ค่าแรงผ่าเครื่อง, ค่าแรงปะยาง" },
                                price: { type: "NUMBER", description: "ราคาค่าแรงช่างหน่วยเป็นบาท" }
                            }
                        }
                    },
                    discount: { type: "NUMBER", description: "ส่วนลดค่าซ่อมรวมหน่วยเป็นบาท" }
                },
                required: ["plate", "problem"]
            }
        },
        {
            name: "update_job_status",
            description: "แก้ไขอัปเดตสถานะใบงานซ่อมรถในอู่ เช่น แจ้งซ่อมเสร็จ หรือลูกค้ามารับรถกลับแล้ว",
            parameters: {
                type: "OBJECT",
                properties: {
                    jobId: { type: "STRING", description: "IDงานซ่อม แท้ที่ต้องการอัปเดตข้อมูล" },
                    status: { type: "STRING", description: "สถานะใหม่ที่ต้องการสับเปลี่ยน: 'repairing' (กำลังซ่อม), 'done' (ซ่อมเสร็จแล้ว), 'picked_up' (ส่งมอบรถแล้ว)" }
                },
                required: ["jobId", "status"]
            }
        },
        {
            name: "manage_stock",
            description: "จัดระบบคลังอะไหล่สต๊อกสินค้า บันทึกของชิ้นใหม่หรือซื้ออะไหล่เติมสต๊อก",
            parameters: {
                type: "OBJECT",
                properties: {
                    action: { type: "STRING", description: "ใส่คำว่า 'create' เพื่อเปิดรหัสอะไหล่ชิ้นใหม่ หรือ 'stock_in' เพื่อซื้อของเก่าเติมยอดคลัง" },
                    stockId: { type: "STRING", description: "IDอะไหล่ (ใช้เฉพาะกรณีสับรางเลือก action เป็น stock_in)" },
                    code: { type: "STRING", description: "รหัสรันสินค้าตามชั้นวาง เช่น SKU-OIL" },
                    name: { type: "STRING", description: "ชื่อรุ่น/ชื่อเรียกชิ้นส่วนอะไหล่" },
                    qty: { type: "NUMBER", description: "จำนวนสินค้า" },
                    costPrice: { type: "NUMBER", description: "ราคาทุนทรัพย์ที่สั่งซื้อมาต่อหน่วย" },
                    salePrice: { type: "NUMBER", description: "ราคาตั้งขายหน้าร้านต่อหน่วย" }
                },
                required: ["action", "name", "qty"]
            }
        },
        {
            name: "manage_vehicle",
            description: "ลงบันทึกรับซื้อรถมอเตอร์ไซค์มือสองเข้าเต็นท์อู่ หรือบันทึกปิดงบยอดขายรถออกไป",
            parameters: {
                type: "OBJECT",
                properties: {
                    action: { type: "STRING", description: "สับรางคำสั่ง: 'buy' (รับซื้อรถเข้าสต๊อกอู่) หรือ 'sell' (ขายรถออกไป)" },
                    vehicleId: { type: "STRING", description: "IDรถมือสอง (ใช้กรณีลงประวัติขายรถออกไป)" },
                    plate: { type: "STRING", description: "ป้ายทะเบียนรถมอเตอร์ไซค์มือสอง" },
                    brand: { type: "STRING", description: "ยี่ห้อแบรนด์รถ" },
                    model: { type: "STRING", description: "รุ่นรถและขนาดซีซี" },
                    price: { type: "NUMBER", description: "ราคาสรุปยอดรับซื้อเข้า หรือราคาที่ปิดดีลขายได้จริง" }
                },
                required: ["action", "plate", "price"]
            }
        },
        {
            name: "add_transaction",
            description: "บันทึกบัญชีรายรับ-รายจ่ายทั่วไปหน้าร้านอิสระที่ไม่ผ่านใบงานซ่อมรถ เช่น จ่ายค่าข้าว จ่ายค่าไฟ",
            parameters: {
                type: "OBJECT",
                properties: {
                    type: { type: "STRING", description: "ใส่คำล็อกระบบ: 'income' (เงินเข้าเก๊ะ) หรือ 'expense' (เงินไหลออก)" },
                    category: { type: "STRING", description: "หมวดหมู่บัญชี เช่น ค่าน้ำไฟ, อาหาร/เครื่องดื่ม, ค่าใช้จ่ายร้าน" },
                    amount: { type: "NUMBER", description: "ยอดจำนวนเงินเม็ดเงินสุทธิ" },
                    description: { type: "STRING", description: "รายละเอียดข้อความกำกับรายการบัญชี" },
                    method: { type: "STRING", description: "ช่องทางเคลื่อนไหว: 'cash' (เงินสดเก๊ะ), 'transfer' (เงินโอนเข้าธนาคาร)" }
                },
                required: ["type", "category", "amount", "description", "method"]
            }
        }
    ]
}];

// --- 🚀 3. ระบบประมวลผลขับเคลื่อนฟังก์ชันหลัก (Core Event Loops) ---
function setupAiCoreEngine() {
    const form = document.getElementById("dynamicAiForm");
    const input = document.getElementById("dynamicAiInput");
    const sBtn = document.getElementById("dynamicAiSendBtn");
    const cMemoryBtn = document.getElementById("clearAiMemoryBtn");
    const box = document.getElementById("dynamicAiChatBox");

    // โหลดประวัติความจำเก่าที่ตกค้างในคอมมาเรียงหน้าจอให้สวยงาม
    if(chatHistory.length > 0 && box.children.length <= 1) {
        chatHistory.forEach(msg => {
            if(msg.parts && msg.parts[0] && msg.parts[0].text && !msg.parts[0].text.includes("คุณคือระบบ AI")) {
                appendAiMessage(msg.role === "user" ? "user" : "ai", msg.parts[0].text);
            }
        });
    }

    // ปุ่มกดล้างความทรงจำล้างแคชสมอง J.A.R.V.I.S
    cMemoryBtn?.addEventListener("click", () => {
        if(confirm("ลูกพี่เบน ต้องการล้างความทรงจำแชททั้งหมดของ J.A.R.V.I.S หรือไม่?")) {
            chatHistory = [];
            localStorage.removeItem("ben_motor_ai_permanent_memory");
            box.innerHTML = `
                <div class="d-flex justify-content-start">
                    <div class="bg-white border rounded-3 p-2 px-3 small shadow-sm" style="max-width: 85%;">
                        🧠 ล้างความจำเสร็จเรียบร้อยแล้วครับกล่องสมองโล่งคลีน พิมพ์สั่งงานใหม่ได้เลยครับลูกพี่เบน!
                    </div>
                </div>`;
        }
    });

    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const prompt = input.value.trim();
        if(!prompt) return;

        appendAiMessage("user", prompt);
        input.value = "";
        input.disabled = true;
        sBtn.disabled = true;

        chatHistory.push({ role: "user", parts: [{ text: prompt }] });

        const loadingId = "ai-load-" + Date.now();
        const loadingDiv = document.createElement("div");
        loadingDiv.id = loadingId;
        loadingDiv.className = "d-flex justify-content-start text-muted small p-2 animate-pulse";
        loadingDiv.innerHTML = `<em><i class="bi bi-robot me-1"></i> J.A.R.V.I.S กำลังเชื่อมโยงตาราง POS...</em>`;
        box.appendChild(loadingDiv);
        box.scrollTop = box.scrollHeight;

        try {
            const liveSnapshot = await getLiveShopContext();
            const systemRuleInstruction = `คุณคือสุดยอดระบบสมองกล AI นามว่า J.A.R.V.I.S ผู้ควบคุมศูนย์บัญชาการระบบ POS หลังบ้านของอู่ "BEN MOTOR"
[กฎเหล็กในการคำนวณและประมวลผลคำสั่งของคุณเบน]:
1. เมื่อเปลี่ยนหรือเบิกใช้อะไหล่ที่มีอยู่ใน [ตารางสต๊อกสินค้าหน้าร้านปัจจุบัน] (คงเหลือ > 0) ให้คุณเลือกดึง IDอะไหล่ ไปยัดใส่ในช่อง 'parts' ห้ามคิดรายการเป็นค่าแรงในช่อง 'laborItems' ซ้ำซ้อนขึ้นมาเองเด็ดขาด ยอดรวมบิลต้องเท่ากับราคาสินค้าคูณจำนวนพอดี
2. หากไม่มีอะไหล่ชิ้นนั้นในคลังสต๊อก (คงเหลือ 0 หรือหาชื่อไม่เจอ) จึงจะปล่อยช่อง parts ว่าง และบันทึกรายการนั้นเป็นค่าบริการช่างลงช่อง 'laborItems' แทน
3. คุยเป็นกันเองในสไตล์ช่างมอเตอร์ไซค์ผู้เชี่ยวชาญกับคุณเบน มีความจำย้อนหลังต่อเนื่องห้ามลืมประเด็นเด็ดขาด
${liveSnapshot}`;

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemRuleInstruction }] },
                    contents: chatHistory,
                    tools: aiFunctionTools
                })
            });

            const resData = await res.json();
            document.getElementById(loadingId)?.remove();

            if (res.ok && resData.candidates) {
                const aiParts = resData.candidates[0].content.parts[0];

                if (aiParts.functionCall) {
                    const fnName = aiParts.functionCall.name;
                    const args = aiParts.functionCall.args;
                    const today = new Date().toISOString().split("T")[0];
                    const branchId = currentProfile?.branchId || null;
                    const uid = currentUid || "autonomous-system";
                    const mechanicName = currentProfile?.displayName || "ช่างเบน";

                    // 🔴 TOOL 1: ระบบจัดการเปิดบิลซ่อมโครงสร้างตรงรุ่น 100%
                    if (fnName === "create_bill") {
                        const rawParts = args.parts || []; const rawLabor = args.laborItems || [];
                        const payMethod = args.paymentMethod || "cash";
                        let itemsArray = []; let laborArray = []; let partsTotal = 0; let laborTotal = 0;

                        for(const p of rawParts) {
                            if(p.stockId) {
                                const sRef = doc(db, "stock", p.stockId); const sSnap = await getDoc(sRef);
                                if(sSnap.exists()) {
                                    const sData = sSnap.data(); const qty = Number(p.qty) || 1;
                                    const price = Number(sData.salePrice) || 0; const lineTotal = qty * price;
                                    partsTotal += lineTotal;

                                    // ฟิกซ์ฟิลด์ตรงเป๊ะกับหน้าใบเสร็จร้านเบนมอเตอร์
                                    itemsArray.push({
                                        stockId: p.stockId, stockName: sData.name || "อะไหล่",
                                        qty, unitPrice: price, lineTotal
                                    });
                                    // หักลดยอดคลังคงเหลือจริงหลังบ้านทันที
                                    await updateDoc(sRef, { qty: Math.max(0, (Number(sData.qty)||0) - qty), updatedAt: serverTimestamp() });
                                }
                            }
                        }

                        for(const l of rawLabor) {
                            const price = Number(l.price) || 0; laborTotal += price;
                            laborArray.push({ name: l.name || "ค่าบริการ/ค่าแรงช่าง", price });
                        }

                        const discount = Number(args.discount) || 0;
                        const totalAmount = Math.max(0, (partsTotal + laborTotal) - discount);
                        const customerName = args.customerName || "ลูกค้าทั่วไป";

                        // ยิงข้อมูลบันทึกลงตารางงานซ่อมหลัก (jobs)
                        const jobRef = await addDoc(collection(db, "jobs"), {
                            date: today, customerName, customerPhone: args.customerPhone || "-",
                            plate: args.plate || "-", brand: args.brand || "-", model: args.model || "-", mileage: "",
                            problem: args.problem, status: "repairing", priority: args.priority || "normal",
                            paymentMethod: payMethod, mechanicName, notes: "",
                            items: itemsArray, laborItems: laborArray,
                            partsTotal, laborTotal, discount, totalAmount, branchId, isDeleted: false,
                            createdBy: uid, createdByName: mechanicName, createdAt: serverTimestamp()
                        });

                        // ยิงข้อมูลพ่วงทะลุเข้ากระแสบัญชีการเงินหน้าร้านทันทีเพื่อให้แดชบอร์ดประมวลยอดได้
                        if (totalAmount > 0 && payMethod !== 'pending') {
                            await addDoc(collection(db, "transactions"), {
                                date: today, type: "income", category: "ค่าซ่อม",
                                description: `ค่าซ่อมรถมอเตอร์ไซค์ ทะเบียน ${args.plate} (${customerName})`,
                                method: payMethod, paymentMethod: payMethod, amount: totalAmount,
                                sourceType: "job", sourceId: jobRef.id, branchId, isDeleted: false, createdAt: serverTimestamp(), createdBy: uid
                            });
                        }

                        const okReply = `🔧 **วิเคราะห์สับรางสั่งเปิดบิลและหักคลังอะไหล่ตรงรุ่นสำเร็จ!**\n- ทะเบียนรถ: **${args.plate}**\n- ยอดสุทธิรวมเข้าเก๊ะ: **${totalAmount.toLocaleString()} ฿**\n*(ข้อมูลรันเข้าฐานข้อมูลใบงานซ่อมย้อนหลังและอัปเดตกระแสเงินสดหน้าร้านเรียบร้อยครับ)*`;
                        appendAiMessage("ai", okReply);
                        chatHistory.push({ role: "model", parts: [{ text: `ทำการเปิดบิลซ่อมสำเร็จ รถทะเบียน ${args.plate} ยอดเงินสุทธิ ${totalAmount} บาทเรียบร้อย` }] });

                    // 🔴 TOOL 2: อัปเกรดอัปเดตสถานะบิลงานซ่อม
                    } else if (fnName === "update_job_status") {
                        const jRef = doc(db, "jobs", args.jobId);
                        await updateDoc(jRef, { status: args.status, updatedAt: serverTimestamp() });
                        const fineLog = `✅ **เปลี่ยนสถานะใบงานซ่อมสำเร็จ!** รหัสดีลงาน **${args.jobId}** เปลี่ยนเป็นสถานะ **"${args.status}"** เรียบร้อยครับลูกพี่!`;
                        appendAiMessage("ai", fineLog);
                        chatHistory.push({ role: "model", parts: [{ text: `สับเปลี่ยนสถานะใบงานซ่อมรหัส ${args.jobId} เป็นสถานะ ${args.status} เรียบร้อย` }] });

                    // 🔴 TOOL 3: จัดการระบบคลังคลังสต๊อกอะไหล่
                    } else if (fnName === "manage_stock") {
                        if (args.action === "create") {
                            await addDoc(collection(db, "stock"), {
                                code: args.code || "SKU-" + Date.now(), name: args.name, category: "ทั่วไป", unit: "ชิ้น", qty: Number(args.qty), minQty: 2, costPrice: Number(args.costPrice)||0, salePrice: Number(args.salePrice)||0, isDeleted: false, createdAt: serverTimestamp()
                            });
                            appendAiMessage("ai", `📦 **เพิ่มรหัสสินค้าใหม่สำเร็จ!** อะไหล่ **${args.name}** จำนวน **${args.qty}ชิ้น** บันทึกเข้าตารางหน้าสต๊อกหลักเรียบร้อยครับ!`);
                        }

                    // 🔴 TOOL 4: จัดการระบบซื้อขายรถมอเตอร์ไซค์มือสอง
                    } else if (fnName === "manage_vehicle") {
                        if (args.action === "buy") {
                            const vRef = await addDoc(collection(db, "vehicles"), {
                                buyDate: today, plate: args.plate, brand: args.brand || "-", model: args.model || "-", mileage: 0, buyPrice: Number(args.price), repairCost: 0, note: "", status: "in_stock", branchId, isDeleted: false, createdAt: serverTimestamp(), createdBy: uid
                            });
                            await addDoc(collection(db, "transactions"), {
                                date: today, type: "expense", category: "ซื้อรถ", description: `รับซื้อรถเข้าสต๊อก ทะเบียน ${args.plate}`, amount: Number(args.price), method: "cash", paymentMethod: "cash", sourceType: "vehicle", sourceId: vRef.id, branchId, isDeleted: false, createdAt: serverTimestamp(), createdBy: uid
                            });
                            appendAiMessage("ai", `🏍️ **ลงบันทึกรับซื้อรถเข้าเต็นท์อู่สำเร็จ!** รถมอเตอร์ไซค์ทะเบียน **${args.plate}** บันทึกเข้าหน้ารถรับซื้อพร้อมหักงบรายจ่ายหน้ากระแสเงินสดเรียบร้อยครับ!`);
                        }

                    // 🔴 TOOL 5: จัดการงบบัญชีอิสระหน้าร้าน
                    } else if (fnName === "add_transaction") {
                        await addDoc(collection(db, "transactions"), {
                            date: today, type: args.type, category: args.category, description: args.description, method: args.method, paymentMethod: args.method, amount: Number(args.amount), sourceType: "manual", branchId, isDeleted: false, createdAt: serverTimestamp(), createdBy: uid
                        });
                        const fineReply = `💰 **บันทึกงบบัญชีรายวันหน้าร้านสำเร็จ!** รายการ **"${args.description}"** ยอดเงินสุทธิ **${args.amount} ฿** ยิงเข้าหน้าสรุปการเงินเรียบร้อยครับ!`;
                        appendAiMessage("ai", fineReply);
                        chatHistory.push({ role: "model", parts: [{ text: `ลงงบบัญชีรายการ ${args.description} ยอด ${args.amount} บาท สำเร็จ` }] });
                    }
                } else {
                    // แชทคุยเล่น วางแผน หรือให้วิเคราะห์อาการรถทั่วไป
                    appendAiMessage("ai", aiParts.text);
                    chatHistory.push({ role: "model", parts: [{ text: aiParts.text }] });
                }

                // ควบคุมขนาดไฟล์เก๊ะเก็บประวัติคุยไม่ให้บวมเกินสเปค (สูงสุด 30 บรรทัดคุย)
                if (chatHistory.length > 30) chatHistory.shift();
                localStorage.setItem("ben_motor_ai_permanent_memory", JSON.stringify(chatHistory));

            } else { throw new Error(`[CODE: ${resData.error?.status}] ${resData.error?.message}`); }

        } catch (error) {
            console.error("AI Core Engine Error:", error);
            appendAiMessage("ai", `❌ **กล่อง ECU คุม AI ขัดข้องหน้าร้าน:** ${error.message}`);
        } finally {
            input.disabled = false;
            sBtn.disabled = false;
            input.focus();
        }
    });

    // ปุ่มแอบสลับเปิด/ซ่อนหน้าต่างแชท J.A.R.V.I.S ลอยได้
    document.getElementById("dynamicAiToggleBtn")?.addEventListener("click", () => {
        const w = document.getElementById("dynamicAiWindow");
        w?.classList.toggle("d-none");
        if(w && !w.classList.contains("d-none")) input?.focus();
    });
    document.getElementById("dynamicAiCloseBtn")?.addEventListener("click", () => {
        document.getElementById("dynamicAiWindow")?.addDoc.classList.add("d-none");
    });
}

// 🚦 สตาร์ทเครื่องยนต์ระบบ AI ทันทีเมื่อโหลดหน้าเว็บโครงรถเสร็จสิ้น
document.addEventListener("DOMContentLoaded", () => {
    injectAIWidget();
    setupAiCoreEngine();
});
