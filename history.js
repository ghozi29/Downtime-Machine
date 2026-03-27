// history.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, onValue, remove } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// --- Inisialisasi Firebase ---
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
const db = getDatabase(app);

// --- Elemen DOM ---
const maintenanceTableBody = document.getElementById("maintenanceTableBody");
const componentTableBody = document.getElementById("componentTableBody");

const filterDate = document.getElementById("filterDate");
const filterMonth = document.getElementById("filterMonth");
const filterYear = document.getElementById("filterYear");
const filterCategory = document.getElementById("filterCategory");
const filterMachine = document.getElementById("filterMachine");
const applyFilterBtn = document.getElementById("applyFilter");
const filterResultCount = document.getElementById("filterResultCount");

// --- Cache data ---
let maintenanceDataCache = {};
let componentDataCache = {};

// --- Load Data Maintenance ---
function loadMaintenanceData() {
  const maintenanceRef = ref(db, "records");
  onValue(maintenanceRef, (snapshot) => {
    const data = snapshot.val() || {};
    maintenanceDataCache = data;
    renderMaintenanceTable(data);
  });
}

// --- Render Maintenance Table ---
function renderMaintenanceTable(data) {
  const keys = Object.keys(data);
  if (!keys.length) {
    maintenanceTableBody.innerHTML = '<tr><td colspan="13" class="text-center">Tidak ada data</td></tr>';
    filterResultCount.textContent = "0 Data";
    return;
  }

  let html = "";
  let no = 1;

  keys.forEach((key) => {
    const item = data[key];

    // --- Filter ---
    let pass = true;
    if (filterCategory.value && item.category !== filterCategory.value) pass = false;
    if (filterMachine.value && !item.machineName.toLowerCase().includes(filterMachine.value.toLowerCase())) pass = false;

    const failureDate = item.timestamps?.failureStart ? new Date(item.timestamps.failureStart) : null;
    if (failureDate) {
      if (filterDate.value && failureDate.toISOString().slice(0,10) !== filterDate.value) pass = false;
      if (filterMonth.value) {
        const [year, month] = filterMonth.value.split("-");
        if (!(failureDate.getFullYear() === parseInt(year) && failureDate.getMonth()+1 === parseInt(month))) pass = false;
      }
      if (filterYear.value && failureDate.getFullYear() !== parseInt(filterYear.value)) pass = false;
    }

    if (!pass) return;

    html += `
      <tr>
        <td>${no++}</td>
        <td>${item.machineName || ""}</td>
        <td>${item.category || ""}</td>
        <td>${failureDate ? failureDate.toLocaleString() : ""}</td>
        <td>${failureDate ? failureDate.toLocaleString() : ""}</td>
        <td>${failureDate ? failureDate.toLocaleString() : ""}</td>
        <td>${item.timestamps?.maintenanceEnd ? new Date(item.timestamps.maintenanceEnd).toLocaleString() : ""}</td>
        <td>${item.responseTime || ""}</td>
        <td>${item.repairTime || ""}</td>
        <td>${item.operatingTime || ""}</td>
        <td>${item.downtimeTotal || ""}</td>
        <td>${item.note || ""}</td>
        <td><button onclick="deleteMaintenance('${key}')" class="btn-small btn-danger">Hapus</button></td>
      </tr>
    `;
  });

  maintenanceTableBody.innerHTML = html || '<tr><td colspan="13" class="text-center">Tidak ada data</td></tr>';
  filterResultCount.textContent = no-1 + " Data";
}

// --- Load Component Data ---
function loadComponentData() {
  const componentsRef = ref(db, "components");
  onValue(componentsRef, (snapshot) => {
    const data = snapshot.val() || {};
    componentDataCache = data;
    renderComponentTable(data);
  });
}

// --- Render Component Table ---
function renderComponentTable(data) {
  const keys = Object.keys(data);
  if (!keys.length) {
    componentTableBody.innerHTML = '<tr><td colspan="8" class="text-center">Tidak ada data</td></tr>';
    return;
  }

  let html = "";
  let no = 1;

  keys.forEach((key) => {
    const item = data[key];

    // Hitung MTTF dalam jam (install -> replacement)
    let mttfHours = "";
    if (item.installDate && item.replacementDate) {
      const install = new Date(item.installDate);
      const replacement = new Date(item.replacementDate);
      mttfHours = Math.round((replacement - install)/(1000*60*60));
    }

    html += `
      <tr>
        <td>${no++}</td>
        <td>${item.componentName || ""}</td>
        <td>${item.installDate ? new Date(item.installDate).toLocaleDateString() : ""}</td>
        <td>${item.replacementDate ? new Date(item.replacementDate).toLocaleDateString() : ""}</td>
        <td>${item.lifespanHours || ""}</td>
        <td>${mttfHours || ""}</td>
        <td>${item.note || ""}</td>
        <td><button onclick="deleteComponent('${key}')" class="btn-small btn-danger">Hapus</button></td>
      </tr>
    `;
  });

  componentTableBody.innerHTML = html;
}

// --- Hapus Data ---
window.deleteMaintenance = function(key) {
  if (confirm("Yakin ingin menghapus data ini?")) {
    remove(ref(db, "records/" + key));
  }
};

window.deleteComponent = function(key) {
  if (confirm("Yakin ingin menghapus data ini?")) {
    remove(ref(db, "components/" + key));
  }
};

// --- Export Excel ---
document.getElementById("exportMaintenance").addEventListener("click", () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.table_to_sheet(document.getElementById("maintenanceTable"));
  XLSX.utils.book_append_sheet(wb, ws, "MaintenanceHistory");
  XLSX.writeFile(wb, "maintenance_history.xlsx");
});

document.getElementById("exportComponents").addEventListener("click", () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.table_to_sheet(document.getElementById("componentTable"));
  XLSX.utils.book_append_sheet(wb, ws, "ComponentsHistory");
  XLSX.writeFile(wb, "components_history.xlsx");
});

// --- Filter Event ---
applyFilterBtn.addEventListener("click", () => {
  renderMaintenanceTable(maintenanceDataCache);
});

// --- Init ---
loadMaintenanceData();
loadComponentData();
