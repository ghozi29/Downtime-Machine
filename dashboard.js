import { db, ref, getData } from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", async () => {
  const areaSelect = document.getElementById("areaSelect");
  if (!areaSelect) return;

  areaSelect.addEventListener("change", () => {
    loadDashboard(areaSelect.value);
  });

  // load default area
  await loadDashboard(areaSelect.value);
});

async function loadDashboard(area) {
  showLoading(true);
  try {
    const records = await getData(`area/${area}/records`);
    const components = await getData(`area/${area}/components`);

    const recordList = records ? Object.values(records) : [];
    const componentList = components ? Object.values(components) : [];

    // ===== MTTR =====
    const mttr = recordList.length > 0 ? recordList.reduce((acc, r) => acc + r.repairTime, 0) / recordList.length : 0;
    document.getElementById("mttr").innerText = mttr.toFixed(2);

    // ===== MTBF =====
    const mtbf = recordList.length > 1 ? recordList.reduce((acc, r, i, arr) => {
      if (i === 0) return 0;
      const prevEnd = new Date(arr[i - 1].maintenanceEnd);
      const currStart = new Date(r.operationStart);
      return acc + (currStart - prevEnd) / 3600000;
    }, 0) / (recordList.length - 1) : 0;
    document.getElementById("mtbf").innerText = mtbf.toFixed(2);

    // ===== Total Downtime =====
    const totalDowntime = recordList.reduce((acc, r) => {
      const fail = new Date(r.failureStart);
      const end = new Date(r.maintenanceEnd);
      return acc + (end - fail) / 3600000;
    }, 0);
    document.getElementById("totalDowntime").innerText = totalDowntime.toFixed(2);

    // ===== Total Breakdown =====
    const totalBreakdown = recordList.length;
    document.getElementById("totalBreakdown").innerText = totalBreakdown;

    // ===== Availability =====
    const totalOperating = recordList.reduce((acc, r) => {
      const opStart = new Date(r.operationStart);
      const fail = new Date(r.failureStart);
      return acc + (fail - opStart) / 3600000;
    }, 0);
    const availability = totalOperating + totalDowntime > 0 ? totalOperating / (totalOperating + totalDowntime) * 100 : 0;
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

    // TODO: chart update bisa ditambahkan nanti
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
