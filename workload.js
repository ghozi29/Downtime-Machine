// workload.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// 🔥 Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "iotcamar.firebaseapp.com",
  databaseURL: "https://iotcamar-default-rtdb.firebaseio.com",
  projectId: "iotcamar",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 🔥 DOM
const container = document.getElementById("workloadContainer");
const monthFilter = document.getElementById("monthFilter");

// 🔥 Cache
let dataCache = {};

// ==========================
// 📥 LOAD DATA
// ==========================
onValue(ref(db, "records"), (snapshot) => {
  dataCache = snapshot.val() || {};
  renderWorkload();
});

// ==========================
// 📊 PROCESS DATA
// ==========================
function calculateWorkload(data) {

  let result = {};

  Object.values(data).forEach(item => {

    const teknisi = item.technician || "Unknown";

    if (!result[teknisi]) {
      result[teknisi] = {
        totalJob: 0,
        totalDowntime: 0,
        totalRepair: 0
      };
    }

    result[teknisi].totalJob++;
    result[teknisi].totalDowntime += parseFloat(item.downtimeTotal) || 0;
    result[teknisi].totalRepair += parseFloat(item.repairTime) || 0;

  });

  return result;
}

// ==========================
// 📅 FILTER BULAN
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

    if (
      d.getFullYear() == year &&
      (d.getMonth() + 1) == month
    ) {
      filtered[key] = item;
    }

  });

  return filtered;
}

// ==========================
// 🎨 RENDER UI
// ==========================
function renderWorkload() {

  const filtered = filterByMonth(dataCache);
  const workload = calculateWorkload(filtered);

  container.innerHTML = "";

  if (!Object.keys(workload).length) {
    container.innerHTML = "<p>Tidak ada data</p>";
    return;
  }

  Object.entries(workload).forEach(([name, data]) => {

    const avgRepair = data.totalJob 
      ? (data.totalRepair / data.totalJob).toFixed(2)
      : 0;

    const level = getWorkloadLevel(data.totalJob);

    const card = document.createElement("div");
    card.className = "card workload-card";

    card.innerHTML = `
      <h3><i class="fas fa-user-cog"></i> ${name}</h3>
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
// 🔥 WORKLOAD LEVEL
// ==========================
function getWorkloadLevel(job) {

  if (job >= 15) {
    return { text: "TINGGI", class: "high" };
  } else if (job >= 7) {
    return { text: "SEDANG", class: "medium" };
  } else {
    return { text: "RENDAH", class: "low" };
  }
}

// ==========================
// 🎯 EVENT
// ==========================
monthFilter.addEventListener("change", renderWorkload);
