import { db } from "./firebase-config.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
// Tambahkan di awal app.js
import { db } from "./firebase-config.js";
import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Test koneksi
console.log("Mencoba koneksi ke Firebase...");
const testRef = ref(db, '.info/connected');
onValue(testRef, (snap) => {
  console.log("Status koneksi:", snap.val() ? "TERHUBUNG" : "TIDAK TERHUBUNG");
});

// Cek apakah path area/hormon/records ada
const recordsRef = ref(db, "area/hormon/records");
get(recordsRef).then((snapshot) => {
  console.log("Data records:", snapshot.exists() ? snapshot.val() : "TIDAK ADA DATA");
  console.log("Jumlah records:", snapshot.size);
}).catch(error => {
  console.error("Error membaca data:", error);
});

// Global variables
let allMaintenanceRecords = [];
let allComponentRecords = [];
let currentArea = "hormon";
let charts = {};

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  // Register Chart.js plugin
  if (window.Chart && window.ChartDataLabels) {
    Chart.register(ChartDataLabels);
  }
  
  // Setup area selector
  const areaSelect = document.getElementById("areaSelect");
  if (areaSelect) {
    areaSelect.addEventListener("change", (e) => {
      currentArea = e.target.value;
      document.getElementById("areaDisplay").innerText = 
        areaSelect.options[areaSelect.selectedIndex].text;
      loadAllData();
    });
  }
  
  // Setup period filter
  setupPeriodFilter();
  
  // Load initial data
  loadAllData();
});

// ================= LOAD ALL DATA =================
function loadAllData() {
  // Show loading
  showLoading(true);
  
  // Load maintenance records
  onValue(ref(db, `area/${currentArea}/records`), (snapshot) => {
    allMaintenanceRecords = [];
    snapshot.forEach(child => {
      let record = child.val();
      record.id = child.key;
      allMaintenanceRecords.push(record);
    });
    
    // Load component records
    onValue(ref(db, `area/${currentArea}/components`), (compSnapshot) => {
      allComponentRecords = [];
      compSnapshot.forEach(child => {
        let comp = child.val();
        comp.id = child.key;
        allComponentRecords.push(comp);
      });
      
      // Compute all KPIs with correct formulas
      computeAllKPIs();
      
      // Render all charts
      renderAllCharts();
      
      // Hide loading
      showLoading(false);
    }, { onlyOnce: true });
  }, { onlyOnce: true });
}

// ================= COMPUTE KPI WITH CORRECT FORMULAS =================
function computeAllKPIs() {
  // Get current period filter
  const periodFilter = document.getElementById("periodFilter")?.value || "month";
  const { startDate, endDate } = getPeriodDates(periodFilter);
  
  // Filter records by date
  const filteredRecords = allMaintenanceRecords.filter(record => {
    if (!record.failureStart) return false;
    const recordDate = new Date(record.failureStart);
    return recordDate >= startDate && recordDate <= endDate;
  });
  
  // If no records, show zeros
  if (filteredRecords.length === 0) {
    document.getElementById("mttr").innerText = "0 Jam";
    document.getElementById("mtbf").innerText = "0 Jam";
    document.getElementById("mttf").innerText = "0 Jam";
    document.getElementById("availability").innerText = "0%";
    document.getElementById("totalDowntime").innerText = "0";
    document.getElementById("totalBreakdown").innerText = "0";
    return;
  }
  
  // Calculate metrics from the 4 timestamps
  let totalRepairTime = 0;
  let totalResponseTime = 0;
  let totalDowntime = 0;
  let totalOperatingTime = 0;
  let failureCount = filteredRecords.length;
  
  filteredRecords.forEach(record => {
    // Pastikan semua timestamp ada
    if (record.operationStart && record.failureStart && 
        record.maintenanceStart && record.maintenanceEnd) {
      
      const opStart = new Date(record.operationStart);
      const failStart = new Date(record.failureStart);
      const maintStart = new Date(record.maintenanceStart);
      const maintEnd = new Date(record.maintenanceEnd);
      
      // Hitung waktu dalam jam
      const repairTime = (maintEnd - maintStart) / (1000 * 60 * 60);
      const responseTime = (maintStart - failStart) / (1000 * 60 * 60);
      const downtime = (maintEnd - failStart) / (1000 * 60 * 60);
      const operatingTime = (failStart - opStart) / (1000 * 60 * 60);
      
      totalRepairTime += repairTime;
      totalResponseTime += responseTime;
      totalDowntime += downtime;
      totalOperatingTime += operatingTime;
    } else if (record.downtimeHours) {
      // Fallback untuk data lama
      totalDowntime += record.downtimeHours;
      // Asumsi repair time = downtime (tidak akurat)
      totalRepairTime += record.downtimeHours * 0.8; // Estimasi kasar
    }
  });
  
  // Hitung total periode (dalam jam)
  const totalPeriodHours = (endDate - startDate) / (1000 * 60 * 60);
  
  // RUMUS YANG BENAR:
  // 1. MTTR = Total Repair Time / Jumlah Kejadian
  const MTTR = totalRepairTime / failureCount;
  
  // 2. MTBF = Total Operating Time / Jumlah Kejadian
  const MTBF = totalOperatingTime / failureCount;
  
  // 3. MTTF - Dihitung dari data komponen terpisah
  const MTTF = calculateMTTFFromComponents();
  
  // 4. Availability = (Total Period - Total Downtime) / Total Period
  const availability = ((totalPeriodHours - totalDowntime) / totalPeriodHours) * 100;
  
  // Update DOM
  document.getElementById("mttr").innerText = MTTR.toFixed(2) + " Jam";
  document.getElementById("mtbf").innerText = MTBF.toFixed(2) + " Jam";
  document.getElementById("mttf").innerText = MTTF.toFixed(2) + " Jam";
  document.getElementById("availability").innerText = availability.toFixed(2) + "%";
  document.getElementById("totalDowntime").innerText = totalDowntime.toFixed(2);
  document.getElementById("totalBreakdown").innerText = failureCount;
  
  // Update period display
  document.getElementById("periodDisplay").innerText = 
    `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
  
  // Render MTTF table
  renderMTTFTable();
}

// ================= CALCULATE MTTF FROM COMPONENTS =================
function calculateMTTFFromComponents() {
  if (allComponentRecords.length === 0) return 0;
  
  let totalLifespan = 0;
  let componentCount = 0;
  
  allComponentRecords.forEach(comp => {
    if (comp.installDate && comp.replacementDate) {
      const install = new Date(comp.installDate);
      const replace = new Date(comp.replacementDate);
      const lifespanHours = (replace - install) / (1000 * 60 * 60);
      totalLifespan += lifespanHours;
      componentCount++;
    }
  });
  
  return componentCount > 0 ? totalLifespan / componentCount : 0;
}

// ================= RENDER MTTF TABLE =================
function renderMTTFTable() {
  const tbody = document.getElementById("mttfTableBody");
  if (!tbody) return;
  
  if (allComponentRecords.length === 0) {
    tbody.innerHTML = "<tr><td colspan='3'>Belum ada data komponen</td></tr>";
    return;
  }
  
  // Group by component name
  const componentGroups = {};
  allComponentRecords.forEach(comp => {
    if (!componentGroups[comp.componentName]) {
      componentGroups[comp.componentName] = [];
    }
    componentGroups[comp.componentName].push(comp);
  });
  
  let html = "";
  for (const [compName, records] of Object.entries(componentGroups)) {
    let totalLifespan = 0;
    records.forEach(r => {
      if (r.installDate && r.replacementDate) {
        const install = new Date(r.installDate);
        const replace = new Date(r.replacementDate);
        totalLifespan += (replace - install) / (1000 * 60 * 60);
      }
    });
    const avgLifespan = totalLifespan / records.length;
    
    html += `
      <tr>
        <td>${compName}</td>
        <td>${avgLifespan.toFixed(2)} Jam</td>
        <td>${records.length} kali</td>
      </tr>
    `;
  }
  
  tbody.innerHTML = html;
}

// ================= PERIOD HELPER =================
function getPeriodDates(period) {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date();
  
  switch(period) {
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case "3months":
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case "6months":
      startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case "year":
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }
  
  // Set to beginning/end of day
  startDate.setHours(0,0,0,0);
  endDate.setHours(23,59,59,999);
  
  return { startDate, endDate };
}

// ================= SETUP PERIOD FILTER =================
function setupPeriodFilter() {
  const periodFilter = document.getElementById("periodFilter");
  const customRange = document.getElementById("customDateRange");
  
  if (periodFilter) {
    periodFilter.addEventListener("change", () => {
      if (periodFilter.value === "custom") {
        customRange.style.display = "flex";
      } else {
        customRange.style.display = "none";
        computeAllKPIs();
        renderAllCharts();
      }
    });
  }
  
  const applyCustom = document.getElementById("applyCustomFilter");
  if (applyCustom) {
    applyCustom.addEventListener("click", () => {
      computeAllKPIs();
      renderAllCharts();
    });
  }
}

// ================= RENDER ALL CHARTS =================
function renderAllCharts() {
  renderPieChart();
  renderParetoChart();
  renderBarChart();
  renderRankChart();
  renderLineChart();
}

function renderPieChart() {
  const ctx = document.getElementById("pieChart")?.getContext("2d");
  if (!ctx) return;
  
  // Group by category
  const categories = {};
  allMaintenanceRecords.forEach(record => {
    const cat = record.category || "Lainnya";
    categories[cat] = (categories[cat] || 0) + 1;
  });
  
  if (Object.keys(categories).length === 0) return;
  
  // Destroy existing chart
  if (charts.pie) charts.pie.destroy();
  
  charts.pie = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: Object.keys(categories),
      datasets: [{
        data: Object.values(categories),
        backgroundColor: ['#4caf50', '#ff9800', '#f44336', '#2196f3', '#9c27b0']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        datalabels: {
          formatter: (value, ctx) => {
            let sum = ctx.dataset.data.reduce((a,b) => a + b, 0);
            let percentage = ((value / sum) * 100).toFixed(1) + "%";
            return percentage;
          },
          color: '#fff',
          font: { weight: 'bold' }
        }
      }
    }
  });
}

function renderParetoChart() {
  // Implementasi pareto chart
  // Sederhanakan dulu
}

function renderBarChart() {
  const ctx = document.getElementById("barChart")?.getContext("2d");
  if (!ctx) return;
  
  // Group by machine
  const machines = {};
  allMaintenanceRecords.forEach(record => {
    const machine = record.machineName || "Unknown";
    machines[machine] = (machines[machine] || 0) + (record.downtimeHours || 0);
  });
  
  if (Object.keys(machines).length === 0) return;
  
  if (charts.bar) charts.bar.destroy();
  
  charts.bar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(machines),
      datasets: [{
        label: 'Downtime (Jam)',
        data: Object.values(machines),
        backgroundColor: '#4caf50'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function renderRankChart() {
  // Similar to bar chart but sorted
}

function renderLineChart() {
  const ctx = document.getElementById("lineChart")?.getContext("2d");
  if (!ctx) return;
  
  // Group by month
  const monthlyData = {};
  allMaintenanceRecords.forEach(record => {
    if (record.failureStart) {
      const date = new Date(record.failureStart);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + (record.downtimeHours || 0);
    }
  });
  
  if (Object.keys(monthlyData).length === 0) return;
  
  if (charts.line) charts.line.destroy();
  
  charts.line = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Object.keys(monthlyData).sort(),
      datasets: [{
        label: 'Total Downtime per Bulan',
        data: Object.values(monthlyData),
        borderColor: '#f44336',
        backgroundColor: 'rgba(244,67,54,0.1)',
        tension: 0.4
      }]
    },
    options: {
      responsive: true
    }
  });
}

// ================= UTILITIES =================
function showLoading(show) {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) {
    overlay.style.display = show ? "flex" : "none";
  }
}

// Export functions to window for HTML onclick
window.showTab = function(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  
  document.getElementById(`tab-${tabName}`).classList.add('active');
  event.target.classList.add('active');
}