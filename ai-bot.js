import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where, addDoc, doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ⚙️ 1. ปลั๊กพ่วงเชื่อมต่อฐานข้อมูล Firebase อู่ BEN MOTOR ตรงรุ่น
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

let currentUid = null;
let currentProfile = null;

// 🧠 คลังประวัติความจำแชท บันทึกดองลงคอมหน้าร้านถาวร
let chatHistory = JSON.parse(localStorage.getItem("ben_motor_puter_permanent_memory") || "[]");

// --- 🛠️ 2. ระบบสร้างหน้าต่างแชทลอยได้หน้าร้านอัตโนมัติ (Dynamic UI Injection) ---
function injectAIWidget() {
    if (document.getElementById('dynamicAiToggleBtn')) return; 

    const style = document.createElement('style');
    style.innerHTML = `
        .ai-fab { position: fixed; bottom: 85px; right: 20px; width: 60px; height: 60px; z-index: 2000; border-radius: 50%; box-shadow: 0 4px 15px rgba(0,0,0,0.2); transition: all 0.3s; }
        .ai-fab:hover { transform: scale(1.05); }
        .ai-window { position: fixed; bottom: 155px; right: 20px; width: 360px; max-width: 92vw; height: 520px; z-index: 2000; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.25); }
        .ai-chat-box { overflow-y: auto; flex-grow: 1; display: flex; flex-direction: column; gap: 10px; background-color: #f8f9fa; }
    `;
    document.head.appendChild(style);

    const fab = document.createElement('button');
    fab.id = 'dynamicAiToggleBtn';
    fab.className = 'btn btn-dark ai-fab d-flex align-items-center justify-content-center border-2 border-white';
    fab.innerHTML = '<i class="bi bi-robot fs-2 text-warning"></i>';
    document.body.appendChild(fab);

    const win = document.createElement('div');
    win.id = 'dynamicAiWindow';
    win.className = 'card ai-window border-0 rounded-4 d-none';
    win.innerHTML = `
        <div class="card-header bg-dark text-white d-flex justify-content-between align-items-center py-3">
            <h6 class="mb-0 fw-bold d-flex align-items-center"><i class="bi bi-robot text-warning me-2 fs-5"></i> J.A.R.V.I.S ระบบคุมร้านไร้ขีดจำกัด</h6>
            <div class="d-flex align-items-center gap-2">
                <button type="button" class="btn btn-sm btn-outline-danger border-0 p-1" id="clearAiMemoryBtn" title="ล้างความจำแชท"><i class="bi bi-trash3 text-danger"></i></button>
                <button type="button" class="btn-close btn-close-white" id="dynamicAiCloseBtn"></button>
            </div>
        </div>
        <div class="card-body p-3 ai-chat-box" id="dynamicAiChatBox">
            <div class="d-flex justify-content-start">
                <div class="bg-white border rounded-3 p-2 px-3 small shadow-sm" style="max-width: 85%;">
                    สวัสดีครับลูกพี่เบน! ระบบอัปเกรดสมองกลวิเคราะห์ราคาสำรองเรียบร้อย สั่งเปิดบิล คุมคลัง เช็คเงินได้เต็มระบบเลยครับ! 🔧🤖
                </div>
            </div>
        </div>
        <div class="card-footer bg-white border-top p-2">
            <form id="dynamicAiForm" class="input-group">
                <input type="text" id="dynamicAiInput" class="form-control border-success-subtle bg-light rounded-start-pill ps-3 small" placeholder="พิมพ์สั่งงานช่างซ่อม..." autocomplete="off" required>
                <button class="btn btn-success rounded-end-pill px-3" type="submit" id="dynamicAiSendBtn"><i class="bi bi-send-fill"></i></button>
            </form>
        </div>
    `;
    document.body.appendChild(win);
}

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

async function getLiveShopContext() {
    const today = new Date().toISOString().split("T")[0];
    let context = `[ฐานข้อมูลสดเรียลไทม์อู่ BEN MOTOR]\n`;
    try {
        const stockSnap = await getDocs(query(collection(db, "stock"), where("isDeleted", "==", false)));
        let stockItems = [];
        stockSnap.forEach(doc => {
            const d = doc.data();
            stockItems.push(`- IDอะไหล่: ${doc.id} | ชื่อสินค้า: ${d.name} | คงเหลือในคลัง: ${d.qty} ชิ้น | ราคาขายหน้าน้าน: ${d.salePrice} บาท`);
        });
        context += `📦 **ตารางสต๊อกสินค้าหน้าร้านปัจจุบัน:**\n${stockItems.join("\n")}\n\n`;

        const jobsSnap = await getDocs(query(collection(db, "jobs"), where("isDeleted", "==", false), where("status", "==", "repairing")));
        let pendingJobs = [];
        jobsSnap.forEach(doc => pendingJobs.push(`- IDงานซ่อม: ${doc.id} | ทะเบียนรถ: ${doc.data().plate} | ปัญหาอาการ: ${doc.data().problem}`));
        context += `🔧 **รายการรถกำลังซ่อมค้างอยู่ในอู่ตอนนี้:**\n${pendingJobs.join("\n")}\n\n`;
    } catch (error) { console.error("Context Data Crash:", error); }
    return context;
}

// 🧠 ชุดเครื่องมือเวอร์ชัน Puter ตัวแปรพิมพ์เล็กตรงล็อกระบบ
const aiFunctionTools = [
    {
        type: "function",
        function: {
            name: "create_bill",
            description: "เปิดบิลใบงานซ่อมรถมอเตอร์ไซค์คันใหม่เข้าสู่ระบบ",
            parameters: {
                type: "object",
                properties: {
                    plate: { type: "string", description: "ป้ายทะเบียนรถมอเตอร์ไซค์ (บังคับ)" },
                    customerName: { type: "string", description: "ชื่อลูกค้า" },
                    customerPhone: { type: "string", description: "เบอร์โทรศัพท์ลูกค้า" },
                    brand: { type: "string", description: "ยี่ห้อรถ" },
                    model: { type: "string", description: "รุ่นรถมอเตอร์ไซค์" },
                    problem: { type: "string", description: "อาการเสียหรืองานบริการซ่อมหน้างาน" },
                    priority: { type: "string", description: "ระดับความด่วน: 'normal', 'high', 'low'" },
                    paymentMethod: { type: "string", description: "วิธีการจ่ายเงิน: 'cash', 'transfer', 'pending'" },
                    parts: {
                        type: "array",
                        description: "รายการอะไหล่สินค้า",
                        items: {
                            type: "object",
                            properties: {
                                stockId: { type: "string", description: "IDอะไหล่ จากตารางคลังสินค้า (ใส่เฉพาะเมื่อเจอไอดีตรงเป๊ะในระบบ)" },
                                stockName: { type: "string", description: "ชื่อเรียกอะไหล่" },
                                unitPrice: { type: "number", description: "ราคาประเมินกลางของอะไหล่ชิ้นนี้ (เช่น น้ำมันเครื่องใส่ 140, ยางนอกใส่ 350)" },
                                qty: { type: "number", description: "จำนวนชิ้น" }
                            },
                            required: ["stockName", "unitPrice", "qty"]
                        }
                    },
                    laborItems: {
                        type: "array",
                        description: "รายการค่าแรงหรือบริการซ่อมแซมหน้าร้าน",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string", description: "ชื่องานบริการซ่อม เช่น ค่าแรงปะยาง" },
                                price: { type: "number", description: "ราคาค่าแรงช่าง" }
                            },
                            required: ["name", "price"]
                        }
                    },
                    discount: { type: "number", description: "ส่วนลดรวมหน่วยเป็นบาท" }
                },
                required: ["plate", "problem"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_job_status",
            description: "แก้ไขอัปเดตสถานะใบงานซ่อมรถในอู่",
            parameters: {
                type: "object",
                properties: {
                    jobId: { type: "string", description: "IDงานซ่อม" },
                    status: { type: "string", description: "สถานะใหม่: 'repairing', 'done', 'picked_up'" }
                },
                required: ["jobId", "status"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "add_transaction",
            description: "บันทึกบัญชีรายรับ-รายจ่ายทั่วไปหน้าร้านอิสระ",
            parameters: {
                type: "object",
                properties: {
                    type: { type: "string", description: "ใส่คำล็อกระบบ: 'income' หรือ 'expense'" },
                    category: { type: "string", description: "หมวดหมู่บัญชี" },
                    amount: { type: "number", description: "ยอดเงินสุทธิ" },
                    description: { type: "string", description: "คำอธิบายประวัติรายการบัญชี" },
                    method: { type: "string", description: "ช่องทางเงิน: 'cash', 'transfer'" }
                },
                required: ["type", "category", "amount", "description", "method"]
            }
        }
    }
];

function setupAiCoreEngine() {
    const form = document.getElementById("dynamicAiForm");
    const input = document.getElementById("dynamicAiInput");
    const sBtn = document.getElementById("dynamicAiSendBtn");
    const cMemoryBtn = document.getElementById("clearAiMemoryBtn");
    const box = document.getElementById("dynamicAiChatBox");

    if(chatHistory.length > 0 && box.children.length <= 1) {
        chatHistory.forEach(msg => {
            if(msg.content) {
                appendAiMessage(msg.role === "user" ? "user" : "ai", msg.content);
            }
        });
    }

    cMemoryBtn?.addEventListener("click", () => {
        if(confirm("ลูกพี่เบน ต้องการล้างความทรงจำแชททั้งหมดของ J.A.R.V.I.S หรือไม่?")) {
            chatHistory = [];
            localStorage.removeItem("ben_motor_puter_permanent_memory");
            box.innerHTML = `
                <div class="d-flex justify-content-start">
                    <div class="bg-white border rounded-3 p-2 px-3 small shadow-sm" style="max-width: 85%;">
                        🧠 ล้างความจำเสร็จเรียบร้อยครับระบบสมองกล Puter พร้อมรับงานใหม่ครับลูกพี่เบน!
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

        chatHistory.push({ role: "user", content: prompt });

        const loadingId = "ai-load-" + Date.now();
        const loadingDiv = document.createElement("div");
        loadingDiv.id = loadingId;
        loadingDiv.className = "d-flex justify-content-start text-muted small p-2";
        loadingDiv.innerHTML = `<em><i class="bi bi-robot me-1"></i> J.A.R.V.I.S กำลังสับรางเปิดบิลผ่าน Puter คลาวด์ฟรี...</em>`;
        box.appendChild(loadingDiv);
        box.scrollTop = box.scrollHeight;

        try {
            const liveSnapshot = await getLiveShopContext();
            const systemRuleInstruction = `คุณคือสุดยอดระบบสมองกล AI นามว่า J.A.R.V.I.S ผู้ควบคุมศูนย์บัญชาการระบบ POS หลังบ้านของอู่ "BEN MOTOR"
[กฎเหล็กในการคำนวณและประมวลผลคำสั่งของคุณเบน]:
1. เมื่อเปลี่ยนหรือเบิกใช้อะไหล่ที่มีอยู่ใน [ตารางสต๊อกสินค้าหน้าร้านปัจจุบัน] ให้คุณประเมินราคาตามชิ้นนั้นๆ ลงช่อง 'parts' ห้ามคิดรายการเป็นค่าแรงซ้ำซ้อนขึ้นมาเอง
2. หากไม่มีอะไหล่ชิ้นนั้นอยู่ในลิสต์คลังเลย คุณต้องวิเคราะห์ราคาตลาดกลางที่เหมาะสมยัดลงมาในพารามิเตอร์ 'unitPrice' ด้วย ห้ามคำนวณราคาสินค้าออกมาเป็น 0 ฿ เด็ดขาด!
3. คุยเป็นกันเองในสไตล์ช่างมอเตอร์ไซค์ผู้เชี่ยวชาญกับคุณเบน มีความจำย้อนหลังต่อเนื่องห้ามลืมประเด็นเด็ดขาด
${liveSnapshot}`;

            let formattedHistory = chatHistory.map(h => `${h.role === 'user' ? 'คุณเบน' : 'J.A.R.V.I.S'}: ${h.content}`).join("\n");
            const finalPuterPrompt = `${systemRuleInstruction}\n\n[ประวัติการบันทึกสนทนาย้อนหลัง]:\n${formattedHistory}\n\nคุณเบนสั่งล่าสุด: ${prompt}`;

            puter.ai.chat(finalPuterPrompt, {
                model: "gpt-4o-mini", 
                tools: aiFunctionTools
            }).then(async (response) => {
                document.getElementById(loadingId)?.remove();
                
                const msgObj = response.message || response;
                
                if (msgObj && msgObj.tool_calls && msgObj.tool_calls.length > 0) {
                    const toolCall = msgObj.tool_calls[0];
                    const fnName = toolCall.function.name;
                    const args = JSON.parse(toolCall.function.arguments);
                    
                    const today = new Date().toISOString().split("T")[0];
                    const branchId = currentProfile?.branchId || null;
                    const uid = currentUid || "autonomous-system";
                    const mechanicName = currentProfile?.displayName || "ช่างเบน";

                    // 🔴 TOOL 1: เปิดบิลซ่อมลงระบบอู่ (เวอร์ชันดักจับราคาจม 0 ฿)
                    if (fnName === "create_bill") {
                        const rawParts = args.parts || []; const rawLabor = args.laborItems || [];
                        const payMethod = args.paymentMethod || "cash";
                        let itemsArray = []; let laborArray = []; let partsTotal = 0; let laborTotal = 0;

                        for(const p of rawParts) {
                            let itemPrice = Number(p.unitPrice) || 0;
                            let itemName = p.stockName || "อะไหล่ทั่วไป";

                            // ถ้า AI ส่งไอดีสต๊อกจริงมา ให้ดึงราคาระบบกลางมาข่มทับและสั่งตัดสต๊อกจริง
                            if(p.stockId) {
                                const sRef = doc(db, "stock", p.stockId); const sSnap = await getDoc(sRef);
                                if(sSnap.exists()) {
                                    const sData = sSnap.data();
                                    itemPrice = Number(sData.salePrice) || itemPrice;
                                    itemName = sData.name || itemName;
                                    const qty = Number(p.qty) || 1;
                                    await updateDoc(sRef, { qty: Math.max(0, (Number(sData.qty)||0) - qty), updatedAt: serverTimestamp() });
                                }
                            }

                            const qty = Number(p.qty) || 1;
                            const lineTotal = qty * itemPrice;
                            partsTotal += lineTotal;

                            itemsArray.push({
                                stockId: p.stockId || "", stockName: itemName,
                                qty, unitPrice: itemPrice, lineTotal
                            });
                        }

                        for(const l of rawLabor) {
                            const price = Number(l.price) || 0; laborTotal += price;
                            laborArray.push({ name: l.name || "ค่าบริการ/ค่าแรงช่าง", price });
                        }

                        const discount = Number(args.discount) || 0;
                        const totalAmount = Math.max(0, (partsTotal + laborTotal) - discount);
                        const customerName = args.customerName || "ลูกค้าทั่วไป";

                        const jobRef = await addDoc(collection(db, "jobs"), {
                            date: today, customerName, customerPhone: args.customerPhone || "-",
                            plate: args.plate || "-", brand: args.brand || "-", model: args.model || "-", mileage: "",
                            problem: args.problem, status: "repairing", priority: args.priority || "normal",
                            paymentMethod: payMethod, mechanicName, notes: "",
                            items: itemsArray, laborItems: laborArray,
                            partsTotal, laborTotal, discount, totalAmount, branchId, isDeleted: false,
                            createdBy: uid, createdByName: mechanicName, createdAt: serverTimestamp()
                        });

                        if (totalAmount > 0 && payMethod !== 'pending') {
                            await addDoc(collection(db, "transactions"), {
                                date: today, type: "income", category: "ค่าซ่อม",
                                description: `ค่าซ่อมรถมอเตอร์ไซค์ ทะเบียน ${args.plate} (${customerName})`,
                                method: payMethod, paymentMethod: payMethod, amount: totalAmount,
                                sourceType: "job", sourceId: jobRef.id, branchId, isDeleted: false, createdAt: serverTimestamp(), createdBy: uid
                            });
                        }

                        const okReply = `🔧 **กล่อง Puter สั่งรันเปิดบิลและตัดสต๊อกสำเร็จ!**\n- ทะเบียนรถ: **${args.plate}**\n- ยอดสุทธิรวมเข้าเก๊ะเงิน: **${totalAmount.toLocaleString()} ฿**\n*(ระบบประมวลผลราคาตลาดกลางเรียบร้อย ข้อมูลเด้งเข้าหน้าแดชบอร์ดหลักแล้วครับ)*`;
                        appendAiMessage("ai", okReply);
                        chatHistory.push({ role: "assistant", content: `ทำการเปิดบิลซ่อมสำเร็จ รถทะเบียน ${args.plate} ยอดเงินสุทธิ ${totalAmount} บาทเรียบร้อย` });

                    // 🔴 TOOL 2: อัปเดตสถานะบิลงานซ่อม
                    } else if (fnName === "update_job_status") {
                        const jRef = doc(db, "jobs", args.jobId);
                        await updateDoc(jRef, { status: args.status, updatedAt: serverTimestamp() });
                        const fineLog = `✅ **เปลี่ยนสถานะใบงานสำเร็จ!** รหัสดีลงาน **${args.jobId}** อัปเดตเป็น **"${args.status}"** เรียบร้อยครับลูกพี่!`;
                        appendAiMessage("ai", fineLog);
                        chatHistory.push({ role: "assistant", content: `สับเปลี่ยนสถานะใบงานซ่อมรหัส ${args.jobId} เป็นสถานะ ${args.status} เรียบร้อย` });

                    // 🔴 TOOL 3: บันทึกงบบัญชีหน้าร้านอิสระ
                    } else if (fnName === "add_transaction") {
                        await addDoc(collection(db, "transactions"), {
                            date: today, type: args.type, category: args.category, description: args.description, method: args.method, paymentMethod: args.method, amount: Number(args.amount), sourceType: "manual", branchId, isDeleted: false, createdAt: serverTimestamp(), createdBy: uid
                        });
                        const fineReply = `💰 **บันทึกงบบัญชีหน้าร้านสำเร็จ!** รายการ **"${args.description}"** ยอดเงินสุทธิ **${args.amount} ฿** วิ่งตรงเข้าตารางการเงินเรียบร้อยครับ!`;
                        appendAiMessage("ai", fineReply);
                        chatHistory.push({ role: "assistant", content: `ลงงบบัญชีรายการ ${args.description} ยอด ${args.amount} บาท สำเร็จ` });
                    }
                } else {
                    const aiText = msgObj.content || response.text || (typeof response === 'string' ? response : "กำลังประมวลผลข้อความครับลูกพี่");
                    appendAiMessage("ai", aiText);
                    chatHistory.push({ role: "assistant", content: aiText });
                }

                if (chatHistory.length > 20) chatHistory.splice(0, 2);
                localStorage.setItem("ben_motor_puter_permanent_memory", JSON.stringify(chatHistory));

            }).catch((err) => {
                console.error("Puter AI Call Fail:", err);
                document.getElementById(loadingId)?.remove();
                appendAiMessage("ai", `❌ **ระบบคลาวด์ Puter ตอบสนองขัดข้องชั่วคราว:** ${err.message}`);
            });

        } catch (error) {
            console.error("AI Core Engine Error:", error);
            if (document.getElementById(loadingId)) document.getElementById(loadingId).remove();
            appendAiMessage("ai", `❌ **กล่องควบคุมรวนชั่วคราวหน้าร้าน:** ${error.message}`);
        } finally {
            input.disabled = false;
            sBtn.disabled = false;
            input.focus();
        }
    });

    document.getElementById("dynamicAiToggleBtn")?.addEventListener("click", () => {
        const w = document.getElementById("dynamicAiWindow");
        w?.classList.toggle("d-none");
        if(w && !w.classList.contains("d-none")) input?.focus();
    });
    
    document.getElementById("dynamicAiCloseBtn")?.addEventListener("click", () => {
        document.getElementById("dynamicAiWindow")?.classList.add("d-none");
    });
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUid = user.uid;
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) currentProfile = snap.data();
    }
});

// 🚦 สั่งรันระบบดึงสายไฟจากคลาวด์ฟรี Puter
function startEngineWithPuter() {
    if (!window.window.puter) {
        const script = document.createElement('script');
        script.src = "https://js.puter.com/v2/";
        script.onload = () => {
            injectAIWidget();
            setupAiCoreEngine();
        };
        document.head.appendChild(script);
    } else {
        injectAIWidget();
        setupAiCoreEngine();
    }
}

document.addEventListener("DOMContentLoaded", startEngineWithPuter);
