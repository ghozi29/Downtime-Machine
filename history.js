// history.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, getDocs, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// --- INISIALISASI FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCdjG0w6QOMdYzWsqF_QZKl7yHJOrcyjbQ",
  authDomain: "iotcamar.firebaseapp.com",
  databaseURL: "https://iotcamar-default-rtdb.firebaseio.com",
  projectId: "iotcamar",
  storageBucket: "iotcamar.firebasestorage.app",
  messagingSenderId: "878187768527",
  appId: "1:878187768527:web:e5c6412e811b15251825ba",
  measurementId: "G-V40ZQ4Y9RS"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- ELEMENT DOM ---
const maintenanceTableBody = document.getElementById("maintenanceTableBody");
const componentTableBody = document.getElementById("componentTableBody");
const notification = document.getElementById("notification");

// Filter input
const filterDate = document.getElementById("filterDate");
const filterMonth = document.getElementById("filterMonth");
const filterYear = document.getElementById("filterYear");
const filterCategory = document.getElementById("filterCategory");
const filterMachine = document.getElementById("filterMachine");
const applyFilterBtn = document.getElementById("applyFilter");
const resetFilterBtn = document.getElementById("resetAllFilters");

// Export buttons
const exportMaintenanceBtn = document.getElementById("exportMaintenance");
const exportComponentsBtn = document.getElementById("exportComponents");

// --- NOTIFIKASI ---
function showNotification(message, type = "info") {
  notification.innerText = message;
  notification.className = `notification ${type}`;
  notification.style.display = "block";
  setTimeout(() => (notification.style.display = "none"), 3000);
}

// --- UTILITY FILTER ---
function matchesFilter(data) {
  const dateFilter = filterDate.value ? new Date(filterDate.value) : null;
  const monthFilter = filterMonth.value ? new Date(filterMonth.value) : null;
  const yearFilter = filterYear.value ? parseInt(filterYear.value) : null;
  const categoryFilter = filterCategory.value.trim().toLowerCase();
  const machineFilter = filterMachine.value.trim().toLowerCase();

  let failureDate = data.timestamps?.failureStart ? new Date(data.timestamps.failureStart) : null;
  if (dateFilter && (!failureDate || failureDate.toDateString() !== dateFilter.toDateString())) return false;
  if (monthFilter && failureDate) {
    if (failureDate.getFullYear() !== monthFilter.getFullYear() || failureDate.getMonth() !== monthFilter.getMonth()) return false;
  }
  if (yearFilter && failureDate && failureDate.getFullYear() !== yearFilter) return false;

  if (categoryFilter && data.category?.toLowerCase() !== categoryFilter) return false;
  if (machineFilter && !data.machineName?.toLowerCase().includes(machineFilter)) return false;

  return true;
}

// --- LOAD DATA MAINTENANCE ---
let cachedMaintenanceData = [];
async function loadMaintenanceData() {
  maintenanceTableBody.innerHTML = `<tr><td colspan="13" class="text-center">Memuat data...</td></tr>`;
  try {
    const q = query(collection(db, "records"), orderBy("timestamps.failureStart", "desc"));
    const snapshot = await getDocs(q);

    cachedMaintenanceData = [];
    if (snapshot.empty) {
      maintenanceTableBody.innerHTML = `<tr><td colspan="13" class="text-center">Tidak ada data</td></tr>`;
      return;
    }

    let html = "";
    let no = 1;
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (!matchesFilter(data)) return;
      cachedMaintenanceData.push({ id: docSnap.id, ...data });

      const failureStart = data.timestamps?.failureStart ? new Date(data.timestamps.failureStart).toLocaleString() : "-";
      const maintenanceEnd = data.timestamps?.maintenanceEnd ? new Date(data.timestamps.maintenanceEnd).toLocaleString() : "-";

      html += `
        <tr>
          <td>${no++}</td>
          <td>${data.machineName || "-"}</td>
          <td>${data.category || "-"}</td>
          <td>${data.operatingTime || 0}</td>
          <td>${failureStart}</td>
          <td>${failureStart}</td>
          <td>${maintenanceEnd}</td>
          <td>${data.responseTime || 0}</td>
          <td>${data.repairTime || 0}</td>
          <td>${data.operatingTime || 0}</td>
          <td>${data.downtimeTotal || 0}</td>
          <td>${data.note || "-"}</td>
          <td>
            <button class="btn-small btn-danger" onclick="deleteMaintenance('${docSnap.id}')">
              <i class="fas fa-trash"></i> Hapus
            </button>
          </td>
        </tr>`;
    });

    maintenanceTableBody.innerHTML = html || `<tr><td colspan="13" class="text-center">Tidak ada data sesuai filter</td></tr>`;
  } catch (err) {
    console.error(err);
    showNotification("Gagal memuat data maintenance", "error");
  }
}

// --- LOAD DATA KOMPONEN ---
let cachedComponentData = [];
async function loadComponentData() {
  componentTableBody.innerHTML = `<tr><td colspan="8" class="text-center">Memuat data...</td></tr>`;
  try {
    const q = query(collection(db, "components"), orderBy("tanggalPasang", "desc"));
    const snapshot = await getDocs(q);

    cachedComponentData = [];
    if (snapshot.empty) {
      componentTableBody.innerHTML = `<tr><td colspan="8" class="text-center">Tidak ada data</td></tr>`;
      return;
    }

    let html = "";
    let no = 1;
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      cachedComponentData.push({ id: docSnap.id, ...data });
      html += `
        <tr>
          <td>${no++}</td>
          <td>${data.nama || "-"}</td>
          <td>${data.tanggalPasang || "-"}</td>
          <td>${data.tanggalGanti || "-"}</td>
          <td>${data.umur || 0}</td>
          <td>${data.mttf || 0}</td>
          <td>${data.note || "-"}</td>
          <td>
            <button class="btn-small btn-danger" onclick="deleteComponent('${docSnap.id}')">
              <i class="fas fa-trash"></i> Hapus
            </button>
          </td>
        </tr>`;
    });

    componentTableBody.innerHTML = html;
  } catch (err) {
    console.error(err);
    showNotification("Gagal memuat data komponen", "error");
  }
}

// --- HAPUS DATA ---
window.deleteMaintenance = async (id) => {
  if (!confirm("Yakin ingin menghapus data maintenance ini?")) return;
  try {
    await deleteDoc(doc(db, "records", id));
    showNotification("Data maintenance berhasil dihapus", "success");
    loadMaintenanceData();
  } catch (err) {
    console.error(err);
    showNotification("Gagal menghapus data maintenance", "error");
  }
};

window.deleteComponent = async (id) => {
  if (!confirm("Yakin ingin menghapus data komponen ini?")) return;
  try {
    await deleteDoc(doc(db, "components", id));
    showNotification("Data komponen berhasil dihapus", "success");
    loadComponentData();
  } catch (err) {
    console.error(err);
    showNotification("Gagal menghapus data komponen", "error");
  }
};

// --- EXPORT KE EXCEL ---
function exportToExcel(dataArray, sheetName, fileName) {
  if (!dataArray || dataArray.length === 0) {
    showNotification("Tidak ada data untuk diekspor", "error");
    return;
  }

  const ws = XLSX.utils.json_to_sheet(dataArray);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

// --- EXPORT MAINTENANCE ---
exportMaintenanceBtn.addEventListener("click", () => {
  if (!cachedMaintenanceData.length) {
    showNotification("Tidak ada data untuk diekspor", "error");
    return;
  }
  const exportData = cachedMaintenanceData.map((d, idx) => ({
    No: idx + 1,
    Mesin: d.machineName || "-",
    Kategori: d.category || "-",
    OperasiMulai: d.operatingTime || 0,
    WaktuRusak: d.timestamps?.failureStart || "-",
    MulaiPerbaikan: d.timestamps?.failureStart || "-",
    SelesaiPerbaikan: d.timestamps?.maintenanceEnd || "-",
    ResponseTime: d.responseTime || 0,
    RepairTime: d.repairTime || 0,
    OperatingTime: d.operatingTime || 0,
    TotalDowntime: d.downtimeTotal || 0,
    Catatan: d.note || "-"
  }));
  exportToExcel(exportData, "Maintenance", "Maintenance_History.xlsx");
});

// --- EXPORT KOMPONEN ---
exportComponentsBtn.addEventListener("click", () => {
  if (!cachedComponentData.length) {
    showNotification("Tidak ada data untuk diekspor", "error");
    return;
  }
  const exportData = cachedComponentData.map((d, idx) => ({
    No: idx + 1,
    Komponen: d.nama || "-",
    TanggalPasang: d.tanggalPasang || "-",
    TanggalGanti: d.tanggalGanti || "-",
    UmurJam: d.umur || 0,
    MTTF: d.mttf || 0,
    Catatan: d.note || "-"
  }));
  exportToExcel(exportData, "Komponen", "Komponen_History.xlsx");
});

// --- EVENT FILTER ---
applyFilterBtn.addEventListener("click", () => loadMaintenanceData());
resetFilterBtn.addEventListener("click", () => {
  filterDate.value = "";
  filterMonth.value = "";
  filterYear.value = "";
  filterCategory.value = "";
  filterMachine.value = "";
  loadMaintenanceData();
});

// --- LOAD DATA AWAL ---
loadMaintenanceData();
loadComponentData();
