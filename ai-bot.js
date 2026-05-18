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

// 🛑 รหัส API KEY ของ ChatGPT / OpenAI (ลูกพี่เบนก๊อปปี้คีย์แท้ sk-... มาวางบิดตรงนี้ได้เลยครับ)
const OPENAI_API_KEY = ""; 

let currentUid = null;
let currentProfile = null;

// 🧠 คลังความจำแชทบริสุทธิ์ (มีแค่ข้อความคุย User / Assistant) ตัดทิ้งเมื่อไหร่ก็ไม่มีวันเอ๋อ!
let chatHistory = JSON.parse(localStorage.getItem("ben_motor_openai_clean_memory") || "[]");

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
            <h6 class="mb-0 fw-bold d-flex align-items-center"><i class="bi bi-robot text-warning me-2 fs-5"></i> J.A.R.V.I.S ระบบคุมร้านระดับโลก</h6>
            <div class="d-flex align-items-center gap-2">
                <button type="button" class="btn btn-sm btn-outline-danger border-0 p-1" id="clearAiMemoryBtn" title="ล้างความจำแชท"><i class="bi bi-trash3 text-danger"></i></button>
                <button type="button" class="btn-close btn-close-white" id="dynamicAiCloseBtn"></button>
            </div>
        </div>
        <div class="card-body p-3 ai-chat-box" id="dynamicAiChatBox">
            <div class="d-flex justify-content-start">
                <div class="bg-white border rounded-3 p-2 px-3 small shadow-sm" style="max-width: 85%;">
                    สวัสดีครับลูกพี่เบน! ปลดล็อกกล่อง ECU แก้ไขปัญหาวนลูปเมมโมรี่เรียบร้อย สั่งเปิดบิล คุมคลัง เช็คเงินระบบเสถียร 100% เลยครับ! 🔧🤖
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

// 🧠 ฟังก์ชันดึงพิกัดสต๊อกสินค้าเรียลไทม์หน้าร้าน
async function getLiveShopContext() {
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
    } catch (error) { console.error("Context Data Crash:", error); }
    return context;
}

// 🧠 พิมพ์เขียวตู้เครื่องมือสับรางระบบการเงินและบิลซ่อมหน้าร้านของแท้
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
                        description: "รายการอะไหล่สินค้าเบิกคลัง",
                        items: {
                            type: "object",
                            properties: {
                                stockId: { type: "string", description: "IDอะไหล่ จากตารางคลังสินค้า (ใส่เฉพาะเมื่อเจอไอดีตรงเป๊ะในระบบ)" },
                                stockName: { type: "string", description: "ชื่อเรียกอะไหล่" },
                                unitPrice: { type: "number", description: "ราคาขายหน้าร้านต่อหน่วย (ประเมินราคาตลาดกลางมาด้วย ห้ามใส่เลข 0 เด็ดขาด เช่น น้ำมันเครื่องทั่วไป 140 บาท)" },
                                qty: { type: "number", description: "จำนวนชิ้น" }
                            },
                            required: ["stockName", "unitPrice", "qty"]
                        }
                    },
                    laborItems: {
                        type: "array",
                        description: "รายการค่าแรงช่างหรือบริการซ่อมชิ้นส่วนที่ไม่มีในคลังสินค้า",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string", description: "ชื่องานบริการซ่อม เช่น ค่าแรงปะยาง" },
                                price: { type: "number", description: "ราคาค่าแรงช่างหน่วยบาท" }
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
                    status: { type: "string", description: "สถานะล็อกระบบ: 'repairing', 'done', 'picked_up'" }
                },
                required: ["jobId", "status"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "add_transaction",
            description: "บันทึกบัญชีรายรับ-รายจ่ายทั่วไปหน้าร้านอิสระที่ไม่ผ่านใบงานซ่อมรถ",
            parameters: {
                type: "object",
                properties: {
                    type: { type: "string", description: "ล็อกคำสั่ง: 'income' หรือ 'expense'" },
                    category: { type: "string", description: "หมวดหมู่บัญชี เช่น ค่าน้ำไฟ, อาหาร/เครื่องดื่ม" },
                    amount: { type: "number", description: "ยอดเงินสุทธิหน่วยบาท" },
                    description: { type: "string", description: "คำอธิบายประวัติรายการบัญชี" },
                    method: { type: "string", description: "ช่องทางเคลื่อนไหวเงิน: 'cash', 'transfer'" }
                },
                required: ["type", "category", "amount", "description", "method"]
            }
        }
    }
];

// --- 🚀 3. ระบบประมวลผลกระแสข้อมูลผ่าน OpenAI ENGINE ---
function setupAiCoreEngine() {
    const form = document.getElementById("dynamicAiForm");
    const input = document.getElementById("dynamicAiInput");
    const sBtn = document.getElementById("dynamicAiSendBtn");
    const cMemoryBtn = document.getElementById("clearAiMemoryBtn");
    const box = document.getElementById("dynamicAiChatBox");

    if(chatHistory.length > 0 && box.children.length <= 1) {
        chatHistory.forEach(msg => {
            if(msg.content && typeof msg.content === 'string') {
                appendAiMessage(msg.role === "user" ? "user" : "ai", msg.content);
            }
        });
    }

    cMemoryBtn?.addEventListener("click", () => {
        if(confirm("ลูกพี่เบน ต้องการล้างความทรงจำแชททั้งหมดของ J.A.R.V.I.S หรือไม่?")) {
            chatHistory = [];
            localStorage.removeItem("ben_motor_openai_clean_memory");
            box.innerHTML = `
                <div class="d-flex justify-content-start">
                    <div class="bg-white border rounded-3 p-2 px-3 small shadow-sm" style="max-width: 85%;">
                        🧠 ล้างประวัติความจำบริสุทธิ์เกลี้ยงตับแล้วครับ สั่งงานรันเครื่องใหม่ได้เลยครับ!
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
        loadingDiv.className = "d-flex justify-content-start text-muted small p-2 animate-pulse";
        loadingDiv.innerHTML = `<em><i class="bi bi-robot me-1"></i> J.A.R.V.I.S กำลังวิเคราะห์ข้อมูลระบบ...</em>`;
        box.appendChild(loadingDiv);
        box.scrollTop = box.scrollHeight;

        try {
            const liveSnapshot = await getLiveShopContext();
            const systemRuleInstruction = `คุณคือสุดยอดระบบสมองกล AI นามว่า J.A.R.V.I.S ผู้ควบคุมศูนย์บัญชาการระบบ POS หลังบ้านของอู่ "BEN MOTOR"
[กฎเหล็กในการคำนวณและประมวลผลคำสั่ง]:
1. เมื่อเปลี่ยนหรือเบิกใช้อะไหล่หน้าร้าน ให้ประเมินราคาขายจริงยัดลงฟิลด์ 'unitPrice' ด้วย ห้ามให้ราคาสินค้าจมเหลือ 0 ฿ เด็ดขาด!
2. ชวนคุยเล่นทางเทคนิค ตอบคำถาม และปรึกษาอาการรถมอเตอร์ไซค์ทั่วไปสไตล์ช่างผู้เชี่ยวชาญเป็นกันเองกับคุณเบน มีความจำย้อนหลังต่อเนื่องห้ามลืมเรื่องที่คุย
${liveSnapshot}`;

            // 🛠️ ปรับโฟลว์เด็ดขาด: สร้างอาเรย์สายไฟวิ่งประมวลผลแยกอิสระตัวแปรชั่วคราว ไม่เอาไปปนกับประวัติแชทกลางถาวรเด็ดขาด!
            let executionPayload = [
                { role: "system", content: systemRuleInstruction },
                ...chatHistory
            ];

            // 🚀 PASS 1: ยิงเช็กเงื่อนไขกับโรงงาน OpenAI
            const res = await fetch(`https://api.openai.com/v1/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: executionPayload,
                    tools: aiFunctionTools,
                    tool_choice: "auto"
                })
            });

            const resData = await res.json();
            if (!res.ok) throw new Error(resData.error?.message || "เชื่อมต่อระบบขัดข้อง");

            const responseMessage = resData.choices[0].message;

            // 🚨 จังหวะสับรางระบบคุมร้าน Firebase (Tool/Function Calling Loop)
            if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                // ยัดข้อความเรียก Tool ประกบลงอาเรย์ประมวลผลชั่วคราว
                executionPayload.push(responseMessage);

                const toolCall = responseMessage.tool_calls[0];
                const fnName = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);
                
                const today = new Date().toISOString().split("T")[0];
                const branchId = currentProfile?.branchId || null;
                const uid = currentUid || "autonomous-system";
                const mechanicName = currentProfile?.displayName || "ช่างเบน";

                let executionResult = { status: "error", message: "ฟังก์ชันเกิดข้อผิดพลาด" };

                // 🔴 RUN 1: เปิดบิลซ่อมลงตารางกลาง
                if (fnName === "create_bill") {
                    const rawParts = args.parts || []; const rawLabor = args.laborItems || [];
                    const payMethod = args.paymentMethod || "cash";
                    let itemsArray = []; let laborArray = []; let partsTotal = 0; let laborTotal = 0;

                    for(const p of rawParts) {
                        let itemPrice = Number(p.unitPrice) || 140; 
                        let itemName = p.stockName || "อะไหล่ทั่วไป";

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
                        itemsArray.push({ stockId: p.stockId || "", stockName: itemName, qty, unitPrice: itemPrice, lineTotal });
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
                    executionResult = { status: "success", message: `เปิดบิลสำเร็จ รถทะเบียน ${args.plate} ยอดเงินสุทธิเข้าเก๊ะคือ ${totalAmount} บาท` };

                // 🔴 RUN 2: แก้ไขสับเปลี่ยนสถานะรถ
                } else if (fnName === "update_job_status") {
                    const jRef = doc(db, "jobs", args.jobId);
                    await updateDoc(jRef, { status: args.status, updatedAt: serverTimestamp() });
                    executionResult = { status: "success", message: `เปลี่ยนรหัสใบงานซ่อม ${args.jobId} เป็นสถานะ ${args.status} เรียบร้อย` };

                // 🔴 RUN 3: ลงประวัติงบการเงินอิสระ
                } else if (fnName === "add_transaction") {
                    await addDoc(collection(db, "transactions"), {
                        date: today, type: args.type, category: args.category, description: args.description, method: args.method, paymentMethod: args.method, amount: Number(args.amount), sourceType: "manual", branchId, isDeleted: false, createdAt: serverTimestamp(), createdBy: uid
                    });
                    executionResult = { status: "success", message: `ลงประวัติบัญชี ${args.description} ยอดเงิน ${args.amount} บาท เรียบร้อยแล้ว` };
                }

                // ประกบสายไฟฝั่ง Tool Message เข้าไปในอาเรย์ชั่วคราวเพื่อส่งให้ระบบสรุปคำพูด
                executionPayload.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    name: fnName,
                    content: JSON.stringify(executionResult)
                });

                // 🚀 PASS 2: ยิงรอบสองให้สรุปคำตอบเป็นภาษาคน
                const secondRes = await fetch(`https://api.openai.com/v1/chat/completions`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${OPENAI_API_KEY}`
                    },
                    body: JSON.stringify({ model: "gpt-4o-mini", messages: executionPayload })
                });

                const secondData = await secondRes.json();
                document.getElementById(loadingId)?.remove();

                if (secondRes.ok && secondData.choices) {
                    const finalAiText = secondData.choices[0].message.content;
                    appendAiMessage("ai", finalAiText);
                    // 🧠 สำคัญที่สุด: เซฟดองเข้าคลังความจำเฉพาะ คำพูดโต้ตอบเพียวๆ เท่านั้น!
                    chatHistory.push({ role: "assistant", content: finalAiText });
                }

            } else {
                // โหมดคุยเล่น ปรึกษางานช่าง ตอบคำถามปกติ
                document.getElementById(loadingId)?.remove();
                const aiText = responseMessage.content;
                appendAiMessage("ai", aiText);
                chatHistory.push({ role: "assistant", content: aiText });
            }

            // สไลด์ความจำทิ้งแบบปลอดภัยหายห่วง 100% เพราะอาเรย์เป็นคู่บทสนทนาแท้ๆ ไม่มีวันช็อตกราวอีกต่อไป!
            if (chatHistory.length > 20) chatHistory.splice(0, 2);
            localStorage.setItem("ben_motor_openai_clean_memory", JSON.stringify(chatHistory));

        } catch (error) {
            console.error("AI Engine Crash:", error);
            document.getElementById(loadingId)?.remove();
            appendAiMessage("ai", `❌ **กล่องระบบพังชั่วคราว:** ${error.message}`);
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

document.addEventListener("DOMContentLoaded", () => {
    injectAIWidget();
    setupAiCoreEngine();
});
