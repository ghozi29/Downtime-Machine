import { getData } from "./firebase-config.js";
import Chart from "https://cdn.jsdelivr.net/npm/chart.js";

document.addEventListener("DOMContentLoaded", async () => {
  const areaSelect = document.getElementById("areaSelect");
  if (!areaSelect) return;

  await loadDashboard(areaSelect.value);

  areaSelect.addEventListener("change", async () => {
    await loadDashboard(areaSelect.value);
  });
});

async function loadDashboard(area) {
  showLoading(true);

  try {
    const recordsObj = await getData(`area/${area}/records`);
    const componentsObj = await getData(`area/${area}/components`);

    const records = recordsObj ? Object.values(recordsObj) : [];
    const components = componentsObj ? Object.values(componentsObj) : [];

    // ===== KPI =====
    const mttr = records.length > 0
      ? records.reduce((sum, r) => sum + (r.repairTime || 0), 0) / records.length
      : 0;
    document.getElementById("mttr").innerText = mttr.toFixed(2);

    // MTBF
    const sorted = records
      .map(r => ({ op: new Date(r.operationStart), fail: new Date(r.failureStart) }))
      .sort((a, b) => a.op - b.op);

    let mtbf = 0;
    if (sorted.length > 1) {
      let sum = 0;
      for (let i = 1; i < sorted.length; i++)
        sum += (sorted[i].op - sorted[i - 1].fail) / 3600000;
      mtbf = sum / (sorted.length - 1);
    }
    document.getElementById("mtbf").innerText = mtbf.toFixed(2);

    // Total downtime
    const totalDowntime = records.reduce((sum, r) => {
      return sum + (new Date(r.maintenanceEnd) - new Date(r.failureStart)) / 3600000;
    }, 0);
    document.getElementById("totalDowntime").innerText = totalDowntime.toFixed(2);

    document.getElementById("totalBreakdown").innerText = records.length;

    // Availability
    const totalOperating = records.reduce((sum, r) => {
      return sum + (new Date(r.failureStart) - new Date(r.operationStart)) / 3600000;
    }, 0);
    const availability = totalOperating + totalDowntime > 0
      ? (totalOperating / (totalOperating + totalDowntime)) * 100
      : 0;
    document.getElementById("availability").innerText = availability.toFixed(1) + "%";

    // ===== MTTF TABEL =====
    const tbody = document.getElementById("mttfTableBody");
    tbody.innerHTML = "";
    if (components.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center">Tidak ada data</td></tr>`;
    } else {
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

    // ===== CHART =====
    updateCharts(records);

  } catch (err) {
    console.error(err);
    alert("Gagal load dashboard: " + err.message);
  } finally {
    showLoading(false);
  }
}

// LOADING OVERLAY
function showLoading(show) {
  const overlay = document.getElementById("loadingOverlay");
  if (!overlay) return;
  overlay.style.display = show ? "flex" : "none";
}

// ===== CHART =====
let pieChart, barChart, lineChart, paretoChart;

function updateCharts(records) {
  const categories = {};
  const downtimePerMachine = {};
  const monthlyTrend = {};
  const paretoData = {};

  records.forEach(r => {
    categories[r.category] = (categories[r.category] || 0) + 1;
    downtimePerMachine[r.machineName] = (downtimePerMachine[r.machineName] || 0) + (r.repairTime || 0);

    // Monthly trend based on createdAt timestamp
    const date = new Date(r.createdAt);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthlyTrend[month] = (monthlyTrend[month] || 0) + (r.repairTime || 0);

    paretoData[r.machineName] = (paretoData[r.machineName] || 0) + (r.repairTime || 0);
  });

  // PIE CHART
  const ctxPie = document.getElementById("pieChart")?.getContext("2d");
  if (ctxPie) {
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(ctxPie, {
      type: "pie",
      data: {
        labels: Object.keys(categories),
        datasets: [{
          data: Object.values(categories),
          backgroundColor: ["#36A2EB", "#FFCE56", "#FF6384", "#8A2BE2"]
        }]
      }
    });
  }

  // BAR CHART
  const ctxBar = document.getElementById("barChart")?.getContext("2d");
  if (ctxBar) {
    if (barChart) barChart.destroy();
    barChart = new Chart(ctxBar, {
      type: "bar",
      data: {
        labels: Object.keys(downtimePerMachine),
        datasets: [{
          label: "Downtime (jam)",
          data: Object.values(downtimePerMachine),
          backgroundColor: "#36A2EB"
        }]
      }
    });
  }

  // LINE CHART
  const ctxLine = document.getElementById("lineChart")?.getContext("2d");
  if (ctxLine) {
    if (lineChart) lineChart.destroy();
    const sortedMonths = Object.keys(monthlyTrend).sort();
    lineChart = new Chart(ctxLine, {
      type: "line",
      data: {
        labels: sortedMonths,
        datasets: [{
          label: "Downtime bulanan (jam)",
          data: sortedMonths.map(m => monthlyTrend[m]),
          borderColor: "#FF6384",
          fill: false
        }]
      }
    });
  }

  // PARETO CHART
  const ctxPareto = document.getElementById("paretoChart")?.getContext("2d");
  if (ctxPareto) {
    if (paretoChart) paretoChart.destroy();
    const sortedPareto = Object.entries(paretoData).sort((a, b) => b[1] - a[1]);
    paretoChart = new Chart(ctxPareto, {
      type: "bar",
      data: {
        labels: sortedPareto.map(e => e[0]),
        datasets: [{
          label: "Downtime (jam)",
          data: sortedPareto.map(e => e[1]),
          backgroundColor: "#FFCE56"
        }]
      }
    });
  }
}
