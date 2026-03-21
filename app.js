import { db } from "./firebase-config.js";
import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ================= DEBUG FIREBASE =================
console.log("Mencoba koneksi ke Firebase...");
const testRef = ref(db, '.info/connected');
onValue(testRef, (snap) => {
  console.log("Status koneksi:", snap.val() ? "TERHUBUNG" : "TIDAK TERHUBUNG");
});

// ================= GLOBAL =================
let allMaintenanceRecords = [];
let allComponentRecords = [];
let currentArea = "hormon";
let charts = {};

// ================= INIT =================
document.addEventListener('DOMContentLoaded', () => {
  setupPeriodFilter();
  loadAllData();
});

// ================= LOAD DATA =================
function loadAllData() {
  showLoading(true);

  onValue(ref(db, `area/${currentArea}/records`), (snapshot) => {
    allMaintenanceRecords = [];
    snapshot.forEach(child => {
      let record = child.val();
      record.id = child.key;
      allMaintenanceRecords.push(record);
    });

    onValue(ref(db, `area/${currentArea}/components`), (compSnapshot) => {
      allComponentRecords = [];
      compSnapshot.forEach(child => {
        let comp = child.val();
        comp.id = child.key;
        allComponentRecords.push(comp);
      });

      computeAllKPIs();
      renderAllCharts();
      showLoading(false);

    }, { onlyOnce: true });

  }, { onlyOnce: true });
}

// ================= FILTER HELPER =================
function getFilteredRecords() {
  const periodFilter = document.getElementById("periodFilter")?.value || "month";
  const { startDate, endDate } = getPeriodDates(periodFilter);

  return allMaintenanceRecords.filter(record => {
    if (!record.failureStart) return false;
    const d = new Date(record.failureStart);
    return d >= startDate && d <= endDate;
  });
}

// ================= KPI =================
function computeAllKPIs() {
  const data = getFilteredRecords();

  if (data.length === 0) {
    document.getElementById("mttr").innerText = "0 Jam";
    document.getElementById("mtbf").innerText = "0 Jam";
    document.getElementById("availability").innerText = "0%";
    document.getElementById("totalDowntime").innerText = "0";
    document.getElementById("totalBreakdown").innerText = "0";
    return;
  }

  let totalRepair = 0;
  let totalDowntime = 0;
  let totalOperating = 0;

  data.forEach(r => {
    if (r.operationStart && r.failureStart && r.maintenanceStart && r.maintenanceEnd) {
      const op = new Date(r.operationStart);
      const fail = new Date(r.failureStart);
      const start = new Date(r.maintenanceStart);
      const end = new Date(r.maintenanceEnd);

      totalRepair += (end - start) / 3600000;
      totalDowntime += (end - fail) / 3600000;
      totalOperating += (fail - op) / 3600000;
    }
  });

  const count = data.length;
  const MTTR = totalRepair / count;
  const MTBF = totalOperating / count;
  const availability = ((totalOperating) / (totalOperating + totalDowntime)) * 100;

  document.getElementById("mttr").innerText = MTTR.toFixed(2) + " Jam";
  document.getElementById("mtbf").innerText = MTBF.toFixed(2) + " Jam";
  document.getElementById("availability").innerText = availability.toFixed(2) + "%";
  document.getElementById("totalDowntime").innerText = totalDowntime.toFixed(2);
  document.getElementById("totalBreakdown").innerText = count;
}

// ================= CHART MASTER =================
function renderAllCharts() {
  renderPieChart();
  renderBarChart();
  renderLineChart();
  renderParetoChart(); // 🔥 FIXED
}

// ================= PIE =================
function renderPieChart() {
  const ctx = document.getElementById("pieChart")?.getContext("2d");
  if (!ctx) return;

  const data = getFilteredRecords();
  if (data.length === 0) return;

  const categories = {};
  data.forEach(r => {
    const key = r.category || "Lainnya";
    categories[key] = (categories[key] || 0) + 1;
  });

  if (charts.pie) charts.pie.destroy();

  charts.pie = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: Object.keys(categories),
      datasets: [{
        data: Object.values(categories)
      }]
    }
  });
}

// ================= BAR =================
function renderBarChart() {
  const ctx = document.getElementById("barChart")?.getContext("2d");
  if (!ctx) return;

  const data = getFilteredRecords();
  if (data.length === 0) return;

  const machines = {};
  data.forEach(r => {
    const m = r.machineName || "Unknown";
    machines[m] = (machines[m] || 0) + (r.downtimeHours || 0);
  });

  if (charts.bar) charts.bar.destroy();

  charts.bar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(machines),
      datasets: [{
        data: Object.values(machines)
      }]
    }
  });
}

// ================= LINE =================
function renderLineChart() {
  const ctx = document.getElementById("lineChart")?.getContext("2d");
  if (!ctx) return;

  const data = getFilteredRecords();
  if (data.length === 0) return;

  const monthly = {};
  data.forEach(r => {
    const d = new Date(r.failureStart);
    const key = `${d.getFullYear()}-${d.getMonth()+1}`;
    monthly[key] = (monthly[key] || 0) + (r.downtimeHours || 0);
  });

  if (charts.line) charts.line.destroy();

  charts.line = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Object.keys(monthly),
      datasets: [{
        data: Object.values(monthly)
      }]
    }
  });
}

// ================= 🔥 PARETO FIX =================
function renderParetoChart() {
  const ctx = document.getElementById("paretoChart")?.getContext("2d");
  if (!ctx) return;

  const data = getFilteredRecords();
  console.log("Pareto data:", data);

  if (data.length === 0) {
    console.warn("Pareto kosong");
    return;
  }

  const counts = {};
  data.forEach(r => {
    const key = r.category || "Lainnya";
    counts[key] = (counts[key] || 0) + 1;
  });

  console.log("Counts:", counts);

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [, v]) => sum + v, 0);

  let cum = 0;
  const labels = [];
  const values = [];
  const cumPercent = [];

  sorted.forEach(([k, v]) => {
    labels.push(k);
    values.push(v);
    cum += v;
    cumPercent.push((cum / total) * 100);
  });

  if (charts.pareto) charts.pareto.destroy();

  charts.pareto = new Chart(ctx, {
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Jumlah',
          data: values,
          backgroundColor: '#4caf50',
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: 'Kumulatif %',
          data: cumPercent,
          borderColor: '#f44336',
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: { position: 'left' },
        y1: { position: 'right', min: 0, max: 100 }
      }
    }
  });
}

// ================= UTIL =================
function showLoading(show) {
  const el = document.getElementById("loadingOverlay");
  if (el) el.style.display = show ? "flex" : "none";
}
