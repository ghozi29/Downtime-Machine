import { db, ref, push, update, increment } from "./firebase-config.js";

// ================= INITIALIZATION =================
document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupMaintenanceForm();
  setupComponentForm();
  setupComponentCalculation();
});

// ================= TABS =================
function setupTabs() {
  document.getElementById("tabMaintenanceBtn").addEventListener("click", () => switchTab("maintenance"));
  document.getElementById("tabComponentBtn").addEventListener("click", () => switchTab("component"));
}

function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

  if (tab === "maintenance") {
    document.getElementById("tabMaintenanceBtn").classList.add("active");
    document.getElementById("tabMaintenance").classList.add("active");
  } else {
    document.getElementById("tabComponentBtn").classList.add("active");
    document.getElementById("tabComponent").classList.add("active");
  }
}

// ================= MAINTENANCE FORM =================
function setupMaintenanceForm() {
  const form = document.getElementById("maintenanceForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = "Menyimpan...";
    submitBtn.disabled = true;

    try {
      const machineName = document.getElementById("machineName").value.trim();
      const category = document.getElementById("machineCategory").value;
      const operationStart = document.getElementById("operationStart").value;
      const failureStart = document.getElementById("failureStart").value;
      const maintenanceStart = document.getElementById("maintenanceStart").value;
      const maintenanceEnd = document.getElementById("maintenanceEnd").value;
      const note = document.getElementById("note").value.trim();
      const technicians = Array.from(document.getElementById("technicians").selectedOptions).map(o => o.value);

      // VALIDASI
      if (!machineName || !category || !operationStart || !failureStart || !maintenanceStart || !maintenanceEnd || technicians.length === 0) {
        alert("Semua field wajib diisi!");
        return;
      }

      const opStart = new Date(operationStart);
      const failStart = new Date(failureStart);
      const maintStart = new Date(maintenanceStart);
      const maintEnd = new Date(maintenanceEnd);

      if (failStart <= opStart) { alert("Waktu rusak harus setelah Mulai Operasi!"); return; }
      if (maintStart <= failStart) { alert("Mulai Perbaikan harus setelah Waktu Rusak!"); return; }
      if (maintEnd <= maintStart) { alert("Selesai Perbaikan harus setelah Mulai Perbaikan!"); return; }

      // HITUNG REPAIR TIME (jam)
      const repairTime = (maintEnd - maintStart) / (1000 * 60 * 60);

      // AREA DEFAULT
      const area = "default";

      // SIMPAN RECORD
      const recordData = {
        machineName,
        category,
        operationStart,
        failureStart,
        maintenanceStart,
        maintenanceEnd,
        repairTime,
        technicians,
        note,
        createdAt: new Date().toISOString()
      };

      await push(ref(db, `area/${area}/records`), recordData);

      // UPDATE WORKLOAD PER TEKNISI
      const workloadPerPerson = repairTime / technicians.length;
      const month = new Date().toISOString().slice(0,7);

      const updates = {};
      technicians.forEach(name => {
        updates[`area/${area}/summary/workload/${name}/totalJobs`] = increment(1);
        updates[`area/${area}/summary/workload/${name}/totalRepair`] = increment(workloadPerPerson);
        updates[`area/${area}/summary/monthly/${month}/${name}/jobs`] = increment(1);
        updates[`area/${area}/summary/monthly/${month}/${name}/repair`] = increment(workloadPerPerson);
      });

      await update(ref(db), updates);

      alert("✅ Data berhasil tersimpan!");
      form.reset();

    } catch (err) {
      console.error(err);
      alert("❌ Gagal menyimpan: " + err.message);
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });
}

// ================= COMPONENT FORM =================
function setupComponentForm() {
  const form = document.getElementById("componentForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = "Menyimpan...";
    submitBtn.disabled = true;

    try {
      const componentName = document.getElementById("componentName").value.trim();
      const installDate = document.getElementById("installDate").value;
      const replacementDate = document.getElementById("replacementDate").value;
      const operatingHoursInput = document.getElementById("operatingHours").value;
      const note = document.getElementById("componentNote").value.trim();
      const area = "default";

      if (!componentName || !installDate || !replacementDate) { alert("Nama komponen dan tanggal wajib diisi!"); return; }

      const install = new Date(installDate);
      const replace = new Date(replacementDate);
      if (replace <= install) { alert("Tanggal penggantian harus setelah tanggal pemasangan!"); return; }

      const lifespanHours = (replace - install) / (1000*60*60);

      const componentData = {
        componentName,
        installDate,
        replacementDate,
        lifespanHours,
        operatingHours: operatingHoursInput || lifespanHours,
        note,
        createdAt: new Date().toISOString()
      };

      await push(ref(db, `area/${area}/components`), componentData);
      alert(`✅ Komponen ${componentName} berhasil tersimpan!`);
      form.reset();
      document.getElementById("operatingHours").value = "";

    } catch(err){
      console.error(err);
      alert("❌ Gagal menyimpan: " + err.message);
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });
}

// ================= AUTO CALCULATE OPERATING HOURS =================
function setupComponentCalculation() {
  const installDate = document.getElementById("installDate");
  const replacementDate = document.getElementById("replacementDate");
  const operatingHours = document.getElementById("operatingHours");

  if (!installDate || !replacementDate || !operatingHours) return;

  const calculate = () => {
    if (installDate.value && replacementDate.value) {
      const install = new Date(installDate.value);
      const replace = new Date(replacementDate.value);
      if (replace > install) operatingHours.value = ((replace - install) / (1000*60*60)).toFixed(2);
    }
  };

  installDate.addEventListener("change", calculate);
  replacementDate.addEventListener("change", calculate);
}
