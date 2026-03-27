import { db } from "./firebase-config.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

let records = [];
let components = [];
let charts = {};

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("applyPeriodFilter").addEventListener("click", loadData);
  loadData();
});

// ================= LOAD =================
function loadData() {
  showLoading(true);

  onValue(ref(db, "records"), snap => {
    records = [];
    snap.forEach(c => records.push(c.val()));

    onValue(ref(db, "components"), snap2 => {
      components = [];
      snap2.forEach(c => components.push(c.val()));

      const filtered = applyFilter(records);

      computeKPI(filtered);
      renderCharts(filtered);
      renderTable(filtered);

      showLoading(false);
    }, { onlyOnce: true });

  }, { onlyOnce: true });
}

// ================= FILTER =================
function applyFilter(data) {
  const period = document.getElementById("periodFilter").value;
  const now = new Date();

  return data.filter(r => {
    if (!r.timestamps?.failureStart) return false;

    const d = new Date(r.timestamps.failureStart);
    if (isNaN(d)) return false;

    switch (period) {
      case "today":
        return d.toDateString() === now.toDateString();

      case "week":
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return d >= weekAgo;

      case "month":
        return d.getMonth() === now.getMonth() &&
               d.getFullYear() === now.getFullYear();

      case "3months":
        return diffMonths(d, now) <= 3;

      case "6months":
        return diffMonths(d, now) <= 6;

      case "year":
        return d.getFullYear() === now.getFullYear();

      case "all":
      default:
        return true;
    }
  });
}

function diffMonths(d1, d2) {
  return (d2.getFullYear() - d1.getFullYear()) * 12 +
         (d2.getMonth() - d1.getMonth());
}

// ================= HELPER =================
function getDowntime(r) {
  if (!r.timestamps?.failureStart || !r.timestamps?.maintenanceEnd) return 0;

  const start = new Date(r.timestamps.failureStart);
  const end = new Date(r.timestamps.maintenanceEnd);

  if (isNaN(start) || isNaN(end)) return 0;

  return (end - start) / 3600000;
}

function getOperating(r) {
  if (!r.timestamps?.operationStart || !r.timestamps?.failureStart) return 0;

  const start = new Date(r.timestamps.operationStart);
  const end = new Date(r.timestamps.failureStart);

  if (isNaN(start) || isNaN(end)) return 0;

  return (end - start) / 3600000;
}

// ================= KPI =================
function computeKPI(data) {
  let totalRepair = 0;
  let totalOperating = 0;
  let totalDowntime = 0;

  data.forEach(r => {
    const d = getDowntime(r);
    const o = getOperating(r);

    totalDowntime += d;
    totalRepair += d;
    totalOperating += o;
  });

  const MTTR = data.length ? totalRepair / data.length : 0;
  const MTBF = data.length ? totalOperating / data.length : 0;

  let totalLife = 0;
  components.forEach(c => totalLife += c.lifespanHours || 0);
  const MTTF = components.length ? totalLife / components.length : 0;

  const availability = (totalOperating + totalDowntime)
    ? (totalOperating / (totalOperating + totalDowntime)) * 100
    : 100;

  setText("mttr", MTTR.toFixed(2));
  setText("mtbf", MTBF.toFixed(2));
  setText("mttf", MTTF.toFixed(2));
  setText("availability", availability.toFixed(2) + "%");
  setText("totalDowntime", totalDowntime.toFixed(2));
  setText("totalBreakdown", data.length);
}

// ================= TABLE =================
function renderTable(data) {
  const tbody = document.getElementById("mttfTableBody");

  if (!components.length) {
    tbody.innerHTML = `<tr><td colspan="4">Tidak ada data</td></tr>`;
    return;
  }

  let html = "";

  components.forEach(c => {
    html += `
      <tr>
        <td>${c.componentName}</td>
        <td>1</td>
        <td>${c.lifespanHours || 0}</td>
        <td>${c.lifespanHours || 0}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// ================= CHART =================
function renderCharts(data) {
  renderPie(data);
  renderBar(data);
  renderLine(data);
  renderRank(data);
}

// PIE
function renderPie(data) {
  const ctx = document.getElementById("pieChart").getContext("2d");

  const map = {};
  data.forEach(r => {
    const cat = r.category || "Other";
    map[cat] = (map[cat] || 0) + 1;
  });

  resetChart("pie");

  charts.pie = new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(map),
      datasets: [{ data: Object.values(map) }]
    }
  });
}

// BAR
function renderBar(data) {
  const ctx = document.getElementById("barChart").getContext("2d");

  const map = {};
  data.forEach(r => {
    const m = r.machineName || "Unknown";
    map[m] = (map[m] || 0) + getDowntime(r);
  });

  resetChart("bar");

  charts.bar = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(map),
      datasets: [{ data: Object.values(map) }]
    }
  });
}

// LINE
function renderLine(data) {
  const ctx = document.getElementById("lineChart").getContext("2d");

  const map = {};
  data.forEach(r => {
    if (!r.timestamps?.failureStart) return;

    const d = new Date(r.timestamps.failureStart);
    if (isNaN(d)) return;

    const key = d.toISOString().slice(0,7);
    map[key] = (map[key] || 0) + getDowntime(r);
  });

  resetChart("line");

  charts.line = new Chart(ctx, {
    type: "line",
    data: {
      labels: Object.keys(map),
      datasets: [{ data: Object.values(map) }]
    }
  });
}

// RANK / PARETO
function renderRank(data) {
  const ctx = document.getElementById("rankChart").getContext("2d");

  const map = {};
  data.forEach(r => {
    const m = r.machineName || "Unknown";
    map[m] = (map[m] || 0) + getDowntime(r);
  });

  const sorted = Object.entries(map).sort((a,b)=>b[1]-a[1]);

  resetChart("rank");

  charts.rank = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted.map(x=>x[0]),
      datasets: [{ data: sorted.map(x=>x[1]) }]
    }
  });
}

// ================= UTIL =================
function resetChart(name) {
  if (charts[name]) charts[name].destroy();
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

// ================= LOADING =================
function showLoading(show) {
  document.getElementById("loadingOverlay").style.display = show ? "flex" : "none";
}
