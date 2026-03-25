import { db } from "./firebase-config.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import Chart from "https://cdn.jsdelivr.net/npm/chart.js";

// ================= GLOBAL =================
let allMaintenanceRecords = [];
let allComponentRecords = [];
let currentArea = "hormon";
let charts = {};

// ================= DOM READY =================
document.addEventListener("DOMContentLoaded", () => {
  // Area selector
  const areaSelect = document.getElementById("areaSelect");
  areaSelect.addEventListener("change", e => {
    currentArea = e.target.value;
    loadAllData();
  });

  // Period filter button
  const periodBtn = document.getElementById("applyPeriodFilter");
  periodBtn.addEventListener("click", () => {
    computeAllKPIs();
    renderAllCharts();
  });

  // Load initial data
  loadAllData();
});

// ================= LOAD DATA =================
function loadAllData() {
  showLoading(true);

  onValue(ref(db, `records`), snapshot => {
    allMaintenanceRecords = [];
    snapshot.forEach(child => {
      let r = child.val();
      r.id = child.key;
      if(r.area === currentArea) allMaintenanceRecords.push(r);
    });

    onValue(ref(db, `components`), compSnap => {
      allComponentRecords = [];
      compSnap.forEach(child => {
        let c = child.val();
        c.id = child.key;
        allComponentRecords.push(c);
      });

      computeAllKPIs();
      renderAllCharts();
      showLoading(false);
    }, { onlyOnce: true });

  }, { onlyOnce: true });
}

// ================= COMPUTE KPI =================
function computeAllKPIs() {
  const period = document.getElementById("periodFilter").value;
  const { startDate, endDate } = getPeriodDates(period);

  const filteredRecords = allMaintenanceRecords.filter(r => {
    const date = r.createdAt ? new Date(r.createdAt) : null;
    return date && date >= startDate && date <= endDate;
  });

  let totalRepair = 0;
  let totalOperating = 0;
  let totalDowntime = 0;

  filteredRecords.forEach(r => {
    // Jika timestamps lengkap ada
    if (r.operationStart && r.failureStart && r.maintenanceStart && r.maintenanceEnd) {
      const op = new Date(r.operationStart);
      const fail = new Date(r.failureStart);
      const mStart = new Date(r.maintenanceStart);
      const mEnd = new Date(r.maintenanceEnd);

      totalRepair += (mEnd - mStart) / 3600000;
      totalOperating += (fail - op) / 3600000;
      totalDowntime += (mEnd - fail) / 3600000;

    } else if (r.downtimeTotal) {
      // fallback pakai downtimeTotal
      totalDowntime += r.downtimeTotal;
      totalRepair += r.downtimeTotal * 0.8;
      totalOperating += r.downtimeTotal * 1.2;
    }
  });

  const MTTR = filteredRecords.length ? totalRepair / filteredRecords.length : 0;
  const MTBF = filteredRecords.length ? totalOperating / filteredRecords.length : 0;
  const MTTF = calculateMTTFFromComponents();
  const totalPeriodHours = (endDate - startDate) / 3600000;
  const availability = totalPeriodHours ? ((totalPeriodHours - totalDowntime) / totalPeriodHours) * 100 : 0;

  document.getElementById("mttr").innerText = MTTR.toFixed(2) + " Jam";
  document.getElementById("mtbf").innerText = MTBF.toFixed(2) + " Jam";
  document.getElementById("mttf").innerText = MTTF.toFixed(2) + " Jam";
  document.getElementById("availability").innerText = availability.toFixed(2) + "%";
  document.getElementById("totalDowntime").innerText = totalDowntime.toFixed(2);
  document.getElementById("totalBreakdown").innerText = filteredRecords.length;

  document.getElementById("periodDisplay").innerText =
    `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;

  renderMTTFTable();
}

// ================= MTTF =================
function calculateMTTFFromComponents() {
  if (!allComponentRecords.length) return 0;
  let total = 0;
  let count = 0;
  allComponentRecords.forEach(c => {
    if (c.installDate && c.replacementDate) {
      total += (new Date(c.replacementDate) - new Date(c.installDate)) / 3600000;
      count++;
    } else if (c.lifespanHours) {
      total += c.lifespanHours;
      count++;
    }
  });
  return count ? total / count : 0;
}

// ================= MTTF TABLE =================
function renderMTTFTable() {
  const tbody = document.getElementById("mttfTableBody");
  if (!tbody) return;
  if (!allComponentRecords.length) {
    tbody.innerHTML = "<tr><td colspan='4'>Belum ada data</td></tr>";
    return;
  }

  const groups = {};
  allComponentRecords.forEach(c => {
    if (!groups[c.componentName]) groups[c.componentName] = [];
    groups[c.componentName].push(c);
  });

  let html = "";
  Object.entries(groups).forEach(([name, recs]) => {
    let totalLife = 0;
    recs.forEach(r => {
      if (r.installDate && r.replacementDate) {
        totalLife += (new Date(r.replacementDate) - new Date(r.installDate)) / 3600000;
      } else if (r.lifespanHours) totalLife += r.lifespanHours;
    });
    const avgLife = totalLife / recs.length;
    html += `<tr><td>${name}</td><td>${recs.length}</td><td>${avgLife.toFixed(2)}</td><td>-</td></tr>`;
  });
  tbody.innerHTML = html;
}

// ================= PERIOD HELPER =================
function getPeriodDates(period) {
  const now = new Date();
  let start = new Date(), end = new Date();
  switch(period){
    case "today": start=end=new Date(now); break;
    case "week": const day=now.getDay(); start=new Date(now.getFullYear(), now.getMonth(), now.getDate()-day); end=new Date(now); break;
    case "month": start=new Date(now.getFullYear(), now.getMonth(),1); end=new Date(now.getFullYear(), now.getMonth()+1,0); break;
    case "3months": start=new Date(now.getFullYear(), now.getMonth()-2,1); end=new Date(now.getFullYear(), now.getMonth()+1,0); break;
    case "6months": start=new Date(now.getFullYear(), now.getMonth()-5,1); end=new Date(now.getFullYear(), now.getMonth()+1,0); break;
    case "year": start=new Date(now.getFullYear(),0,1); end=new Date(now.getFullYear(),11,31); break;
    case "all": start=new Date(2000,0,1); end=now; break;
    default: start=new Date(2000,0,1); end=now;
  }
  start.setHours(0,0,0,0); end.setHours(23,59,59,999);
  return {startDate:start, endDate:end};
}

// ================= CHARTS =================
function renderAllCharts() {
  renderPieChart();
  renderBarChart();
  renderLineChart();
  renderParetoChart();
}

function renderPieChart() {
  const ctx = document.getElementById("pieChart")?.getContext("2d");
  if (!ctx) return;
  const data = {};
  allMaintenanceRecords.forEach(r => { const cat=r.category||"Lainnya"; data[cat]=(data[cat]||0)+1; });
  if (charts.pie) charts.pie.destroy();
  charts.pie = new Chart(ctx, {type:'pie', data:{labels:Object.keys(data), datasets:[{data:Object.values(data), backgroundColor:['#4caf50','#ff9800','#f44336','#2196f3','#9c27b0']}]}, options:{responsive:true}});
}

function renderBarChart() {
  const ctx = document.getElementById("barChart")?.getContext("2d");
  if (!ctx) return;
  const data = {};
  allMaintenanceRecords.forEach(r => { const m=r.machineName||"Unknown"; data[m]=(data[m]||0)+(r.downtimeTotal||0); });
  if (charts.bar) charts.bar.destroy();
  charts.bar = new Chart(ctx, {type:'bar', data:{labels:Object.keys(data), datasets:[{label:'Downtime (Jam)',data:Object.values(data),backgroundColor:'#4caf50'}]}, options:{responsive:true}});
}

function renderLineChart() {
  const ctx = document.getElementById("lineChart")?.getContext("2d");
  if (!ctx) return;
  const data = {};
  allMaintenanceRecords.forEach(r => { 
    if(r.createdAt){
      const d=new Date(r.createdAt); 
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      data[key]=(data[key]||0)+(r.downtimeTotal||0);
    }
  });
  if (charts.line) charts.line.destroy();
  charts.line = new Chart(ctx,{type:'line',data:{labels:Object.keys(data).sort(),datasets:[{label:'Downtime per Bulan',data:Object.values(data),borderColor:'#f44336',backgroundColor:'rgba(244,67,54,0.1)',tension:0.4}]},options:{responsive:true}});
}

function renderParetoChart() {
  const ctx = document.getElementById("paretoChart")?.getContext("2d");
  if (!ctx) return;
  const data = {};
  allMaintenanceRecords.forEach(r => { const m=r.machineName||"Unknown"; data[m]=(data[m]||0)+(r.downtimeTotal||0); });
  const sorted = Object.entries(data).sort((a,b)=>b[1]-a[1]);
  if(charts.pareto) charts.pareto.destroy();
  charts.pareto = new Chart(ctx,{type:'bar',data:{labels:sorted.map(e=>e[0]),datasets:[{label:'Downtime (Jam)',data:sorted.map(e=>e[1]),backgroundColor:'#ff9800'}]},options:{responsive:true}});
}

// ================= UTIL =================
function showLoading(show){ const l=document.getElementById("loadingOverlay"); if(l) l.style.display=show?"flex":"none"; }
