import { db, ref, onValue, remove } from "./firebase-config.js";

// ================= GLOBAL VARIABLES =================
let allRecords = [];
let allComponents = [];
let currentArea = "hormon";

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  console.log("History page loaded");
  
  // Setup area selector
  document.getElementById("areaSelect")?.addEventListener("change", (e) => {
    currentArea = e.target.value;
    loadData();
  });
  
  // Setup filter buttons
  document.getElementById("applyFilter")?.addEventListener("click", applyFilters);
  document.getElementById("resetAllFilters")?.addEventListener("click", resetFilters);
  document.getElementById("exportMaintenance")?.addEventListener("click", () => exportToExcel(allRecords, "maintenance"));
  document.getElementById("exportComponents")?.addEventListener("click", () => exportToExcel(allComponents, "components"));
  
  // Load data
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
    console.log(`Loaded ${allRecords.length} maintenance records`);
    
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
      
      // Render tables
      renderMaintenanceTable(allRecords);
      renderComponentTable(allComponents);
      updateResultCount(allRecords.length);
      
      showLoading(false);
      showNotification(`Data loaded: ${allRecords.length} records, ${allComponents.length} components`, "success");
    }, {
      onlyOnce: true
    });
  }, {
    onlyOnce: true
  });
}

// ================= RENDER MAINTENANCE TABLE =================
function renderMaintenanceTable(records) {
  const tbody = document.getElementById("maintenanceTableBody");
  if (!tbody) return;
  
  if (records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="13" class="text-center">Tidak ada data</td></tr>';
    return;
  }
  
  // Sort by date descending
  records.sort((a, b) => new Date(b.failureStart || 0) - new Date(a.failureStart || 0));
  
  let html = "";
  records.forEach((record, index) => {
    const formatDate = (dateStr) => {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleString('id-ID');
    };
    
    html += `
      <tr>
        <td>${index + 1}</td>
        <td>${record.machineName || '-'}</td>
        <td>${record.category || '-'}</td>
        <td>${formatDate(record.operationStart)}</td>
        <td>${formatDate(record.failureStart)}</td>
        <td>${formatDate(record.maintenanceStart)}</td>
        <td>${formatDate(record.maintenanceEnd)}</td>
        <td>${record.responseTime ? record.responseTime.toFixed(2) + ' jam' : '-'}</td>
        <td>${record.repairTime ? record.repairTime.toFixed(2) + ' jam' : '-'}</td>
        <td>${record.operatingTime ? record.operatingTime.toFixed(2) + ' jam' : '-'}</td>
        <td>${record.downtimeTotal ? record.downtimeTotal.toFixed(2) + ' jam' : (record.downtimeHours ? record.downtimeHours.toFixed(2) + ' jam' : '-')}</td>
        <td>${record.note || '-'}</td>
        <td>
          <button class="delete-btn" onclick="deleteRecord('${record.id}')" title="Hapus">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });
  
  tbody.innerHTML = html;
}

// ================= RENDER COMPONENT TABLE =================
function renderComponentTable(components) {
  const tbody = document.getElementById("componentTableBody");
  if (!tbody) return;
  
  if (components.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Tidak ada data komponen</td></tr>';
    return;
  }
  
  components.sort((a, b) => new Date(b.replacementDate || 0) - new Date(a.replacementDate || 0));
  
  let html = "";
  components.forEach((comp, index) => {
    html += `
      <tr>
        <td>${index + 1}</td>
        <td>${comp.componentName || '-'}</td>
        <td>${comp.installDate ? new Date(comp.installDate).toLocaleDateString('id-ID') : '-'}</td>
        <td>${comp.replacementDate ? new Date(comp.replacementDate).toLocaleDateString('id-ID') : '-'}</td>
        <td>${comp.lifespanHours ? comp.lifespanHours.toFixed(2) + ' jam' : '-'}</td>
        <td>${comp.lifespanHours ? comp.lifespanHours.toFixed(2) + ' jam' : '-'}</td>
        <td>${comp.note || '-'}</td>
        <td>
          <button class="delete-btn" onclick="deleteComponent('${comp.id}')" title="Hapus">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });
  
  tbody.innerHTML = html;
}

// ================= DELETE FUNCTIONS =================
window.deleteRecord = function(id) {
  if (confirm("Yakin ingin menghapus data ini?")) {
    showLoading(true);
    
    const recordRef = ref(db, `area/${currentArea}/records/${id}`);
    remove(recordRef)
      .then(() => {
        showNotification("Data berhasil dihapus", "success");
        loadData();
      })
      .catch(error => {
        console.error("Error deleting:", error);
        showNotification("Gagal menghapus: " + error.message, "error");
        showLoading(false);
      });
  }
}

window.deleteComponent = function(id) {
  if (confirm("Yakin ingin menghapus komponen ini?")) {
    showLoading(true);
    
    const compRef = ref(db, `area/${currentArea}/components/${id}`);
    remove(compRef)
      .then(() => {
        showNotification("Komponen berhasil dihapus", "success");
        loadData();
      })
      .catch(error => {
        console.error("Error deleting:", error);
        showNotification("Gagal menghapus: " + error.message, "error");
        showLoading(false);
      });
  }
}

// ================= FILTER FUNCTIONS =================
function applyFilters() {
  const dateFilter = document.getElementById("filterDate")?.value;
  const monthFilter = document.getElementById("filterMonth")?.value;
  const yearFilter = document.getElementById("filterYear")?.value;
  const categoryFilter = document.getElementById("filterCategory")?.value;
  const machineFilter = document.getElementById("filterMachine")?.value?.toLowerCase();
  
  let filtered = [...allRecords];
  
  if (dateFilter) {
    filtered = filtered.filter(r => {
      const recordDate = r.failureStart ? r.failureStart.split('T')[0] : '';
      return recordDate === dateFilter;
    });
  }
  
  if (monthFilter) {
    filtered = filtered.filter(r => {
      const recordDate = r.failureStart ? r.failureStart.substring(0, 7) : '';
      return recordDate === monthFilter;
    });
  }
  
  if (yearFilter) {
    filtered = filtered.filter(r => {
      const recordYear = r.failureStart ? r.failureStart.substring(0, 4) : '';
      return recordYear === yearFilter;
    });
  }
  
  if (categoryFilter) {
    filtered = filtered.filter(r => r.category === categoryFilter);
  }
  
  if (machineFilter) {
    filtered = filtered.filter(r => 
      r.machineName && r.machineName.toLowerCase().includes(machineFilter)
    );
  }
  
  renderMaintenanceTable(filtered);
  updateResultCount(filtered.length);
}

function resetFilters() {
  document.getElementById("filterDate").value = "";
  document.getElementById("filterMonth").value = "";
  document.getElementById("filterYear").value = "";
  document.getElementById("filterCategory").value = "";
  document.getElementById("filterMachine").value = "";
  
  renderMaintenanceTable(allRecords);
  updateResultCount(allRecords.length);
}

function updateResultCount(count) {
  const el = document.getElementById("filterResultCount");
  if (el) {
    el.innerText = `${count} data ditemukan`;
  }
}

// ================= EXPORT TO EXCEL =================
function exportToExcel(data, type) {
  if (data.length === 0) {
    alert("Tidak ada data untuk diexport");
    return;
  }
  
  let exportData;
  if (type === "maintenance") {
    exportData = data.map(r => ({
      Mesin: r.machineName || '-',
      Kategori: r.category || '-',
      'Operasi Mulai': r.operationStart ? new Date(r.operationStart).toLocaleString('id-ID') : '-',
      'Waktu Rusak': r.failureStart ? new Date(r.failureStart).toLocaleString('id-ID') : '-',
      'Mulai Perbaikan': r.maintenanceStart ? new Date(r.maintenanceStart).toLocaleString('id-ID') : '-',
      'Selesai Perbaikan': r.maintenanceEnd ? new Date(r.maintenanceEnd).toLocaleString('id-ID') : '-',
      'Response Time (jam)': r.responseTime || 0,
      'Repair Time (jam)': r.repairTime || 0,
      'Operating Time (jam)': r.operatingTime || 0,
      'Total Downtime (jam)': r.downtimeTotal || r.downtimeHours || 0,
      Catatan: r.note || '-'
    }));
  } else {
    exportData = data.map(c => ({
      Komponen: c.componentName || '-',
      'Tanggal Pasang': c.installDate || '-',
      'Tanggal Ganti': c.replacementDate || '-',
      'Umur (jam)': c.lifespanHours || 0,
      'MTTF (jam)': c.lifespanHours || 0,
      Catatan: c.note || '-'
    }));
  }
  
  if (typeof XLSX !== 'undefined') {
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type);
    XLSX.writeFile(wb, `${type}_${currentArea}_${new Date().toISOString().split('T')[0]}.xlsx`);
  } else {
    alert("Library Excel tidak tersedia");
  }
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