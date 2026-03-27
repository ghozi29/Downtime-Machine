import { db } from "./firebase-config.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import Chart from "https://cdn.jsdelivr.net/npm/chart.js";

let records = [];
let components = [];
let charts = {};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("applyPeriodFilter")
    .addEventListener("click", loadData);

  loadData();
});

// ================= LOAD DATA =================
function loadData() {
  showLoading(true);

  onValue(ref(db, "records"), snap => {
    records = [];
    snap.forEach(c => records.push(c.val()));

    onValue(ref(db, "components"), snap2 => {
      components = [];
      snap2.forEach(c => components.push(c.val()));

      computeKPI();
      renderCharts();
      renderTable();

      showLoading(false);
    }, { onlyOnce: true });

  }, { onlyOnce: true });
}

// ================= HELPER =================
function getDowntime(r) {
  if (!r.timestamps?.failureStart || !r.timestamps?.maintenanceEnd) return 0;

  const start = new Date(r.timestamps.failureStart);
  const end = new Date(r.timestamps.maintenanceEnd);

  if (isNaN(start) || isNaN(end)) return 0;

  return (end - start) / (1000 * 60 * 60); // jam
}

function getOperating(r) {
  if (!r.timestamps?.operationStart || !r.timestamps?.failureStart) return 0;

  const start = new Date(r.timestamps.operationStart);
  const end = new Date(r.timestamps.failureStart);

  if (isNaN(start) || isNaN(end)) return 0;

  return (end - start) / (1000 * 60 * 60); // jam
}

// ================= KPI =================
function computeKPI() {
  let totalRepair = 0;
  let totalOperating = 0;
  let totalDowntime = 0;

  records.forEach(r => {
    const downtime = getDowntime(r);
    const operating = getOperating(r);

    totalDowntime += downtime;
    totalRepair += downtime;
    totalOperating += operating;
  });

  const MTTR = records.length ? totalRepair / records.length : 0;
  const MTBF = records.length ? totalOperating / records.length : 0;

  let totalLife = 0;
  components.forEach(c => totalLife += c.lifespanHours || 0);
  const MTTF = components.length ? totalLife / components.length : 0;

  const availability = (totalOperating + totalDowntime)
    ? (totalOperating / (totalOperating + totalDowntime)) * 100
    : 100;

  document.getElementById("mttr").innerText = MTTR.toFixed(2);
  document.getElementById("mtbf").innerText = MTBF.toFixed(2);
  document.getElementById("mttf").innerText = MTTF.toFixed(2);
  document.getElementById("availability").innerText = availability.toFixed(2) + "%";
  document.getElementById("totalDowntime").innerText = totalDowntime.toFixed(2);
  document.getElementById("totalBreakdown").innerText = records.length;
}

// ================= TABLE =================
function renderTable() {
  const tbody = document.getElementById("mttfTableBody");

  if (!components.length) {
    tbody.innerHTML = "<tr><td colspan='3'>Tidak ada data</td></tr>";
    return;
  }

  let html = "";
  components.forEach(c => {
    html += `
      <tr>
        <td>${c.componentName}</td>
        <td>1</td>
        <td>${c.lifespanHours || 0}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// ================= CHART =================
function renderCharts() {
  renderPie();
  renderBar();
  renderLine();
  renderPareto();
}

// PIE
function renderPie() {
  const ctx = document.getElementById("pieChart").getContext("2d");

  const data = {};
  records.forEach(r => {
    const cat = r.category || "Other";
    data[cat] = (data[cat] || 0) + 1;
  });

  if (charts.pie) charts.pie.destroy();

  charts.pie = new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(data),
      datasets: [{ data: Object.values(data) }]
    }
  });
}

// BAR (downtime per machine)
function renderBar() {
  const ctx = document.getElementById("barChart").getContext("2d");

  const data = {};
  records.forEach(r => {
    const m = r.machineName || "Unknown";
    data[m] = (data[m] || 0) + getDowntime(r);
  });

  if (charts.bar) charts.bar.destroy();

  charts.bar = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(data),
      datasets: [{ data: Object.values(data) }]
    }
  });
}

// LINE (per bulan)
function renderLine() {
  const ctx = document.getElementById("lineChart").getContext("2d");

  const data = {};

  records.forEach(r => {
    if (!r.timestamps?.failureStart) return;

    const date = new Date(r.timestamps.failureStart);
    if (isNaN(date)) return;

    const key = date.toISOString().slice(0,7);

    data[key] = (data[key] || 0) + 1;
  });

  if (charts.line) charts.line.destroy();

  charts.line = new Chart(ctx, {
    type: "line",
    data: {
      labels: Object.keys(data),
      datasets: [{ data: Object.values(data) }]
    }
  });
}

// PARETO
function renderPareto() {
  const ctx = document.getElementById("paretoChart").getContext("2d");

  const data = {};
  records.forEach(r => {
    const m = r.machineName || "Unknown";
    data[m] = (data[m] || 0) + getDowntime(r);
  });

  const sorted = Object.entries(data).sort((a,b)=>b[1]-a[1]);

  if (charts.pareto) charts.pareto.destroy();

  charts.pareto = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted.map(x=>x[0]),
      datasets: [{ data: sorted.map(x=>x[1]) }]
    }
  });
}

// ================= LOADING =================
function showLoading(show) {
  document.getElementById("loadingOverlay").style.display = show ? "flex" : "none";
}
