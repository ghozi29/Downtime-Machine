// ================= IMPORT =================
import { db } from "./firebase-config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ================= INIT =================
let records = [];
let components = [];
let charts = {};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("applyPeriodFilter").addEventListener("click", loadData);
  document.getElementById("areaSelect").addEventListener("change", loadData);
  document.getElementById("exportExcel")?.addEventListener("click", exportExcel);
  loadData();
});

// ================= LOAD DATA =================
async function loadData() {
  showLoading(true);

  const selectedCategory = document.getElementById("areaSelect").value.toLowerCase().trim();

  try {
    // ambil records
    const snap = await get(ref(db, "records"));
    records = [];
    snap.forEach(c => records.push(c.val()));

    // ================= NORMALISASI DATA =================
    records = records.map(r => ({
      ...r,
      category: r.category
        ? r.category.toString().toLowerCase().trim()
        : ""
    }));

    // DEBUG: cek isi category
    console.log("=== UNIQUE CATEGORY ===");
    console.log([...new Set(records.map(r => r.category))]);

    // ambil components
    const snap2 = await get(ref(db, "components"));
    components = [];
    snap2.forEach(c => components.push(c.val()));

    // filter periode dulu
    let filtered = applyFilter(records);

    // ================= FILTER CATEGORY (FIX FINAL) =================
    if (selectedCategory !== "all") {
      filtered = filtered.filter(r => r.category === selectedCategory);
    }

    console.log("Selected:", selectedCategory);
    console.log("Filtered count:", filtered.length);

    computeKPI(filtered);
    renderCharts(filtered);
    renderTable(filtered);

  } catch (err) {
    console.error("Error load data:", err);
  }

  showLoading(false);
}

// ================= FILTER PERIODE =================
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

// ================= KPI =================
function getDowntime(r) {
  if (!r.timestamps?.failureStart || !r.timestamps?.maintenanceEnd) return 0;
  return (new Date(r.timestamps.maintenanceEnd) - new Date(r.timestamps.failureStart)) / 3600000;
}

function getOperating(r) {
  if (!r.timestamps?.operationStart || !r.timestamps?.failureStart) return 0;
  return (new Date(r.timestamps.failureStart) - new Date(r.timestamps.operationStart)) / 3600000;
}

function computeKPI(data) {
  let totalRepair = 0, totalOperating = 0, totalDowntime = 0;

  data.forEach(r => {
    const d = getDowntime(r);
    const o = getOperating(r);
    totalDowntime += d;
    totalRepair += d;
    totalOperating += o;
  });

  const MTTR = data.length ? totalRepair / data.length : 0;
  const MTBF = data.length ? totalOperating / data.length : 0;

  const totalLife = components.reduce((a, c) => a + (c.lifespanHours || 0), 0);
  const MTTF = components.length ? totalLife / components.length : 0;

  const availability =
    (totalOperating + totalDowntime)
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

  tbody.innerHTML = components.map(c => `
    <tr>
      <td>${c.componentName}</td>
      <td>1</td>
      <td>${c.lifespanHours || 0}</td>
      <td>${c.lifespanHours || 0}</td>
    </tr>
  `).join("");
}

// ================= CHARTS =================
function renderCharts(data) {
  renderPie(data);
  renderBar(data);
  renderLine(data);
  renderRank(data);
}

function resetChart(name) {
  if (charts[name]) charts[name].destroy();
}

function renderPie(data) {
  const ctx = document.getElementById("pieChart").getContext("2d");

  const map = {};
  data.forEach(r => {
    const cat = r.category || "other";
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

function renderBar(data) {
  const ctx = document.getElementById("barChart").getContext("2d");

  const map = {};
  data.forEach(r => {
    const m = r.machineName || "unknown";
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

function renderLine(data) {
  const ctx = document.getElementById("lineChart").getContext("2d");

  const map = {};
  data.forEach(r => {
    if (!r.timestamps?.failureStart) return;

    const d = new Date(r.timestamps.failureStart);
    if (isNaN(d)) return;

    const key = d.toISOString().slice(0, 7);
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

function renderRank(data) {
  const ctx = document.getElementById("rankChart").getContext("2d");

  const map = {};
  data.forEach(r => {
    const m = r.machineName || "unknown";
    map[m] = (map[m] || 0) + getDowntime(r);
  });

  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);

  resetChart("rank");

  charts.rank = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted.map(x => x[0]),
      datasets: [{ data: sorted.map(x => x[1]) }]
    }
  });
}

// ================= UTIL =================
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

function showLoading(show) {
  document.getElementById("loadingOverlay").style.display = show ? "flex" : "none";
}

// ================= EXPORT =================
function exportExcel() {
  const table = document.querySelector(".compact-table");
  const wb = XLSX.utils.table_to_book(table, { sheet: "Sheet1" });
  XLSX.writeFile(wb, "maintenance_dashboard.xlsx");
}

// ================= LOAD XLSX =================
const script = document.createElement("script");
script.src = "https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js";
document.head.appendChild(script);


/*
// ================= IMPORT =================
import { db } from "./firebase-config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ================= INIT =================
let records = [];
let components = [];
let charts = {};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("applyPeriodFilter").addEventListener("click", loadData);
  document.getElementById("areaSelect").addEventListener("change", loadData);
  document.getElementById("exportExcel")?.addEventListener("click", exportExcel);
  loadData();
});

// ================= LOAD DATA =================
async function loadData() {
  showLoading(true);

  const selectedCategory = document.getElementById("areaSelect").value;

  try {
    // ambil records
    const snap = await get(ref(db, "records"));
    records = [];
    snap.forEach(c => records.push(c.val()));

    // ambil components
    const snap2 = await get(ref(db, "components"));
    components = [];
    snap2.forEach(c => components.push(c.val()));

    // filter periode dulu
    let filtered = applyFilter(records);

    // ================= FILTER CATEGORY =================
    if (selectedCategory !== "all") {
      filtered = filtered.filter(r => {
        if (!r.category) return false;

        return r.category.toLowerCase().trim().includes(
          selectedCategory.toLowerCase().trim()
        );
      });
    }

    // DEBUG (optional)
    console.log("Selected:", selectedCategory);
    console.log("Filtered count:", filtered.length);

    computeKPI(filtered);
    renderCharts(filtered);
    renderTable(filtered);

  } catch (err) {
    console.error("Error load data:", err);
  }

  showLoading(false);
}

// ================= FILTER PERIODE =================
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

// ================= KPI =================
function getDowntime(r) {
  if (!r.timestamps?.failureStart || !r.timestamps?.maintenanceEnd) return 0;
  return (new Date(r.timestamps.maintenanceEnd) - new Date(r.timestamps.failureStart)) / 3600000;
}

function getOperating(r) {
  if (!r.timestamps?.operationStart || !r.timestamps?.failureStart) return 0;
  return (new Date(r.timestamps.failureStart) - new Date(r.timestamps.operationStart)) / 3600000;
}

function computeKPI(data) {
  let totalRepair = 0, totalOperating = 0, totalDowntime = 0;

  data.forEach(r => {
    const d = getDowntime(r);
    const o = getOperating(r);
    totalDowntime += d;
    totalRepair += d;
    totalOperating += o;
  });

  const MTTR = data.length ? totalRepair / data.length : 0;
  const MTBF = data.length ? totalOperating / data.length : 0;

  const totalLife = components.reduce((a, c) => a + (c.lifespanHours || 0), 0);
  const MTTF = components.length ? totalLife / components.length : 0;

  const availability =
    (totalOperating + totalDowntime)
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

  tbody.innerHTML = components.map(c => `
    <tr>
      <td>${c.componentName}</td>
      <td>1</td>
      <td>${c.lifespanHours || 0}</td>
      <td>${c.lifespanHours || 0}</td>
    </tr>
  `).join("");
}

// ================= CHARTS =================
function renderCharts(data) {
  renderPie(data);
  renderBar(data);
  renderLine(data);
  renderRank(data);
}

function resetChart(name) {
  if (charts[name]) charts[name].destroy();
}

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

function renderLine(data) {
  const ctx = document.getElementById("lineChart").getContext("2d");

  const map = {};
  data.forEach(r => {
    if (!r.timestamps?.failureStart) return;

    const d = new Date(r.timestamps.failureStart);
    if (isNaN(d)) return;

    const key = d.toISOString().slice(0, 7);
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

function renderRank(data) {
  const ctx = document.getElementById("rankChart").getContext("2d");

  const map = {};
  data.forEach(r => {
    const m = r.machineName || "Unknown";
    map[m] = (map[m] || 0) + getDowntime(r);
  });

  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);

  resetChart("rank");

  charts.rank = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted.map(x => x[0]),
      datasets: [{ data: sorted.map(x => x[1]) }]
    }
  });
}

// ================= UTIL =================
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

function showLoading(show) {
  document.getElementById("loadingOverlay").style.display = show ? "flex" : "none";
}

// ================= EXPORT =================
function exportExcel() {
  const table = document.querySelector(".compact-table");
  const wb = XLSX.utils.table_to_book(table, { sheet: "Sheet1" });
  XLSX.writeFile(wb, "maintenance_dashboard.xlsx");
}

// ================= LOAD XLSX =================
const script = document.createElement("script");
script.src = "https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js";
document.head.appendChild(script);
*/
