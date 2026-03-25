// ================== app.js ==================
import { db } from "./firebase-config.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import Chart from "https://cdn.jsdelivr.net/npm/chart.js";

// ===== GLOBAL VARIABLES =====
let allMaintenanceRecords = [];
let allComponentRecords = [];
let currentArea = "hormon";
let charts = {};

// ===== DOMContentLoaded =====
document.addEventListener('DOMContentLoaded', () => {
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

  // Initial load
  loadAllData();
});

// ===== LOAD ALL DATA =====
function loadAllData() {
  showLoading(true);

  // Load maintenance records
  onValue(ref(db, 'records'), snapshot => {
    allMaintenanceRecords = [];
    snapshot.forEach(child => {
      const r = child.val();
      if (r.area === currentArea) {
        r.id = child.key;
        allMaintenanceRecords.push(r);
      }
    });

    // Load components
    onValue(ref(db, 'components'), compSnap => {
      allComponentRecords = [];
      compSnap.forEach(child => {
        allComponentRecords.push(child.val());
      });

      computeAllKPIs();
      renderAllCharts();
      showLoading(false);
    }, { onlyOnce: true });

  }, { onlyOnce: true });
}

// ===== COMPUTE KPI =====
function computeAllKPIs() {
  const period = document.getElementById("periodFilter").value;
  const { startDate, endDate } = getPeriodDates(period);

  const filteredRecords = allMaintenanceRecords.filter(r => {
    if (!r.failureStart) return false;
    const d = new Date(r.failureStart);
    return d >= startDate && d <= endDate;
  });

  let totalRepair = 0, totalOperating = 0, totalDowntime = 0;
  filteredRecords.forEach(r => {
    if (r.operationStart && r.failureStart && r.maintenanceStart && r.maintenanceEnd) {
      const op = new Date(r.operationStart);
      const fail = new Date(r.failureStart);
      const mStart = new Date(r.maintenanceStart);
      const mEnd = new Date(r.maintenanceEnd);
      totalRepair += (mEnd - mStart) / 3600000;
      totalOperating += (fail - op) / 3600000;
      totalDowntime += (mEnd - fail) / 3600000;
    } else if (r.downtimeTotal) totalDowntime += r.downtimeTotal;
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
  document.getElementById("periodDisplay").innerText = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;

  renderMTTFTable();
}

// ===== CALCULATE MTTF =====
function calculateMTTFFromComponents() {
  if (!allComponentRecords.length) return 0;
  let total = 0, count = 0;
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

// ===== RENDER MTTF TABLE =====
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
    let totalLife = 0, totalOp = 0;
    recs.forEach(r => {
      if (r.installDate && r.replacementDate) totalLife += (new Date(r.replacementDate) - new Date(r.installDate)) / 3600000;
      else if (r.lifespanHours) totalLife += r.lifespanHours;
      if (r.operatingHours) totalOp += r.operatingHours;
    });
    const avgLife = totalLife / recs.length;
    html += `<tr><td>${name}</td><td>${recs.length}</td><td>${avgLife.toFixed(2)}</td><td>${totalOp.toFixed(2)}</td></tr>`;
  });
  tbody.innerHTML = html;
}

// ===== GET PERIOD DATES =====
function getPeriodDates(period) {
  const now = new Date();
  let start = new Date(), end = new Date();
  switch(period){
    case "today": start = new Date(now); end = new Date(now); break;
    case "week": const day = now.getDay(); start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day); end = new Date(now); break;
    case "month": start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth()+1,0); break;
    case "3months": start = new Date(now.getFullYear(), now.getMonth()-2,1); end = new Date(now.getFullYear(), now.getMonth()+1,0); break;
    case "6months": start = new Date(now.getFullYear(), now.getMonth()-5,1); end = new Date(now.getFullYear(), now.getMonth()+1,0); break;
    case "year": start = new Date(now.getFullYear(),0,1); end = new Date(now.getFullYear(),11,31); break;
    default: start = new Date(2000,0,1); end = now;
  }
  start.setHours(0,0,0,0); end.setHours(23,59,59,999);
  return {startDate:start,endDate:end};
}

// ===== RENDER CHARTS =====
function renderAllCharts() {
  renderPieChart();
  renderBarChart();
  renderLineChart();
  renderParetoChart();
}

// PIE CHART
function renderPieChart() {
  const ctx = document.getElementById("pieChart")?.getContext("2d");
  if (!ctx) return;
  const data = {};
  allMaintenanceRecords.forEach(r => { const cat = r.category||"Lainnya"; data[cat]=(data[cat]||0)+1; });
  if (charts.pie) charts.pie.destroy();
  charts.pie = new Chart(ctx, {type:'pie', data:{labels:Object.keys(data), datasets:[{data:Object.values(data), backgroundColor:['#4caf50','#ff9800','#f44336','#2196f3','#9c27b0']}]}, options:{responsive:true}});
}

// BAR CHART
function renderBarChart() {
  const ctx = document.getElementById("barChart")?.getContext("2d");
  if (!ctx) return;
  const data = {};
  allMaintenanceRecords.forEach(r => { const m=r.machineName||"Unknown"; data[m]=(data[m]||0)+(r.downtimeTotal||0); });
  if (charts.bar) charts.bar.destroy();
  charts.bar = new Chart(ctx, {type:'bar', data:{labels:Object.keys(data), datasets:[{label:'Downtime (Jam)',data:Object.values(data),backgroundColor:'#4caf50'}]}, options:{responsive:true}});
}

// LINE CHART
function renderLineChart() {
  const ctx = document.getElementById("lineChart")?.getContext("2d");
  if (!ctx) return;
  const data = {};
  allMaintenanceRecords.forEach(r => { 
    if(r.failureStart){ 
      const d=new Date(r.failureStart); 
      const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; 
      data[k]=(data[k]||0)+(r.downtimeTotal||0); 
    }
  });
  if (charts.line) charts.line.destroy();
  charts.line = new Chart(ctx,{type:'line',data:{labels:Object.keys(data).sort(), datasets:[{label:'Downtime per Bulan',data:Object.values(data),borderColor:'#f44336',backgroundColor:'rgba(244,67,54,0.1)',tension:0.4}]}, options:{responsive:true}});
}

// PARETO CHART
function renderParetoChart(){
  const ctx = document.getElementById("paretoChart")?.getContext("2d");
  if(!ctx) return;
  const data = {};
  allMaintenanceRecords.forEach(r=>{ const m=r.machineName||"Unknown"; data[m]=(data[m]||0)+(r.downtimeTotal||0); });
  const sorted = Object.entries(data).sort((a,b)=>b[1]-a[1]);
  if(charts.pareto) charts.pareto.destroy();
  charts.pareto = new Chart(ctx,{type:'bar',data:{labels:sorted.map(e=>e[0]), datasets:[{label:'Downtime (Jam)',data:sorted.map(e=>e[1]),backgroundColor:'#ff9800'}]}, options:{responsive:true}});
}

// ===== LOADING OVERLAY =====
function showLoading(show){ const l=document.getElementById("loadingOverlay"); if(l) l.style.display=show?"flex":"none";}

// ===== FIREBASE CONNECTION STATUS =====
onValue(ref(db, '.info/connected'), snap => {
  console.log("Firebase connected?", snap.val());
});
