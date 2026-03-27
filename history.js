// history.js
const maintenanceTableBody = document.getElementById('maintenanceTableBody');
const componentTableBody = document.getElementById('componentTableBody');
const filterDate = document.getElementById('filterDate');
const filterMonth = document.getElementById('filterMonth');
const filterYear = document.getElementById('filterYear');
const filterCategory = document.getElementById('filterCategory');
const filterMachine = document.getElementById('filterMachine');
const applyFilter = document.getElementById('applyFilter');
const resetAllFilters = document.getElementById('resetAllFilters');
const exportMaintenance = document.getElementById('exportMaintenance');
const exportComponents = document.getElementById('exportComponents');
const filterResultCount = document.getElementById('filterResultCount');
const loadingOverlay = document.getElementById('loadingOverlay');
const notification = document.getElementById('notification');

// Dummy Data (replace with real API / DB)
let maintenanceData = [
  {
    mesin: "Injeksi 1",
    kategori: "Injeksi",
    operasiMulai: "2026-03-01 08:00",
    waktuRusak: "2026-03-01 12:30",
    mulaiPerbaikan: "2026-03-01 12:45",
    selesaiPerbaikan: "2026-03-01 14:00",
    responseTime: "15 menit",
    repairTime: "1 jam 15 menit",
    operatingTime: "4 jam 30 menit",
    totalDowntime: "1 jam 15 menit",
    catatan: "Ganti pompa",
  },
  {
    mesin: "Packaging 2",
    kategori: "Packaging",
    operasiMulai: "2026-03-02 07:00",
    waktuRusak: "2026-03-02 09:20",
    mulaiPerbaikan: "2026-03-02 09:25",
    selesaiPerbaikan: "2026-03-02 10:10",
    responseTime: "5 menit",
    repairTime: "45 menit",
    operatingTime: "2 jam 20 menit",
    totalDowntime: "45 menit",
    catatan: "Roller aus",
  }
];

let componentData = [
  {
    komponen: "Pompa Injeksi",
    tanggalPasang: "2026-01-01",
    tanggalGanti: "2026-03-01",
    umur: 500,
    mttf: 500,
    catatan: "Penggantian rutin"
  },
  {
    komponen: "Roller Packaging",
    tanggalPasang: "2026-02-01",
    tanggalGanti: "2026-03-02",
    umur: 300,
    mttf: 300,
    catatan: "Kerusakan"
  }
];

// ------------------ UTILITIES ------------------
function showLoading(show = true) {
  loadingOverlay.style.display = show ? 'flex' : 'none';
}

function showNotification(message, type = 'success') {
  notification.innerHTML = message;
  notification.className = `notification ${type}`;
  notification.style.display = 'block';
  setTimeout(() => notification.style.display = 'none', 3000);
}

// ------------------ RENDER ------------------
function renderMaintenanceTable(data) {
  if (!data.length) {
    maintenanceTableBody.innerHTML = `<tr><td colspan="13" class="text-center">Tidak ada data</td></tr>`;
    return;
  }
  maintenanceTableBody.innerHTML = data.map((row, i) => `
    <tr>
      <td>${i+1}</td>
      <td>${row.mesin}</td>
      <td>${row.kategori}</td>
      <td>${row.operasiMulai}</td>
      <td>${row.waktuRusak}</td>
      <td>${row.mulaiPerbaikan}</td>
      <td>${row.selesaiPerbaikan}</td>
      <td>${row.responseTime}</td>
      <td>${row.repairTime}</td>
      <td>${row.operatingTime}</td>
      <td>${row.totalDowntime}</td>
      <td>${row.catatan}</td>
      <td><button class="btn-small btn-outline" onclick="alert('Detail/Edit belum diimplementasikan')">Detail</button></td>
    </tr>
  `).join('');
}

function renderComponentTable(data) {
  if (!data.length) {
    componentTableBody.innerHTML = `<tr><td colspan="8" class="text-center">Tidak ada data</td></tr>`;
    return;
  }
  componentTableBody.innerHTML = data.map((row, i) => `
    <tr>
      <td>${i+1}</td>
      <td>${row.komponen}</td>
      <td>${row.tanggalPasang}</td>
      <td>${row.tanggalGanti}</td>
      <td>${row.umur}</td>
      <td>${row.mttf}</td>
      <td>${row.catatan}</td>
      <td><button class="btn-small btn-outline" onclick="alert('Detail/Edit belum diimplementasikan')">Detail</button></td>
    </tr>
  `).join('');
}

// ------------------ FILTER ------------------
function applyFilters() {
  showLoading();
  setTimeout(() => { // simulate loading
    let filteredMaintenance = maintenanceData.filter(row => {
      const rowDate = new Date(row.waktuRusak);
      if (filterDate.value && rowDate.toISOString().slice(0,10) !== filterDate.value) return false;
      if (filterMonth.value) {
        const [year, month] = filterMonth.value.split('-');
        if (rowDate.getFullYear() != year || rowDate.getMonth()+1 != month) return false;
      }
      if (filterYear.value && rowDate.getFullYear() != filterYear.value) return false;
      if (filterCategory.value && row.kategori !== filterCategory.value) return false;
      if (filterMachine.value && !row.mesin.toLowerCase().includes(filterMachine.value.toLowerCase())) return false;
      return true;
    });

    let filteredComponents = componentData.filter(row => {
      const rowDate = new Date(row.tanggalGanti);
      if (filterDate.value && rowDate.toISOString().slice(0,10) !== filterDate.value) return false;
      if (filterMonth.value) {
        const [year, month] = filterMonth.value.split('-');
        if (rowDate.getFullYear() != year || rowDate.getMonth()+1 != month) return false;
      }
      if (filterYear.value && rowDate.getFullYear() != filterYear.value) return false;
      return true;
    });

    renderMaintenanceTable(filteredMaintenance);
    renderComponentTable(filteredComponents);
    filterResultCount.textContent = `Menampilkan ${filteredMaintenance.length} data maintenance & ${filteredComponents.length} data komponen`;
    showLoading(false);
  }, 300);
}

function resetFilters() {
  filterDate.value = '';
  filterMonth.value = '';
  filterYear.value = '';
  filterCategory.value = '';
  filterMachine.value = '';
  applyFilters();
}

// ------------------ EXPORT EXCEL ------------------
function exportTableToExcel(tableId, filename = 'data.xlsx') {
  const table = document.getElementById(tableId);
  const wb = XLSX.utils.table_to_book(table, {sheet:"Sheet1"});
  XLSX.writeFile(wb, filename);
}

// ------------------ EVENTS ------------------
applyFilter.addEventListener('click', applyFilters);
resetAllFilters.addEventListener('click', resetFilters);
exportMaintenance.addEventListener('click', () => exportTableToExcel('maintenanceTable','MaintenanceHistory.xlsx'));
exportComponents.addEventListener('click', () => exportTableToExcel('componentTable','ComponentHistory.xlsx'));

// ------------------ INIT ------------------
window.addEventListener('DOMContentLoaded', () => {
  renderMaintenanceTable(maintenanceData);
  renderComponentTable(componentData);
});
