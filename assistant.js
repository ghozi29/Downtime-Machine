// assistant.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// 🔥 Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "iotcamar.firebaseapp.com",
  databaseURL: "https://iotcamar-default-rtdb.firebaseio.com",
  projectId: "iotcamar",
  storageBucket: "iotcamar.appspot.com",
  messagingSenderId: "878187768527",
  appId: "1:878187768527:web:e5c6412e811b15251825ba"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 🔥 Cache data
let maintenanceData = {};
let componentData = {};

// 🔥 Load data realtime
onValue(ref(db, "records"), (snap) => {
  maintenanceData = snap.val() || {};
});

onValue(ref(db, "components"), (snap) => {
  componentData = snap.val() || {};
});

// 🔥 DOM
const chatMessages = document.getElementById("chatMessages");
const input = document.getElementById("chatInput");
const typing = document.getElementById("typing");

// =============================
// 💬 CHAT UI
// =============================
function addMessage(text, sender = "bot") {
  const div = document.createElement("div");
  div.className = sender === "user" ? "userMsg" : "botMsg";
  div.innerHTML = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// =============================
// 🧠 AI LOGIC
// =============================
function analyzeQuestion(q) {
  q = q.toLowerCase();

  // 🔹 Downtime tertinggi
  if (q.includes("downtime")) {
    let max = 0;
    let machine = "-";

    Object.values(maintenanceData).forEach(item => {
      const dt = parseFloat(item.downtimeTotal) || 0;
      if (dt > max) {
        max = dt;
        machine = item.machineName;
      }
    });

    return `Mesin dengan downtime tertinggi adalah <b>${machine}</b> dengan total <b>${max} jam</b>.`;
  }

  // 🔹 MTTR
  if (q.includes("mttr")) {
    let total = 0;
    let count = 0;

    Object.values(maintenanceData).forEach(item => {
      const val = parseFloat(item.repairTime);
      if (!isNaN(val)) {
        total += val;
        count++;
      }
    });

    const mttr = count ? (total / count).toFixed(2) : 0;
    return `MTTR saat ini adalah <b>${mttr} jam</b> berdasarkan ${count} data.`;
  }

  // 🔹 kategori terbanyak
  if (q.includes("kategori")) {
    let map = {};

    Object.values(maintenanceData).forEach(item => {
      const cat = item.category || "Unknown";
      map[cat] = (map[cat] || 0) + 1;
    });

    let top = Object.entries(map).sort((a,b)=>b[1]-a[1])[0];

    return `Kategori kerusakan terbanyak adalah <b>${top[0]}</b> dengan <b>${top[1]} kejadian</b>.`;
  }

  // 🔹 komponen sering diganti
  if (q.includes("komponen")) {
    let map = {};

    Object.values(componentData).forEach(item => {
      const name = item.componentName || "Unknown";
      map[name] = (map[name] || 0) + 1;
    });

    let top = Object.entries(map).sort((a,b)=>b[1]-a[1])[0];

    return `Komponen paling sering diganti adalah <b>${top[0]}</b> sebanyak <b>${top[1]} kali</b>.`;
  }

  // 🔹 fallback AI style
  return generateSmartInsight();
}

// =============================
// 🤖 SMART INSIGHT (AI FEEL)
// =============================
function generateSmartInsight() {

  let totalDowntime = 0;
  let totalRepair = 0;
  let count = 0;

  Object.values(maintenanceData).forEach(item => {
    totalDowntime += parseFloat(item.downtimeTotal) || 0;
    totalRepair += parseFloat(item.repairTime) || 0;
    count++;
  });

  const avgDowntime = count ? (totalDowntime / count).toFixed(2) : 0;
  const avgRepair = count ? (totalRepair / count).toFixed(2) : 0;

  return `
  Saya tidak menemukan pertanyaan spesifik, tapi ini insight dari data kamu:<br><br>
  
  • Rata-rata downtime: <b>${avgDowntime} jam</b><br>
  • Rata-rata repair time: <b>${avgRepair} jam</b><br><br>
  
  💡 Saran: lakukan preventive maintenance untuk mengurangi downtime.
  `;
}

// =============================
// 🚀 MAIN FUNCTION
// =============================
window.askAI = function () {
  const question = input.value.trim();
  if (!question) return;

  addMessage(question, "user");
  input.value = "";

  typing.style.display = "block";

  setTimeout(() => {
    typing.style.display = "none";

    const answer = analyzeQuestion(question);
    addMessage(answer, "bot");

  }, 800); // delay biar terasa AI
};
