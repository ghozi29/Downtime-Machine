// workload.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// 🔥 Firebase
const firebaseConfig = {
   apiKey: "AIzaSyCdjG0w6QOMdYzWsqF_QZKl7yHJOrcyjbQ",
  authDomain: "iotcamar.firebaseapp.com",
  databaseURL: "https://iotcamar-default-rtdb.firebaseio.com",
  projectId: "iotcamar",
  storageBucket: "iotcamar.firebasestorage.app",
  messagingSenderId: "878187768527",
  appId: "1:878187768527:web:e5c6412e811b15251825ba",
  measurementId: "G-V40ZQ4Y9RS"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// DOM
const container = document.getElementById("workloadContainer");
const monthFilter = document.getElementById("monthFilter");

// Cache
let maintenanceData = {};
let technicians = {};

// ==========================
// 🔹 MASTER DATA TEKNISI
// Bisa dari Firebase / hardcode
// ==========================
technicians = {
  "Budi": "images/budi.jpg",
  "Andi": "images/andi.jpg",
  "Sari": "images/sari.jpg",
  "Tini": "images/tini.jpg"
};

// ==========================
// 🔹 LOAD DATA MAINTENANCE
// ==========================
onValue(ref(db, "records"), (snapshot) => {
  maintenanceData = snapshot.val() || {};
  renderWorkload();
});

// ==========================
// 🔹 FILTER BULAN
// ==========================
function filterByMonth(data) {
  const val = monthFilter.value;
  if (!val) return data;

  const [year, month] = val.split("-");

  let filtered = {};

  Object.entries(data).forEach(([key, item]) => {
    const t = item.timestamps?.failureStart;
    if (!t) return;
    const d = new Date(t);

    if (d.getFullYear() == year && (d.getMonth() + 1) == month) {
      filtered[key] = item;
    }
  });

  return filtered;
}

// ==========================
// 🔹 CALCULATE WORKLOAD PER TEKNISI
// ==========================
function calculateWorkload(filteredData) {
  const result = {};

  // Init semua teknisi
  Object.keys(technicians).forEach(name => {
    result[name] = { totalJob: 0, totalDowntime: 0, totalRepair: 0 };
  });

  // Tambahkan data dari maintenance
  Object.values(filteredData).forEach(item => {
    const name = item.technician || "Unknown";
    if (!result[name]) result[name] = { totalJob: 0, totalDowntime: 0, totalRepair: 0 };

    result[name].totalJob++;
    result[name].totalDowntime += parseFloat(item.downtimeTotal) || 0;
    result[name].totalRepair += parseFloat(item.repairTime) || 0;
  });

  return result;
}

// ==========================
// 🔹 WORKLOAD LEVEL
// ==========================
function getWorkloadLevel(job) {
  if (job >= 15) return { text: "TINGGI", class: "high" };
  if (job >= 7) return { text: "SEDANG", class: "medium" };
  return { text: "RENDAH", class: "low" };
}

// ==========================
// 🔹 RENDER UI
// ==========================
function renderWorkload() {
  const filtered = filterByMonth(maintenanceData);
  const workload = calculateWorkload(filtered);

  container.innerHTML = "";

  Object.entries(technicians).forEach(([name, photo]) => {
    const data = workload[name] || { totalJob: 0, totalDowntime: 0, totalRepair: 0 };
    const avgRepair = data.totalJob ? (data.totalRepair / data.totalJob).toFixed(2) : 0;
    const level = getWorkloadLevel(data.totalJob);

    const card = document.createElement("div");
    card.className = "card workload-card";

    card.innerHTML = `
      <h3>
        <img src="${photo || 'images/default.png'}" class="tech-photo"/> ${name}
      </h3>
      <p>📌 Total Job: <b>${data.totalJob}</b></p>
      <p>⏱ Total Repair: <b>${data.totalRepair} jam</b></p>
      <p>⚠️ Downtime: <b>${data.totalDowntime} jam</b></p>
      <p>📊 Avg Repair: <b>${avgRepair} jam</b></p>
      <p>🔥 Beban: <span class="${level.class}">${level.text}</span></p>
    `;

    container.appendChild(card);
  });
}

// ==========================
// EVENT
// ==========================
monthFilter.addEventListener("change", renderWorkload);
