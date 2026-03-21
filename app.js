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
let notifShown = false;

// ================= INIT =================
document.addEventListener('DOMContentLoaded', () => {
  setupPeriodFilter();
  loadAllData();

  document.getElementById("applyPeriodFilter")?.addEventListener("click", () => {
    computeAllKPIs();
    renderAllCharts();
  });

  document.getElementById("areaSelect")?.addEventListener("change", (e)=>{
    currentArea = e.target.value;
    loadAllData();
  });
});

// ================= LOAD DATA =================
function loadAllData() {
  showLoading(true);
  notifShown = false;

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

  const filtered = allMaintenanceRecords.filter(record => {
    if (!record.failureStart) return false;
    const d = new Date(record.failureStart);
    return d >= startDate && d <= endDate;
  });

  // 🔔 Tampilkan notif jumlah data sekali
  if (!notifShown) {
    showNotification(`Jumlah data setelah filter: ${filtered.length}`);
    notifShown = true;
  }

  return filtered;
}

// ================= KPI =================
function computeAllKPIs() {
  const data = getFilteredRecords();

  if (data.length === 0) {
    document.getElementById("mttr").innerText = "0 Jam";
    document.getElementById("mtbf").innerText = "0 Jam";
    document.getElementById("mttf").innerText = "0 Jam";
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
    } else if(r.downtimeTotal){
      totalDowntime += r.downtimeTotal;
      totalRepair += r.downtimeTotal*0.8; // estimasi kasar
    }
  });

  const count = data.length;
  const MTTR = totalRepair / count;
  const MTBF = totalOperating / count;
  const availability = ((totalOperating) / (totalOperating + totalDowntime)) * 100;
  const MTTF = calculateMTTFFromComponents();

  document.getElementById("mttr").innerText = MTTR.toFixed(2) + " Jam";
  document.getElementById("mtbf").innerText = MTBF.toFixed(2) + " Jam";
  document.getElementById("mttf").innerText = MTTF.toFixed(2) + " Jam";
  document.getElementById("availability").innerText = availability.toFixed(2) + "%";
  document.getElementById("totalDowntime").innerText = totalDowntime.toFixed(2);
  document.getElementById("totalBreakdown").innerText = count;

  renderMTTFTable();
}

// ================= MTTF =================
function calculateMTTFFromComponents() {
  if (allComponentRecords.length === 0) return 0;
  let totalLifespan = 0;
  let compCount = 0;
  allComponentRecords.forEach(comp => {
    if(comp.installDate && comp.replacementDate){
      const install = new Date(comp.installDate);
      const replace = new Date(comp.replacementDate);
      totalLifespan += (replace-install)/3600000;
      compCount++;
    }
  });
  return compCount>0 ? totalLifespan/compCount : 0;
}

function renderMTTFTable() {
  const tbody = document.getElementById("mttfTableBody");
  if(!tbody) return;
  if(allComponentRecords.length===0){
    tbody.innerHTML = "<tr><td colspan='4' class='text-center'>Belum ada data komponen</td></tr>";
    return;
  }

  const groups = {};
  allComponentRecords.forEach(c=>{
    if(!groups[c.componentName]) groups[c.componentName]=[];
    groups[c.componentName].push(c);
  });

  let html="";
  for(const [name, records] of Object.entries(groups)){
    let total=0;
    records.forEach(r=>{
      if(r.installDate && r.replacementDate){
        const inst = new Date(r.installDate);
        const repl = new Date(r.replacementDate);
        total += (repl-inst)/3600000;
      }
    });
    const avg = total/records.length;
    html += `<tr>
      <td>${name}</td>
      <td>${records.length}</td>
      <td>${avg.toFixed(2)} Jam</td>
      <td>${total.toFixed(2)} Jam</td>
    </tr>`;
  }
  tbody.innerHTML = html;
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
  if(!ctx) return;
  const data = getFilteredRecords();
  if(data.length===0) return;

  const categories = {};
  data.forEach(r=>{
    const key = r.category || "Lainnya";
    categories[key] = (categories[key]||0)+1;
  });

  if(charts.pie) charts.pie.destroy();
  charts.pie = new Chart(ctx,{
    type:'pie',
    data:{
      labels:Object.keys(categories),
      datasets:[{data:Object.values(categories), backgroundColor:['#4caf50','#ff9800','#f44336','#2196f3','#9c27b0']}]
    }
  });
}

function renderBarChart(){
  const ctx = document.getElementById("barChart")?.getContext("2d");
  if(!ctx) return;
  const data = getFilteredRecords();
  if(data.length===0) return;

  const machines = {};
  data.forEach(r=>{
    const m = r.machineName || "Unknown";
    machines[m] = (machines[m]||0)+(r.downtimeTotal||0);
  });

  if(charts.bar) charts.bar.destroy();
  charts.bar = new Chart(ctx,{
    type:'bar',
    data:{
      labels:Object.keys(machines),
      datasets:[{label:'Downtime (Jam)', data:Object.values(machines), backgroundColor:'#4caf50'}]
    }
  });
}

function renderLineChart(){
  const ctx = document.getElementById("lineChart")?.getContext("2d");
  if(!ctx) return;
  const data = getFilteredRecords();
  if(data.length===0) return;

  const monthly = {};
  data.forEach(r=>{
    const d = new Date(r.failureStart);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    monthly[key] = (monthly[key]||0)+(r.downtimeTotal||0);
  });

  if(charts.line) charts.line.destroy();
  charts.line = new Chart(ctx,{
    type:'line',
    data:{
      labels:Object.keys(monthly).sort(),
      datasets:[{label:'Downtime per Bulan', data:Object.values(monthly), borderColor:'#f44336', backgroundColor:'rgba(244,67,54,0.1)', tension:0.3}]
    }
  });
}

// ================= PARETO =================
function renderParetoChart(){
  const ctx = document.getElementById("paretoChart")?.getContext("2d");
  if(!ctx) return;
  const data = getFilteredRecords();
  if(data.length===0) return;

  const counts = {};
  data.forEach(r=>{
    const k = r.category || "Lainnya";
    counts[k] = (counts[k]||0)+1;
  });

  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const total = sorted.reduce((sum,[,v])=>sum+v,0);
  let cumulative=0;
  const labels=[], values=[], cumulativePercent=[];
  sorted.forEach(([k,v])=>{
    labels.push(k); values.push(v);
    cumulative+=v;
    cumulativePercent.push(((cumulative/total)*100).toFixed(1));
  });

  if(charts.pareto) charts.pareto.destroy();
  charts.pareto = new Chart(ctx,{
    data:{
      labels,
      datasets:[
        {type:'bar', label:'Jumlah Breakdown', data:values, backgroundColor:'#4caf50', yAxisID:'y'},
        {type:'line', label:'Kumulatif %', data:cumulativePercent, borderColor:'#f44336', borderWidth:2, fill:false, yAxisID:'y1'}
      ]
    },
    options:{
      responsive:true,
      scales:{
        y:{type:'linear', position:'left', title:{display:true, text:'Jumlah Kejadian'}},
        y1:{type:'linear', position:'right', min:0, max:100, title:{display:true, text:'Persentase Kumulatif (%)'}, grid:{drawOnChartArea:false}}
      }
    }
  });
}

// ================= PERIOD =================
function getPeriodDates(period){
  const now=new Date();
  let start=new Date(), end=new Date();
  switch(period){
    case"today": start=new Date(now.getFullYear(), now.getMonth(), now.getDate()); end=start; break;
    case"week": const day=now.getDay(); start=new Date(now.getFullYear(), now.getMonth(), now.getDate()-day); end=now; break;
    case"month": start=new Date(now.getFullYear(), now.getMonth(),1); end=new Date(now.getFullYear(), now.getMonth()+1,0); break;
    case"3months": start=new Date(now.getFullYear(), now.getMonth()-2,1); end=new Date(now.getFullYear(), now.getMonth()+1,0); break;
    case"6months": start=new Date(now.getFullYear(), now.getMonth()-5,1); end=new Date(now.getFullYear(), now.getMonth()+1,0); break;
    case"year": start=new Date(now.getFullYear(),0,1); end=new Date(now.getFullYear(),11,31); break;
    case"all": start=new Date(2000,0,1); end=new Date(); break;
    default: start=new Date(now.getFullYear(), now.getMonth(),1); end=new Date(now.getFullYear(), now.getMonth()+1,0);
  }
  start.setHours(0,0,0,0); end.setHours(23,59,59,999);
  return {startDate:start,endDate:end};
}

// ================= PERIOD FILTER =================
function setupPeriodFilter(){
  document.getElementById("periodFilter")?.addEventListener("change",()=>{
    computeAllKPIs();
    renderAllCharts();
  });
}

// ================= UTIL =================
function showLoading(show){
  const el=document.getElementById("loadingOverlay");
  if(el) el.style.display=show?"flex":"none";
}

function showNotification(msg){
  const el=document.getElementById("notification");
  if(!el) return;
  el.innerText=msg;
  el.style.display="block";
  setTimeout(()=>el.style.display="none",3000);
}
