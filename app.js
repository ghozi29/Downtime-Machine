// ================= FIREBASE IMPORT =================
import { db, ref, getDatabase, onValue, get } from "./firebase-config.js";
import Chart from "https://cdn.jsdelivr.net/npm/chart.js";

// ================= INITIALIZATION =================
document.addEventListener("DOMContentLoaded", async () => {
  const areaSelect = document.getElementById("areaSelect");
  const periodFilter = document.getElementById("periodFilter");
  const applyFilterBtn = document.getElementById("applyPeriodFilter");

  if (!areaSelect || !periodFilter || !applyFilterBtn) return;

  await loadDashboard(areaSelect.value, periodFilter.value);

  areaSelect.addEventListener("change", async () => {
    await loadDashboard(areaSelect.value, periodFilter.value);
  });

  applyFilterBtn.addEventListener("click", async () => {
    await loadDashboard(areaSelect.value, periodFilter.value);
  });
});

// ================= LOAD DASHBOARD =================
async function loadDashboard(area, period) {
  showLoading(true);
  try {
    const recordsObj = await getData(`area/${area}/records`);
    const componentsObj = await getData(`area/${area}/components`);

    let records = recordsObj ? Object.values(recordsObj) : [];
    let components = componentsObj ? Object.values(componentsObj) : [];

    // Filter by periode
    records = filterByPeriod(records, period);

    // ===== KPI CALCULATION =====
    const mttr = records.length
      ? average(records.map(r => r.repairTime || 0))
      : 0;

    const mtbf = calculateMTBF(records);

    const totalDowntime = records.reduce((sum, r) => {
      const start = new Date(r.failureStart);
      const end = new Date(r.maintenanceEnd);
      return sum + (end - start) / 3600000;
    }, 0);

    const totalOperating = records.reduce((sum, r) => {
      const op = new Date(r.operationStart);
      const fail = new Date(r.failureStart);
      return sum + (fail - op) / 3600000;
    }, 0);

    const availability = totalOperating + totalDowntime > 0
      ? (totalOperating / (totalOperating + totalDowntime)) * 100
      : 0;

    const mttf = components.length
      ? average(components.map(c => c.lifespanHours || 0))
      : 0;

    // Update KPI DOM
    document.getElementById("mttr").innerText = mttr.toFixed(2);
    document.getElementById("mtbf").innerText = mtbf.toFixed(2);
    document.getElementById("totalDowntime").innerText = totalDowntime.toFixed(2);
    document.getElementById("totalBreakdown").innerText = records.length;
    document.getElementById("availability").innerText = availability.toFixed(1) + "%";
    document.getElementById("mttf").innerText = mttf.toFixed(2);

    // ===== MTTF TABLE =====
    updateMTTFTable(components);

    // ===== CHARTS =====
    updateCharts(records);

  } catch (err) {
    console.error(err);
    showNotification("❌ Gagal load dashboard: " + err.message, "error");
  } finally {
    showLoading(false);
  }
}

// ================= HELPER FUNCTIONS =================
async function getData(path) {
  try {
    const snapshot = await get(ref(db, path));
    return snapshot.exists() ? snapshot.val() : null;
  } catch (err) {
    console.error("Firebase getData error:", err);
    return null;
  }
}

function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a,b)=>a+b,0)/arr.length;
}

function calculateMTBF(records) {
  if (records.length < 2) return 0;
  const sorted = records.map(r => ({
    op: new Date(r.operationStart),
    fail: new Date(r.failureStart)
  })).sort((a,b)=>a.op - b.op);

  let sum = 0;
  for (let i=1;i<sorted.length;i++) {
    sum += (sorted[i].op - sorted[i-1].fail)/3600000;
  }
  return sum / (sorted.length - 1);
}

function filterByPeriod(records, period) {
  if (period === "all") return records;
  const now = new Date();
  let startDate;

  switch(period) {
    case "today":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week":
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "3months":
      startDate = new Date(now.getFullYear(), now.getMonth()-2, 1);
      break;
    case "6months":
      startDate = new Date(now.getFullYear(), now.getMonth()-5, 1);
      break;
    case "year":
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      return records;
  }

  return records.filter(r => new Date(r.createdAt) >= startDate);
}

function updateMTTFTable(components) {
  const tbody = document.getElementById("mttfTableBody");
  if (!tbody) return;

  if (!components.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center">Tidak ada data</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  components.forEach(c => {
    const avg = c.lifespanHours ? c.lifespanHours.toFixed(2) : "-";
    tbody.innerHTML += `<tr>
      <td>${c.componentName}</td>
      <td>1</td>
      <td>${avg}</td>
      <td>${c.operatingHours?.toFixed(2) || "-"}</td>
    </tr>`;
  });
}

let pieChart, barChart, lineChart, rankChart;

function updateCharts(records) {
  const categories = {};
  const downtimePerMachine = {};
  const monthlyTrend = {};
  const paretoData = {};

  records.forEach(r => {
    categories[r.category] = (categories[r.category] || 0) + 1;
    downtimePerMachine[r.machineName] = (downtimePerMachine[r.machineName] || 0) + (r.repairTime || 0);
    
    const month = new Date(r.createdAt).toISOString().slice(0,7);
    monthlyTrend[month] = (monthlyTrend[month] || 0) + (r.repairTime || 0);

    paretoData[r.machineName] = (paretoData[r.machineName] || 0) + (r.repairTime || 0);
  });

  // Pie Chart
  const ctxPie = document.getElementById("pieChart").getContext("2d");
  if (pieChart) pieChart.destroy();
  pieChart = new Chart(ctxPie, {
    type:"pie",
    data:{
      labels:Object.keys(categories),
      datasets:[{data:Object.values(categories), backgroundColor:["#36A2EB","#FFCE56","#FF6384","#8A2BE2"]}]
    }
  });

  // Bar Chart
  const ctxBar = document.getElementById("barChart").getContext("2d");
  if (barChart) barChart.destroy();
  barChart = new Chart(ctxBar, {
    type:"bar",
    data:{
      labels:Object.keys(downtimePerMachine),
      datasets:[{label:"Downtime (jam)", data:Object.values(downtimePerMachine), backgroundColor:"#36A2EB"}]
    }
  });

  // Line Chart
  const ctxLine = document.getElementById("lineChart").getContext("2d");
  if (lineChart) lineChart.destroy();
  lineChart = new Chart(ctxLine, {
    type:"line",
    data:{
      labels:Object.keys(monthlyTrend).sort(),
      datasets:[{label:"Downtime bulanan (jam)", data:Object.keys(monthlyTrend).sort().map(m=>monthlyTrend[m]), borderColor:"#FF6384", fill:false}]
    }
  });

  // Pareto / Rank Chart
  const ctxRank = document.getElementById("rankChart").getContext("2d");
  if (rankChart) rankChart.destroy();
  const sortedPareto = Object.entries(paretoData).sort((a,b)=>b[1]-a[1]);
  rankChart = new Chart(ctxRank, {
    type:"bar",
    data:{
      labels:sortedPareto.map(e=>e[0]),
      datasets:[{label:"Downtime (jam)", data:sortedPareto.map(e=>e[1]), backgroundColor:"#FFCE56"}]
    }
  });
}

// ================= LOADING & NOTIF =================
function showLoading(show){
  const overlay = document.getElementById("loadingOverlay");
  if (!overlay) return;
  overlay.style.display = show ? "flex" : "none";
}

function showNotification(message, type="info") {
  const notification = document.getElementById("notification");
  if (!notification) return;
  notification.className = `notification ${type}`;
  notification.innerHTML = message;
  notification.style.display = "block";
  setTimeout(() => { notification.style.display = "none"; }, 5000);
}
