import { db, ref, onValue } from "./firebase-config.js";

// ================= GLOBAL VARIABLES =================
let allRecords = [];
let allComponents = [];
let currentArea = "hormon";
let charts = {};

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  console.log("Dashboard loaded");
  
  // Setup area selector
  const areaSelect = document.getElementById("areaSelect");
  if (areaSelect) {
    areaSelect.addEventListener("change", (e) => {
      currentArea = e.target.value;
      loadData();
    });
  }
  
  // Setup period filter
  document.getElementById("applyPeriodFilter")?.addEventListener("click", () => {
    computeAllKPIs();
    renderAllCharts();
  });
  
  // Load initial data
  loadData();
});

// ================= LOAD DATA =================
function loadData() {
  showLoading(true);
  
  // Load maintenance records
  const recordsRef = ref(db, `area/${currentArea}/records`);
  onValue(recordsRef, (snapshot) => {
    allRecords = [];
    snapshot.forEach(child => {
      allRecords.push({
        id: child.key,
        ...child.val()
      });
    });
    console.log(`Loaded ${allRecords.length} records`);
    
    // Load components
    const compRef = ref(db, `area/${currentArea}/components`);
    onValue(compRef, (compSnapshot) => {
      allComponents = [];
      compSnapshot.forEach(child => {
        allComponents.push({
          id: child.key,
          ...child.val()
        });
      });
      console.log(`Loaded ${allComponents.length} components`);
      
      // Update all displays
      computeAllKPIs();
      renderAllCharts();
      renderMTTFTable();
      
      showLoading(false);
      showNotification(`Data berhasil dimuat: ${allRecords.length} records, ${allComponents.length} komponen`, "success");
    }, {
      onlyOnce: true
    });
  }, {
    onlyOnce: true
  });
}

// ================= COMPUTE KPI =================
function computeAllKPIs() {
  const periodFilter = document.getElementById("periodFilter")?.value || "month";
  const { startDate, endDate } = getPeriodDates(periodFilter);
  
  // Filter records by date
  const filteredRecords = allRecords.filter(record => {
    if (!record.failureStart) return false;
    const recordDate = new Date(record.failureStart);
    return recordDate >= startDate && recordDate <= endDate;
  });
  
  if (filteredRecords.length === 0) {
    document.getElementById("mttr").innerText = "0 Jam";
    document.getElementById("mtbf").innerText = "0 Jam";
    document.getElementById("mttf").innerText = "0 Jam";
    document.getElementById("availability").innerText = "0%";
    document.getElementById("totalDowntime").innerText = "0";
    document.getElementById("totalBreakdown").innerText = "0";
    return;
  }
  
  // Calculate metrics
  let totalRepairTime = 0;
  let totalOperatingTime = 0;
  let totalDowntime = 0;
  let failureCount = filteredRecords.length;
  
  filteredRecords.forEach(record => {
    if (record.repairTime) {
      totalRepairTime += record.repairTime;
    }
    if (record.operatingTime) {
      totalOperatingTime += record.operatingTime;
    }
    if (record.downtimeTotal) {
      totalDowntime += record.downtimeTotal;
    } else if (record.downtimeHours) {
      totalDowntime += record.downtimeHours;
    }
  });
  
  // Hitung MTTR, MTBF
  const MTTR = totalRepairTime / failureCount;
  const MTBF = totalOperatingTime / failureCount;
  
  // Hitung MTTF dari komponen
  const MTTF = calculateMTTF();
  
  // Hitung Availability
  const totalPeriodHours = (endDate - startDate) / (1000 * 60 * 60);
  const availability = ((totalPeriodHours - totalDowntime) / totalPeriodHours) * 100;
  
  // Update DOM
  document.getElementById("mttr").innerHTML = MTTR.toFixed(2) + " <small>Jam</small>";
  document.getElementById("mtbf").innerHTML = MTBF.toFixed(2) + " <small>Jam</small>";
  document.getElementById("mttf").innerHTML = MTTF.toFixed(2) + " <small>Jam</small>";
  document.getElementById("availability").innerHTML = availability.toFixed(2) + "<small>%</small>";
  document.getElementById("totalDowntime").innerHTML = totalDowntime.toFixed(2) + " <small>Jam</small>";
  document.getElementById("totalBreakdown").innerHTML = failureCount + " <small>kali</small>";
}

// ================= CALCULATE MTTF =================
function calculateMTTF() {
  if (allComponents.length === 0) return 0;
  
  let totalLifespan = 0;
  allComponents.forEach(comp => {
    if (comp.lifespanHours) {
      totalLifespan += comp.lifespanHours;
    }
  });
  
  return totalLifespan / allComponents.length;
}

// ================= RENDER MTTF TABLE =================
function renderMTTFTable() {
  const tbody = document.getElementById("mttfTableBody");
  if (!tbody) return;
  
  if (allComponents.length === 0) {
    tbody.innerHTML = "<tr><td colspan='4' class='text-center'>Belum ada data komponen</td></tr>";
    return;
  }
  
  // Group by component name
  const groups = {};
  allComponents.forEach(comp => {
    const name = comp.componentName || "Unknown";
    if (!groups[name]) {
      groups[name] = {
        total: 0,
        count: 0,
        sumLifespan: 0
      };
    }
    groups[name].count++;
    groups[name].sumLifespan += comp.lifespanHours || 0;
  });
  
  let html = "";
  for (const [name, data] of Object.entries(groups)) {
    const avgLifespan = data.sumLifespan / data.count;
    html += `
      <tr>
        <td>${name}</td>
        <td>${data.count} kali</td>
        <td>${avgLifespan.toFixed(2)} Jam</td>
        <td>${data.sumLifespan.toFixed(2)} Jam</td>
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
    case "today":
      startDate = new Date(now.setHours(0,0,0,0));
      endDate = new Date(now.setHours(23,59,59,999));
      break;
    case "week":
      const first = now.getDate() - now.getDay();
      startDate = new Date(now.setDate(first));
      startDate.setHours(0,0,0,0);
      endDate = new Date(now.setDate(first + 6));
      endDate.setHours(23,59,59,999);
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
    case "3months":
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
    case "6months":
      startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
    case "year":
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      break;
    default:
      startDate = new Date(2020, 0, 1);
      endDate = new Date(2030, 11, 31);
  }
  
  return { startDate, endDate };
}

// ================= RENDER CHARTS =================
function renderAllCharts() {
  renderPieChart();
  renderBarChart();
  renderLineChart();
  renderRankChart();
}

function renderPieChart() {
  const ctx = document.getElementById("pieChart")?.getContext("2d");
  if (!ctx) return;
  
  // Group by category
  const categories = {};
  allRecords.forEach(record => {
    const cat = record.category || "Lainnya";
    categories[cat] = (categories[cat] || 0) + 1;
  });
  
  if (Object.keys(categories).length === 0) {
    ctx.canvas.parentNode.innerHTML = "<p class='text-center'>Tidak ada data</p>";
    return;
  }
  
  if (charts.pie) charts.pie.destroy();
  
  charts.pie = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: Object.keys(categories),
      datasets: [{
        data: Object.values(categories),
        backgroundColor: ['#4caf50', '#ff9800', '#f44336', '#2196f3', '#9c27b0', '#795548']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

function renderBarChart() {
  const ctx = document.getElementById("barChart")?.getContext("2d");
  if (!ctx) return;
  
  // Group by machine
  const machines = {};
  allRecords.forEach(record => {
    const machine = record.machineName || "Unknown";
    machines[machine] = (machines[machine] || 0) + (record.downtimeTotal || record.downtimeHours || 0);
  });
  
  if (Object.keys(machines).length === 0) {
    ctx.canvas.parentNode.innerHTML = "<p class='text-center'>Tidak ada data</p>";
    return;
  }
  
  if (charts.bar) charts.bar.destroy();
  
  charts.bar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(machines),
      datasets: [{
        label: 'Total Downtime (Jam)',
        data: Object.values(machines),
        backgroundColor: '#4caf50'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Jam'
          }
        }
      }
    }
  });
}

function renderLineChart() {
  const ctx = document.getElementById("lineChart")?.getContext("2d");
  if (!ctx) return;
  
  // Group by month
  const monthlyData = {};
  allRecords.forEach(record => {
    if (record.failureStart) {
      const date = new Date(record.failureStart);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + (record.downtimeTotal || record.downtimeHours || 0);
    }
  });
  
  if (Object.keys(monthlyData).length === 0) {
    ctx.canvas.parentNode.innerHTML = "<p class='text-center'>Tidak ada data</p>";
    return;
  }
  
  const sortedMonths = Object.keys(monthlyData).sort();
  
  if (charts.line) charts.line.destroy();
  
  charts.line = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sortedMonths,
      datasets: [{
        label: 'Total Downtime (Jam)',
        data: sortedMonths.map(m => monthlyData[m]),
        borderColor: '#f44336',
        backgroundColor: 'rgba(244,67,54,0.1)',
        tension: 0.4,
        fill: true
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
  const ctx = document.getElementById("rankChart")?.getContext("2d");
  if (!ctx) return;
  
  // Sort machines by downtime
  const machines = {};
  allRecords.forEach(record => {
    const machine = record.machineName || "Unknown";
    machines[machine] = (machines[machine] || 0) + (record.downtimeTotal || record.downtimeHours || 0);
  });
  
  const sorted = Object.entries(machines)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5); // Top 5 terburuk
  
  if (sorted.length === 0) {
    ctx.canvas.parentNode.innerHTML = "<p class='text-center'>Tidak ada data</p>";
    return;
  }
  
  if (charts.rank) charts.rank.destroy();
  
  charts.rank = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(s => s[0]),
      datasets: [{
        label: 'Total Downtime (Jam)',
        data: sorted.map(s => s[1]),
        backgroundColor: '#f44336'
      }]
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      plugins: {
        legend: { display: false }
      }
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

function showNotification(message, type = "info") {
  const notification = document.getElementById("notification");
  if (!notification) return;
  
  notification.className = `notification ${type}`;
  notification.innerHTML = message;
  notification.style.display = "block";
  
  setTimeout(() => {
    notification.style.display = "none";
  }, 3000);
}