import { getData } from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", async () => {
  const areaSelect = document.getElementById("areaSelect");
  if (!areaSelect) return;

  // Load dashboard awal
  await loadDashboard(areaSelect.value);

  // Ganti area
  areaSelect.addEventListener("change", async () => {
    await loadDashboard(areaSelect.value);
  });
});

async function loadDashboard(area) {
  showLoading(true);
  try {
    // Ambil data records dan komponen
    const records = await getData(`area/${area}/records`);
    const components = await getData(`area/${area}/components`);

    const recordList = records ? Object.values(records) : [];
    const componentList = components ? Object.values(components) : [];

    // ===== MTTR =====
    const mttr = recordList.length > 0
      ? recordList.reduce((acc, r) => acc + (r.repairTime || 0), 0) / recordList.length
      : 0;
    document.getElementById("mttr").innerText = mttr.toFixed(2);

    // ===== MTBF =====
    const sortedRecords = recordList
      .map(r => ({ opStart: new Date(r.operationStart), failStart: new Date(r.failureStart) }))
      .sort((a, b) => a.opStart - b.opStart);

    let mtbf = 0;
    if (sortedRecords.length > 1) {
      let sum = 0;
      for (let i = 1; i < sortedRecords.length; i++) {
        sum += (sortedRecords[i].opStart - sortedRecords[i - 1].failStart) / 3600000; // jam
      }
      mtbf = sum / (sortedRecords.length - 1);
    }
    document.getElementById("mtbf").innerText = mtbf.toFixed(2);

    // ===== Total Downtime =====
    const totalDowntime = recordList.reduce((acc, r) => {
      const fail = new Date(r.failureStart);
      const end = new Date(r.maintenanceEnd);
      return acc + (end - fail) / 3600000;
    }, 0);
    document.getElementById("totalDowntime").innerText = totalDowntime.toFixed(2);

    // ===== Total Breakdown =====
    document.getElementById("totalBreakdown").innerText = recordList.length;

    // ===== Availability =====
    const totalOperating = recordList.reduce((acc, r) => {
      const opStart = new Date(r.operationStart);
      const fail = new Date(r.failureStart);
      return acc + (fail - opStart) / 3600000;
    }, 0);
    const availability = totalOperating + totalDowntime > 0
      ? (totalOperating / (totalOperating + totalDowntime)) * 100
      : 0;
    document.getElementById("availability").innerText = availability.toFixed(1) + "%";

    // ===== MTTF Komponen =====
    const tbody = document.getElementById("mttfTableBody");
    tbody.innerHTML = "";
    if (componentList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center">Tidak ada data</td></tr>`;
    } else {
      componentList.forEach(c => {
        const avg = c.lifespanHours ? (c.lifespanHours).toFixed(2) : "-";
        const row = `<tr>
          <td>${c.componentName}</td>
          <td>1</td>
          <td>${avg}</td>
          <td>${c.operatingHours?.toFixed(2) || "-"}</td>
        </tr>`;
        tbody.innerHTML += row;
      });
    }

  } catch (err) {
    console.error(err);
    alert("Gagal memuat dashboard: " + err.message);
  } finally {
    showLoading(false);
  }
}

function showLoading(show) {
  const overlay = document.getElementById("loadingOverlay");
  if (!overlay) return;
  overlay.style.display = show ? "flex" : "none";
}
