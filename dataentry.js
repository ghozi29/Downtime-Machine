import { db, ref, push } from "./firebase-config.js";

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupMaintenanceForm();
  setupComponentForm();
  setupDateCalculation();
});

// ================= TAB =================
function setupTabs() {
  document.getElementById("tabMaintenanceBtn")?.addEventListener("click", () => switchTab("maintenance"));
  document.getElementById("tabComponentBtn")?.addEventListener("click", () => switchTab("component"));
}

function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(tc => tc.classList.remove("active"));

  if (tab === "maintenance") {
    document.getElementById("tabMaintenanceBtn").classList.add("active");
    document.getElementById("tabMaintenance").classList.add("active");
  } else {
    document.getElementById("tabComponentBtn").classList.add("active");
    document.getElementById("tabComponent").classList.add("active");
  }
}

// ================= UTIL =================
const getValue = id => document.getElementById(id)?.value || "";
const getMultiSelectValues = id => Array.from(document.getElementById(id)?.selectedOptions || []).map(o => o.value);
const toHours = ms => ms / (1000 * 60 * 60);

// ================= MAINTENANCE =================
function setupMaintenanceForm() {
  const form = document.getElementById("maintenanceForm");
  if (!form) return;

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = form.querySelector("button[type='submit']");
    toggleBtn(btn, true);

    try {
      const machineName = getValue("machineName");
      const category = getValue("machineCategory");
      const area = getValue("areaSelect");
      const technicians = getMultiSelectValues("personnelSelect");
      const note = getValue("note");

      const operationStart = new Date(getValue("operationStart"));
      const failureStart = new Date(getValue("failureStart"));
      const maintenanceStart = new Date(getValue("maintenanceStart"));
      const maintenanceEnd = new Date(getValue("maintenanceEnd"));

      // VALIDATION
      if (!machineName || !category || !area || technicians.length === 0) {
        showNotification("Lengkapi semua field wajib!", "error");
        toggleBtn(btn, false);
        return;
      }
      if (failureStart <= operationStart || maintenanceStart <= failureStart || maintenanceEnd <= maintenanceStart) {
        showNotification("Urutan waktu tidak valid!", "error");
        toggleBtn(btn, false);
        return;
      }

      // CALC DURATIONS
      const responseTime = toHours(maintenanceStart - failureStart);
      const repairTime = toHours(maintenanceEnd - maintenanceStart);
      const downtime = toHours(maintenanceEnd - failureStart);
      const operatingTime = toHours(failureStart - operationStart);

      // WORKLOAD PER TECHNICIAN
      const technicianCount = technicians.length;
      const workHoursPerTechnician = repairTime / technicianCount;

      // DATA OBJECT
      const recordData = {
        machineName,
        category,
        area,
        technicians,
        technicianCount,
        workHoursPerTechnician: +workHoursPerTechnician.toFixed(2),
        responseTime: +responseTime.toFixed(2),
        repairTime: +repairTime.toFixed(2),
        downtimeTotal: +downtime.toFixed(2),
        operatingTime: +operatingTime.toFixed(2),
        timestamps: {
          operationStart: operationStart.toISOString(),
          failureStart: failureStart.toISOString(),
          maintenanceStart: maintenanceStart.toISOString(),
          maintenanceEnd: maintenanceEnd.toISOString(),
        },
        note,
        createdAt: Date.now()
      };

      // PUSH TO FIREBASE
      await push(ref(db, `records`), recordData);
      showNotification(`✅ Data ${machineName} berhasil disimpan`, "success");
      form.reset();
    } catch (err) {
      console.error(err);
      showNotification("❌ Gagal menyimpan: " + err.message, "error");
    } finally {
      toggleBtn(btn, false);
    }
  });
}

// ================= COMPONENT =================
function setupComponentForm() {
  const form = document.getElementById("componentForm");
  if (!form) return;

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = form.querySelector("button[type='submit']");
    toggleBtn(btn, true);

    try {
      const componentName = getValue("componentName");
      const installDate = new Date(getValue("installDate"));
      const replacementDate = new Date(getValue("replacementDate"));
      const note = getValue("componentNote");

      if (!componentName || !installDate || !replacementDate) throw new Error("Lengkapi semua field komponen");
      if (replacementDate <= installDate) throw new Error("Tanggal penggantian harus setelah pemasangan");

      const lifespanHours = toHours(replacementDate - installDate);

      const componentData = {
        componentName,
        installDate: installDate.toISOString(),
        replacementDate: replacementDate.toISOString(),
        lifespanHours: +lifespanHours.toFixed(2),
        note,
        createdAt: Date.now()
      };

      await push(ref(db, `components`), componentData);
      showNotification(`✅ Komponen ${componentName} berhasil disimpan`, "success");
      form.reset();
      document.getElementById("operatingHours").value = "";
    } catch (err) {
      console.error(err);
      showNotification("❌ Gagal menyimpan: " + err.message, "error");
    } finally {
      toggleBtn(btn, false);
    }
  });
}

// ================= AUTO CALC =================
function setupDateCalculation() {
  const install = document.getElementById("installDate");
  const replace = document.getElementById("replacementDate");
  const output = document.getElementById("operatingHours");

  const calc = () => {
    if (install.value && replace.value) {
      const hours = toHours(new Date(replace.value) - new Date(install.value));
      if (hours > 0) output.value = hours.toFixed(2);
    }
  };
  install?.addEventListener("change", calc);
  replace?.addEventListener("change", calc);
}

// ================= UI =================
function toggleBtn(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading ? '<i class="fas fa-spinner fa-spin"></i> Menyimpan...' : btn.dataset.defaultText || "Simpan";
}

// Notification
function showNotification(msg, type = "info") {
  const el = document.getElementById("notification");
  if (!el) return;
  el.className = `notification ${type}`;
  el.innerHTML = msg;
  el.style.display = "block";
  setTimeout(() => el.style.display = "none", 4000);
}

// Make switchTab global
window.switchTab = switchTab;
