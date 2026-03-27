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

// --- Load Data Maintenance ---
function loadMaintenanceData() {
  const maintenanceRef = ref(db, "records");
  onValue(maintenanceRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      maintenanceTableBody.innerHTML = '<tr><td colspan="13" class="text-center">Tidak ada data</td></tr>';
      return;
    }

    let html = "";
    let no = 1;
    Object.keys(data).forEach((key) => {
      const item = data[key];
      html += `
        <tr>
          <td>${no++}</td>
          <td>${item.machineName || ""}</td>
          <td>${item.category || ""}</td>
          <td>${new Date(item.timestamps?.failureStart).toLocaleString() || ""}</td>
          <td>${new Date(item.timestamps?.failureStart).toLocaleString() || ""}</td>
          <td>${new Date(item.timestamps?.failureStart).toLocaleString() || ""}</td>
          <td>${new Date(item.timestamps?.maintenanceEnd).toLocaleString() || ""}</td>
          <td>${item.responseTime || ""}</td>
          <td>${item.repairTime || ""}</td>
          <td>${item.operatingTime || ""}</td>
          <td>${item.downtimeTotal || ""}</td>
          <td>${item.note || ""}</td>
          <td><button onclick="deleteMaintenance('${key}')" class="btn-small btn-danger">Hapus</button></td>
        </tr>
      `;
    });
    maintenanceTableBody.innerHTML = html;
  });
}

// --- Load Data Komponen MTTF ---
function loadComponentData() {
  const componentsRef = ref(db, "components");
  onValue(componentsRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      componentTableBody.innerHTML = '<tr><td colspan="8" class="text-center">Tidak ada data</td></tr>';
      return;
    }

    let html = "";
    let no = 1;
    Object.keys(data).forEach((key) => {
      const item = data[key];
      html += `
        <tr>
          <td>${no++}</td>
          <td>${item.name || ""}</td>
          <td>${item.installDate || ""}</td>
          <td>${item.replaceDate || ""}</td>
          <td>${item.lifetime || ""}</td>
          <td>${item.mttf || ""}</td>
          <td>${item.note || ""}</td>
          <td><button onclick="deleteComponent('${key}')" class="btn-small btn-danger">Hapus</button></td>
        </tr>
      `;
    });
    componentTableBody.innerHTML = html;
  });
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

// --- Init ---
loadMaintenanceData();
loadComponentData();
