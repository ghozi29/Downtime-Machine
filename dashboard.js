import { db, ref, get } from "./firebase-config.js";

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  const areaSelect = document.getElementById("areaSelect");
  const applyBtn = document.getElementById("applyPeriodFilter");

  loadDashboard(areaSelect.value);

  applyBtn.addEventListener("click", () => loadDashboard(areaSelect.value));
  areaSelect.addEventListener("change", () => loadDashboard(areaSelect.value));
});

// ===== LOAD DASHBOARD =====
async function loadDashboard(area) {
  showLoading(true);
  try {
    const recordsSnap = await get(ref(db, `area/${area}/records`));
    const componentsSnap = await get(ref(db, `area/${area}/components`));

    const records = recordsSnap.val() || {};
    const components = componentsSnap.val() || {};

    // ===== KPI =====
    let totalRepair = 0, totalOpsTime = 0, totalDowntime = 0, breakdownCount = 0;

    Object.values(records).forEach(r => {
      totalRepair += parseFloat(r.repairTime || 0);
      totalDowntime += parseFloat(r.repairTime || 0);
      breakdownCount++;
    });

    const mttr = breakdownCount ? (totalRepair / breakdownCount).toFixed(2) : 0;
    const mtbf = breakdownCount ? (totalOpsTime / breakdownCount).toFixed(2) : 0;
    const totalDowntimeVal = totalDowntime.toFixed(2);

    document.getElementById("mttr").innerText = mttr;
    document.getElementById("mtbf").innerText = mtbf;
    document.getElementById("totalDowntime").innerText = totalDowntimeVal;
    document.getElementById("totalBreakdown").innerText = breakdownCount;

    // ===== TABEL MTTF =====
    const tbody = document.getElementById("mttfTableBody");
    tbody.innerHTML = "";
    Object.values(components).forEach(c => {
      const avgLife = ((parseFloat(c.operatingHours || c.lifespanHours) || 0)).toFixed(2);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${c.componentName}</td>
        <td>1</td>
        <td>${avgLife}</td>
        <td>${c.operatingHours || c.lifespanHours}</td>
      `;
      tbody.appendChild(tr);
    });
    if (Object.keys(components).length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center">Tidak ada data</td></tr>`;
    }

    // ===== CHART BREAKDOWN PIE =====
    const pieData = {};
    Object.values(records).forEach(r => {
      const cat = r.category || "Unknown";
      pieData[cat] = (pieData[cat] || 0) + 1;
    });
    const pieCtx = document.getElementById("pieChart").getContext("2d");
    new Chart(pieCtx, {
      type: "pie",
      data: {
        labels: Object.keys(pieData),
        datasets: [{ 
          data: Object.values(pieData), 
          backgroundColor: ["#3498db","#2ecc71","#f1c40f","#e74c3c","#9b59b6"] 
        }]
      }
    });

    // ===== CHART DOWNTIME PER MESIN =====
    const barData = {};
    Object.values(records).forEach(r => {
      const name = r.machineName || "Unknown";
      barData[name] = (barData[name] || 0) + parseFloat(r.repairTime || 0);
    });
    const barCtx = document.getElementById("barChart").getContext("2d");
    new Chart(barCtx, {
      type: "bar",
      data: {
        labels: Object.keys(barData),
        datasets: [{ label: "Jam Downtime", data: Object.values(barData), backgroundColor: "#e67e22" }]
      },
      options: { responsive:true, plugins:{legend:{display:false}} }
    });

    // ===== CHART PARETO =====
    const paretoData = Object.entries(barData).sort((a,b)=>b[1]-a[1]);
    const paretoLabels = paretoData.map(d=>d[0]);
    const paretoValues = paretoData.map(d=>d[1]);
    const paretoCtx = document.getElementById("paretoChart").getContext("2d");
    new Chart(paretoCtx, {
      type: "bar",
      data: {
        labels: paretoLabels,
        datasets:[{label:"Downtime (jam)", data:paretoValues, backgroundColor:"#c0392b"}]
      },
      options: { responsive:true }
    });

  } catch (err) {
    console.error(err);
    showNotification("❌ Gagal memuat dashboard: "+err.message, "error");
  } finally {
    showLoading(false);
  }
}

// ===== LOADING =====
function showLoading(show) {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = show ? "flex" : "none";
}

// ===== NOTIF =====
function showNotification(message, type="info") {
  const notif = document.getElementById("notification");
  if (!notif) return;
  notif.className = `notification ${type}`;
  notif.innerHTML = message;
  notif.style.display = "block";
  setTimeout(()=>{ notif.style.display="none"; },5000);
}
