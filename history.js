import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, onValue, remove } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

// Konfigurasi Firebase (ganti sesuai milikmu)
const firebaseConfig = {
  apiKey: "API_KEY",
  authDomain: "PROJECT.firebaseapp.com",
  databaseURL: "https://iotcamar-default-rtdb.firebaseio.com",
  projectId: "PROJECT_ID",
  storageBucket: "PROJECT.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function formatDate(dateInput) {
  if (!dateInput) return '-';
  let d;
  if (typeof dateInput === 'number') d = new Date(dateInput);
  else d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID');
}

function resetFilters() {
  document.getElementById('filterDate').value = '';
  document.getElementById('filterMonth').value = '';
  document.getElementById('filterYear').value = '';
  document.getElementById('filterCategory').value = '';
  document.getElementById('filterMachine').value = '';
  document.getElementById('filterResultCount').textContent = '';
}

function loadComponentData() {
  const compRef = ref(db, 'components');
  const tbody = document.getElementById('componentTableBody');
  tbody.innerHTML = '<tr><td colspan="8" class="text-center">Memuat data...</td></tr>';

  onValue(compRef, (snapshot) => {
    const data = snapshot.val();
    tbody.innerHTML = '';
    if (!data) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center">Tidak ada data komponen.</td></tr>';
      return;
    }

    let index = 1;
    for (const key in data) {
      const comp = data[key];

      const installDate = formatDate(comp.installDate);
      const replacementDate = formatDate(comp.replacementDate);
      const lifespan = comp.lifespanHours ?? '-';
      const note = comp.note || '-';

      const row = `
        <tr>
          <td>${index++}</td>
          <td>${comp.componentName || '-'}</td>
          <td>${installDate}</td>
          <td>${replacementDate}</td>
          <td>${lifespan}</td>
          <td>${lifespan}</td>
          <td>${note}</td>
          <td><button class="btn-small btn-danger btn-delete-component" data-key="${key}">Hapus</button></td>
        </tr>
      `;
      tbody.insertAdjacentHTML('beforeend', row);
    }
    attachDeleteComponentListeners();
  }, { onlyOnce: true });
}

function loadMaintenanceData(filter = {}) {
  const refMaintenance = ref(db, 'maintenanceHistory');
  const tbody = document.getElementById('maintenanceTableBody');
  tbody.innerHTML = '<tr><td colspan="13" class="text-center">Memuat data...</td></tr>';

  onValue(refMaintenance, (snapshot) => {
    const data = snapshot.val();
    tbody.innerHTML = '';
    if (!data) {
      tbody.innerHTML = '<tr><td colspan="13" class="text-center">Tidak ada data maintenance.</td></tr>';
      return;
    }

    const filtered = Object.entries(data).filter(([key, item]) => {
      if (filter.date) {
        const itemDate = item.breakdownTime || item.operatingStart;
        if (!itemDate) return false;
        if (formatDate(itemDate) !== filter.date) return false;
      }
      if (filter.month) {
        if (!item.breakdownTime) return false;
        const d = new Date(item.breakdownTime);
        const [year, month] = filter.month.split('-');
        if (d.getFullYear() !== +year || d.getMonth() + 1 !== +month) return false;
      }
      if (filter.year) {
        if (!item.breakdownTime) return false;
        const d = new Date(item.breakdownTime);
        if (d.getFullYear() !== +filter.year) return false;
      }
      if (filter.category && filter.category !== '') {
        if (!item.category || item.category.toLowerCase() !== filter.category.toLowerCase()) return false;
      }
      if (filter.machine && filter.machine !== '') {
        if (!item.machineName || !item.machineName.toLowerCase().includes(filter.machine.toLowerCase())) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="13" class="text-center">Data tidak ditemukan sesuai filter.</td></tr>';
      document.getElementById('filterResultCount').textContent = 'Data ditemukan: 0';
      return;
    }

    document.getElementById('filterResultCount').textContent = `Data ditemukan: ${filtered.length}`;

    filtered.forEach(([key, item], idx) => {
      const operatingStart = formatDate(item.operatingStart);
      const breakdownTime = formatDate(item.breakdownTime);
      const repairStart = formatDate(item.repairStart);
      const repairEnd = formatDate(item.repairEnd);

      const responseTime = item.responseTime ?? '-';
      const repairTime = item.repairTime ?? '-';
      const operatingTime = item.operatingTime ?? '-';
      const totalDowntime = item.totalDowntime ?? '-';
      const note = item.note || '-';

      const row = `
        <tr>
          <td>${idx + 1}</td>
          <td>${item.machineName || '-'}</td>
          <td>${item.category || '-'}</td>
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
      tbody.insertAdjacentHTML('beforeend', row);
    });
    attachDeleteMaintenanceListeners();
  }, { onlyOnce: true });
}

// Attach listener untuk tombol hapus komponen
function attachDeleteComponentListeners() {
  document.querySelectorAll('.btn-delete-component').forEach(button => {
    button.onclick = () => {
      const key = button.getAttribute('data-key');
      if (confirm('Yakin ingin menghapus data komponen ini?')) {
        remove(ref(db, `components/${key}`))
          .then(() => {
            alert('Data komponen berhasil dihapus');
            loadComponentData();
          })
          .catch(err => alert('Gagal menghapus data: ' + err.message));
      }
    };
  });
}

// Attach listener untuk tombol hapus maintenance
function attachDeleteMaintenanceListeners() {
  document.querySelectorAll('.btn-delete-maintenance').forEach(button => {
    button.onclick = () => {
      const key = button.getAttribute('data-key');
      if (confirm('Yakin ingin menghapus data maintenance ini?')) {
        remove(ref(db, `maintenanceHistory/${key}`))
          .then(() => {
            alert('Data maintenance berhasil dihapus');
            loadMaintenanceData();
          })
          .catch(err => alert('Gagal menghapus data: ' + err.message));
      }
    };
  });
}

function exportTableToExcel(tableId, filename = 'data.xlsx') {
  const table = document.getElementById(tableId);
  if (!table) return alert('Tabel tidak ditemukan.');

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.table_to_sheet(table);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filename);
}

document.addEventListener('DOMContentLoaded', () => {
  loadComponentData();
  loadMaintenanceData();

  document.getElementById('resetAllFilters').addEventListener('click', () => {
    resetFilters();
    loadMaintenanceData();
  });

  document.getElementById('applyFilter').addEventListener('click', () => {
    const filter = {
      date: document.getElementById('filterDate').value,
      month: document.getElementById('filterMonth').value,
      year: document.getElementById('filterYear').value,
      category: document.getElementById('filterCategory').value,
      machine: document.getElementById('filterMachine').value.trim(),
    };
    loadMaintenanceData(filter);
  });

  document.getElementById('exportMaintenance').addEventListener('click', () => {
    exportTableToExcel('maintenanceTable', 'HistoryMaintenance.xlsx');
  });

  document.getElementById('exportComponents').addEventListener('click', () => {
    exportTableToExcel('componentTable', 'HistoryComponents.xlsx');
  });
});
