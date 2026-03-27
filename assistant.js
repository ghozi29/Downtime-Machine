// assistant.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// 🔥 Firebase
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "iotcamar.firebaseapp.com",
  databaseURL: "https://iotcamar-default-rtdb.firebaseio.com",
  projectId: "iotcamar",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 🔥 Cache data
let maintenanceData = {};
let componentData = {};

onValue(ref(db, "records"), snap => {
  maintenanceData = snap.val() || {};
});

onValue(ref(db, "components"), snap => {
  componentData = snap.val() || {};
});

// 🔥 DOM
const chatMessages = document.getElementById("chatMessages");
const input = document.getElementById("chatInput");
const typing = document.getElementById("typing");

// =====================
// 💬 UI CHAT
// =====================
function addMessage(text, sender="bot") {
  const div = document.createElement("div");
  div.className = sender === "user" ? "userMsg" : "botMsg";
  div.innerHTML = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// =====================
// 🧠 NORMALIZE TEXT
// =====================
function normalize(q) {
  return q.toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim();
}

// =====================
// 📊 ANALYTICS ENGINE
// =====================

// 🔹 downtime tertinggi
function getMaxDowntime() {
  let max = 0, machine = "-";

  Object.values(maintenanceData).forEach(i => {
    const val = parseFloat(i.downtimeTotal) || 0;
    if (val > max) {
      max = val;
      machine = i.machineName;
    }
  });

  return `🔧 Mesin dengan downtime tertinggi: <b>${machine}</b> (${max} jam)`;
}

// 🔹 MTTR
function getMTTR() {
  let total = 0, count = 0;

  Object.values(maintenanceData).forEach(i => {
    const val = parseFloat(i.repairTime);
    if (!isNaN(val)) {
      total += val;
      count++;
    }
  });

  const mttr = count ? (total/count).toFixed(2) : 0;
  return `⏱ MTTR: <b>${mttr} jam</b> dari ${count} data`;
}

// 🔹 MTBF (estimasi sederhana)
function getMTBF() {
  let totalOp = 0, count = 0;

  Object.values(maintenanceData).forEach(i => {
    const val = parseFloat(i.operatingTime);
    if (!isNaN(val)) {
      totalOp += val;
      count++;
    }
  });

  const mtbf = count ? (totalOp/count).toFixed(2) : 0;
  return `📈 MTBF: <b>${mtbf} jam</b>`;
}

// 🔹 kategori terbanyak
function getTopCategory() {
  let map = {};

  Object.values(maintenanceData).forEach(i => {
    const cat = i.category || "Unknown";
    map[cat] = (map[cat] || 0) + 1;
  });

  const sorted = Object.entries(map).sort((a,b)=>b[1]-a[1]);
  return sorted.length 
    ? `📊 Kategori terbanyak: <b>${sorted[0][0]}</b> (${sorted[0][1]} kasus)`
    : "Tidak ada data kategori";
}

// 🔹 komponen sering diganti
function getTopComponent() {
  let map = {};

  Object.values(componentData).forEach(i => {
    const name = i.componentName || "Unknown";
    map[name] = (map[name] || 0) + 1;
  });

  const sorted = Object.entries(map).sort((a,b)=>b[1]-a[1]);
  return sorted.length 
    ? `🔩 Komponen paling sering diganti: <b>${sorted[0][0]}</b> (${sorted[0][1]}x)`
    : "Tidak ada data komponen";
}

// 🔹 total downtime
function getTotalDowntime() {
  let total = 0;

  Object.values(maintenanceData).forEach(i => {
    total += parseFloat(i.downtimeTotal) || 0;
  });

  return `⚠️ Total downtime: <b>${total} jam</b>`;
}

// 🔹 jumlah kejadian
function getTotalCase() {
  return `📌 Total kejadian maintenance: <b>${Object.keys(maintenanceData).length}</b>`;
}

// =====================
// 🤖 RULE ENGINE (RATUSAN VARIASI)
// =====================
function analyzeQuestion(q) {

  q = normalize(q);

  // 🔥 keyword groups
  const rules = [

    {
      keywords: ["downtime tertinggi", "mesin terparah", "paling lama mati"],
      action: getMaxDowntime
    },

    {
      keywords: ["mttr", "repair rata", "perbaikan rata"],
      action: getMTTR
    },

    {
      keywords: ["mtbf", "operating rata", "keandalan"],
      action: getMTBF
    },

    {
      keywords: ["kategori terbanyak", "kerusakan terbanyak"],
      action: getTopCategory
    },

    {
      keywords: ["komponen sering", "sparepart sering", "penggantian"],
      action: getTopComponent
    },

    {
      keywords: ["total downtime", "jumlah downtime"],
      action: getTotalDowntime
    },

    {
      keywords: ["total kasus", "jumlah kejadian"],
      action: getTotalCase
    }

  ];

  // 🔥 matching pintar
  for (let rule of rules) {
    for (let key of rule.keywords) {
      if (q.includes(key)) {
        return rule.action();
      }
    }
  }

  // 🔥 fallback pintar
  return smartInsight();
}

// =====================
// 🧠 SMART FALLBACK
// =====================
function smartInsight() {

  return `
  🤖 Saya tidak menemukan pertanyaan spesifik.<br><br>
  
  Coba tanyakan seperti:<br>
  • downtime tertinggi<br>
  • mttr<br>
  • kategori terbanyak<br><br>
  
  Atau tulis lebih detail ya 👌
  `;
}

// =====================
// 🚀 MAIN
// =====================
window.askAI = function() {

  const question = input.value.trim();
  if (!question) return;

  addMessage(question, "user");
  input.value = "";

  typing.style.display = "block";

  setTimeout(() => {
    typing.style.display = "none";

    const answer = analyzeQuestion(question);
    addMessage(answer, "bot");

  }, 500);
};
