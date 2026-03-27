// history.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  remove,
  query,
  orderByChild,
  startAt,
  endAt,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Helper format tanggal ke string "YYYY-MM-DD"
function formatDate(dateInput) {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d)) return '-';
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Load data maintenance dari 'records'
function loadMaintenanceData(filter = {}) {
  const refMaintenance = ref(db, "records");
  const tbody = document.getElementById("maintenanceTableBody");
  tbody.innerHTML = `<tr><td colspan="13" class="text-center">Memuat data...</td></tr>`;

  onValue(refMaintenance, (snapshot) => {
    const data = snapshot.val();
    tbody.innerHTML = "";
    if (!data) {
      tbody.innerHTML = `<tr><td colspan="13" class="text-center">Tidak ada data maintenance.</td></tr>`;
      document.getElementById("filterResultCount").textContent = "";
      return;
    }

    const filtered = Object.entries(data).filter(([key, item]) => {
      // Filter tanggal spesifik
      if (filter.date) {
        if (!item.timestamps?.failureStart) return false;
        if (formatDate(item.timestamps.failureStart) !== filter.date) return false;
      }
      // Filter bulan YYYY-MM
      if (filter.month) {
        if (!item.timestamps?.failureStart) return false;
        const d = new Date(item.timestamps.failureStart);
        const [year, month] = filter.month.split("-");
        if (d.getFullYear() !== +year || d.getMonth() + 1 !== +month) return false;
      }
      // Filter tahun YYYY
      if (filter.year) {
        if (!item.timestamps?.failureStart) return false;
        const d = new Date(item.timestamps.failureStart);
        if (d.getFullYear() !== +filter.year) return false;
      }
      // Filter kategori
      if (filter.category && filter.category !== "") {
        if (!item.category || item.category.toLowerCase() !== filter.category.toLowerCase())
          return false;
      }
      // Filter mesin
      if (filter.machine && filter.machine !== "") {
        if (!item.machineName || !item.machineName.toLowerCase().includes(filter.machine.toLowerCase()))
          return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="13" class="text-center">Data tidak ditemukan sesuai filter.</td></tr>`;
      document.getElementById("filterResultCount").textContent = "Data ditemukan: 0";
      return;
    }

    document.getElementById("filterResultCount").textContent = `Data ditemukan: ${filtered.length}`;

    filtered.forEach(([key, item], idx) => {
      const operatingStart = formatDate(item.createdAt);
      const breakdownTime = formatDate(item.timestamps?.failureStart);
      const repairStart = formatDate(item.timestamps?.failureStart);
      const repairEnd = formatDate(item.timestamps?.maintenanceEnd);

      const responseTime = item.responseTime ?? "-";
      const repairTime = item.repairTime ?? "-";
      const operatingTime = item.operatingTime ?? "-";
      const totalDowntime = item.downtimeTotal ?? "-";
      const note = item.note || "-";

      const row = `
        <tr>
          <td>${idx + 1}</td>
          <td>${item.machineName || "-"}</td>
          <td>${item.category || "-"}</td>
          <td>${operatingStart}</td>
          <td>${breakdownTime}</td>
          <td>${repairStart}</td>
          <td>${repairEnd}</td>
          <td>${responseTime}</td>
          <td>${repairTime}</td>
          <td>${operatingTime}</td>
          <td>${totalDowntime}</td>
          <td>${note}</td>
          <td><button class="btn-small btn-danger btn-delete-maintenance" data-key="${key}">Hapus</button></td>
        </tr>
      `;
      tbody.insertAdjacentHTML("beforeend", row);
    });

    attachDeleteMaintenanceListeners();
  }, { onlyOnce: true });
}

// Load data komponen MTTF dari 'components'
function loadComponentData() {
  const refComponents = ref(db, "components");
  const tbody = document.getElementById("componentTableBody");
  tbody.innerHTML = `<tr><td colspan="8" class="text-center">Memuat data...</td></tr>`;

  onValue(refComponents, (snapshot) => {
    const data = snapshot.val();
    tbody.innerHTML = "";
    if (!data) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center">Tidak ada data komponen.</td></tr>`;
      return;
    }

    const entries = Object.entries(data);
    entries.forEach(([key, item], idx) => {
      const installDate = formatDate(item.installDate);
      const replacementDate = formatDate(item.replacementDate);
      const lifespanHours = item.lifespanHours ?? "-";
      const note = item.note || "-";

      const row = `
        <tr>
          <td>${idx + 1}</td>
          <td>${item.componentName || "-"}</td>
          <td>${installDate}</td>
          <td>${replacementDate}</td>
          <td>${lifespanHours}</td>
          <td>${lifespanHours}</td>
          <td>${note}</td>
          <td><button class="btn-small btn-danger btn-delete-component" data-key="${key}">Hapus</button></td>
        </tr>
      `;
      tbody.insertAdjacentHTML("beforeend", row);
    });

    attachDeleteComponentListeners();
  }, { onlyOnce: true });
}

// Hapus data maintenance
function deleteMaintenance(key) {
  if (!confirm("Apakah Anda yakin ingin menghapus data maintenance ini?")) return;
  const refDel = ref(db, `records/${key}`);
  remove(refDel)
    .then(() => {
      showNotification("Data maintenance berhasil dihapus.", "success");
      loadMaintenanceData(getCurrentFilter());
    })
    .catch((error) => {
      showNotification("Gagal menghapus data maintenance: " + error.message, "error");
    });
}

// Hapus data komponen
function deleteComponent(key) {
  if (!confirm("Apakah Anda yakin ingin menghapus data komponen ini?")) return;
  const refDel = ref(db, `components/${key}`);
  remove(refDel)
    .then(() => {
      showNotification("Data komponen berhasil dihapus.", "success");
      loadComponentData();
    })
    .catch((error) => {
      showNotification("Gagal menghapus data komponen: " + error.message, "error");
    });
}

// Pasang event listener untuk tombol hapus maintenance
function attachDeleteMaintenanceListeners() {
  document.querySelectorAll(".btn-delete-maintenance").forEach((btn) => {
    btn.onclick = () => {
      const key = btn.getAttribute("data-key");
      deleteMaintenance(key);
    };
  });
}

// Pasang event listener untuk tombol hapus komponen
function attachDeleteComponentListeners() {
  document.querySelectorAll(".btn-delete-component").forEach((btn) => {
    btn.onclick = () => {
      const key = btn.getAttribute("data-key");
      deleteComponent(key);
    };
  });
}

// Ambil filter saat ini dari UI
function getCurrentFilter() {
  return {
    date: document.getElementById("filterDate").value,
    month: document.getElementById("filterMonth").value,
    year: document.getElementById("filterYear").value,
    category: document.getElementById("filterCategory").value,
    machine: document.getElementById("filterMachine").value.trim(),
  };
}

// Reset semua filter
function resetFilters() {
  document.getElementById("filterDate").value = "";
  document.getElementById("filterMonth").value = "";
  document.getElementById("filterYear").value = "";
  document.getElementById("filterCategory").value = "";
  document.getElementById("filterMachine").value = "";
  document.getElementById("filterResultCount").textContent = "";
  loadMaintenanceData({});
}

// Notifikasi sederhana
function showNotification(message, type = "info") {
  const notif = document.getElementById("notification");
  notif.textContent = message;
  notif.className = `notification ${type}`;
  notif.style.display = "block";
  setTimeout(() => {
    notif.style.display = "none";
  }, 4000);
}

// Inisialisasi event
function initEvents() {
  document.getElementById("applyFilter").addEventListener("click", () => {
    loadMaintenanceData(getCurrentFilter());
  });

  document.getElementById("resetAllFilters").addEventListener("click", () => {
    resetFilters();
  });

  document.getElementById("exportMaintenance").addEventListener("click", () => {
    exportTableToExcel("maintenanceTable", "History_Maintenance");
  });

  document.getElementById("exportComponents").addEventListener("click", () => {
    exportTableToExcel("componentTable", "History_Components");
  });
}

// Export ke Excel (menggunakan library XLSX)
function exportTableToExcel(tableId, filename = "export.xlsx") {
  const table = document.getElementById(tableId);
  if (!table) {
    showNotification("Tabel tidak ditemukan!", "error");
    return;
  }

  const wb = XLSX.utils.table_to_book(table, { sheet: "Sheet1" });
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// Jalankan init dan load data awal
function init() {
  loadMaintenanceData({});
  loadComponentData();
  initEvents();
}

window.onload = init;
