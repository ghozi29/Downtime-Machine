import { db } from "./firebase-config.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ================= GLOBAL =================
let allMaintenanceRecords = [];
let allComponentRecords = [];
let currentArea = "hormon";
let charts = {};
let notifShown = false; // untuk notif sekali lewat

// ================= INIT =================
document.addEventListener('DOMContentLoaded', () => {
  setupPeriodFilter();
  document.getElementById("areaSelect")?.addEventListener("change", e => {
    currentArea = e.target.value;
    loadAllData();
  });

  document.getElementById("applyPeriodFilter")?.addEventListener("click", () => {
    computeAllKPIs();
    renderAllCharts();
  });

  loadAllData();
});

// ================= LOAD DATA =================
function loadAllData() {
  showLoading(true);
  notifShown = false; // reset notif setiap load

  onValue(ref(db, `area/${currentArea}/records`), (snap) => {
    allMaintenanceRecords = [];
    snap.forEach(child => {
      let record = child.val();
      record.id = child.key;
      allMaintenanceRecords.push(record);
    });

    onValue(ref(db, `area/${currentArea}/components`), (compSnap) => {
      allComponentRecords = [];
      compSnap.forEach(child => {
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
  const period = document.getElementById("periodFilter")?.value || "month";
  const { startDate, endDate } = getPeriodDates(period);

  return allMaintenanceRecords.filter(r => {
    if (!r.failureStart) return false;
    const d = new Date(r.failureStart);
    return d >= startDate && d <= endDate;
  });
}

// ================= KPI =================
function computeAllKPIs() {
  const data = getFilteredRecords();

  if (!notifShown) {
    showNotification(`Jumlah data: ${data.length}`);
    notifShown = true;
  }

  if (data.length === 0) {
    ["mttr","mtbf","mttf","availability","totalDowntime","totalBreakdown"].forEach(id => {
      document.getElementById(id).innerText = "0";
    });
    return;
  }

  let totalRepair = 0, totalDowntime = 0, totalOperating = 0;

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

// ================= CHARTS =================
function renderAllCharts() {
  renderPieChart();
  renderBarChart();
  renderLineChart();
  renderParetoChart();
}

// ----- PIE -----
function renderPieChart() {
  const ctx = document.getElementById("pieChart")?.getContext("2d");
  if (!ctx) return;
  const data = getFilteredRecords();
  if (!data.length) return;

  const categories = {};
  data.forEach(r => categories[r.category||"Lainnya"] = (categories[r.category||"Lainnya"]||0)+1);

  if (charts.pie) charts.pie.destroy();

  charts.pie = new Chart(ctx, {
    type:'pie',
    data:{ labels:Object.keys(categories), datasets:[{data:Object.values(categories), backgroundColor:['#4caf50','#ff9800','#f44336','#2196f3','#9c27b0']}]}
  });
}

// ----- BAR -----
function renderBarChart() {
  const ctx = document.getElementById("barChart")?.getContext("2d");
  if (!ctx) return;
  const data = getFilteredRecords();
  if (!data.length) return;

  const machines = {};
  data.forEach(r => machines[r.machineName||"Unknown"] = (machines[r.machineName||"Unknown"]||0)+(r.downtimeHours||0));

  if (charts.bar) charts.bar.destroy();

  charts.bar = new Chart(ctx,{
    type:'bar',
    data:{ labels:Object.keys(machines), datasets:[{label:'Downtime (Jam)', data:Object.values(machines), backgroundColor:'#4caf50'}] }
  });
}

// ----- LINE -----
function renderLineChart() {
  const ctx = document.getElementById("lineChart")?.getContext("2d");
  if (!ctx) return;
  const data = getFilteredRecords();
  if (!data.length) return;

  const monthly = {};
  data.forEach(r=>{
    const d=new Date(r.failureStart);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    monthly[key]=(monthly[key]||0)+(r.downtimeHours||0);
  });

  if (charts.line) charts.line.destroy();

  charts.line=new Chart(ctx,{
    type:'line',
    data:{ labels:Object.keys(monthly).sort(), datasets:[{label:'Total Downtime', data:Object.values(monthly), borderColor:'#f44336', backgroundColor:'rgba(244,67,54,0.1)', tension:0.3}] }
  });
}

// ----- PARETO -----
function renderParetoChart() {
  const ctx = document.getElementById("paretoChart")?.getContext("2d");
  if (!ctx) return;
  const data = getFilteredRecords();
  if (!data.length) return;

  const counts = {};
  data.forEach(r=>counts[r.category||"Lainnya"]=(counts[r.category||"Lainnya"]||0)+1);

  const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const total=sorted.reduce((sum,[,v])=>sum+v,0);

  let cumulative=0;
  const labels=[], values=[], cumulativePercent=[];
  sorted.forEach(([k,v])=>{
    labels.push(k);
    values.push(v);
    cumulative+=v;
    cumulativePercent.push((cumulative/total*100).toFixed(1));
  });

  if(charts.pareto) charts.pareto.destroy();

  charts.pareto=new Chart(ctx,{
    data:{ labels, datasets:[
      {type:'bar', label:'Jumlah Breakdown', data:values, backgroundColor:'#4caf50', yAxisID:'y'},
      {type:'line', label:'Kumulatif %', data:cumulativePercent, borderColor:'#f44336', yAxisID:'y1', fill:false, tension:0.3}
    ]},
    options:{
      responsive:true,
      interaction:{mode:'index', intersect:false},
      scales:{
        y:{ type:'linear', position:'left', title:{display:true, text:'Jumlah'} },
        y1:{ type:'linear', position:'right', min:0, max:100, title:{display:true,text:'Kumulatif %'}, grid:{drawOnChartArea:false} }
      },
      plugins:{ legend:{position:'bottom'} }
    }
  });
}

// ================= UTIL =================
function showLoading(show){
  const el=document.getElementById("loadingOverlay");
  if(el) el.style.display = show?'flex':'none';
}

function showNotification(msg){
  const el=document.getElementById("notification");
  if(!el) return;
  el.innerText=msg;
  el.style.display='block';
  setTimeout(()=>el.style.display='none',3000);
}

// ================= PERIOD HELPER =================
function getPeriodDates(period){
  const now=new Date(), start=new Date(), end=new Date();
  switch(period){
    case"today": start.setHours(0,0,0,0); end.setHours(23,59,59,999); break;
    case"week": 
      const day=now.getDay();
      start.setDate(now.getDate()-day); start.setHours(0,0,0,0); end.setDate(start.getDate()+6); end.setHours(23,59,59,999);
      break;
    case"month": start=new Date(now.getFullYear(),now.getMonth(),1); end=new Date(now.getFullYear(),now.getMonth()+1,0); break;
    case"3months": start=new Date(now.getFullYear(),now.getMonth()-2,1); end=new Date(now.getFullYear(),now.getMonth()+1,0); break;
    case"6months": start=new Date(now.getFullYear(),now.getMonth()-5,1); end=new Date(now.getFullYear(),now.getMonth()+1,0); break;
    case"year": start=new Date(now.getFullYear(),0,1); end=new Date(now.getFullYear(),11,31); break;
    case"all": start=new Date(0); end=new Date(); break;
    default: start=new Date(now.getFullYear(),now.getMonth(),1); end=new Date(now.getFullYear(),now.getMonth()+1,0);
  }
  start.setHours(0,0,0,0); end.setHours(23,59,59,999);
  return {startDate:start,endDate:end};
}

// ================= PERIOD FILTER =================
function setupPeriodFilter(){
  const periodFilter=document.getElementById("periodFilter");
  periodFilter?.addEventListener("change",()=>{
    computeAllKPIs();
    renderAllCharts();
  });
}
