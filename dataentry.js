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
  const maintenanceBtn = document.getElementById("tabMaintenanceBtn");
  const componentBtn = document.getElementById("tabComponentBtn");

  maintenanceBtn?.addEventListener("click", () => switchTab("maintenance"));
  componentBtn?.addEventListener("click", () => switchTab("component"));
}

function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));

  document.getElementById(tab === "maintenance" ? "tabMaintenanceBtn" : "tabComponentBtn").classList.add("active");
  document.getElementById(tab === "maintenance" ? "tabMaintenance" : "tabComponent").classList.add("active");
}

// ================= UTIL =================
const getValue = id => document.getElementById(id)?.value;

const getMultiSelectValues = (id) => {
  return Array.from(document.getElementById(id).selectedOptions).map(o => o.value);
};

const toHours = (ms) => ms / (1000 * 60 * 60);

// ================= MAINTENANCE =================
function setupMaintenanceForm() {
  const form = document.getElementById("maintenanceForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = form.querySelector("button[type='submit']");
    toggleBtn(btn, true);

    try {
      const data = collectMaintenanceData();

      if (!data) return toggleBtn(btn, false);

      const dbRef = ref(db, `records`); // 🔥 lebih simple (hindari nested berat)
      await push(dbRef, data);

      showNotification(`✅ Data ${data.machineName} tersimpan`, "success");
      form.reset();

    } catch (err) {
      showNotification("❌ " + err.message, "error");
    } finally {
      toggleBtn(btn, false);
    }
  });
}

function collectMaintenanceData() {
  const machineName = getValue("machineName");
  const category = getValue("machineCategory");

  const operationStart = new Date(getValue("operationStart"));
  const failureStart = new Date(getValue("failureStart"));
  const maintenanceStart = new Date(getValue("maintenanceStart"));
  const maintenanceEnd = new Date(getValue("maintenanceEnd"));

  const technicians = getMultiSelectValues("technicians");
  const note = getValue("note");

  if (!machineName || !category || !technicians.length) {
    showNotification("Data belum lengkap!", "error");
    return null;
  }

  if (failureStart <= operationStart || maintenanceStart <= failureStart || maintenanceEnd <= maintenanceStart) {
    showNotification("Urutan waktu tidak valid!", "error");
    return null;
  }

  const responseTime = toHours(maintenanceStart - failureStart);
  const repairTime = toHours(maintenanceEnd - maintenanceStart);
  const downtime = toHours(maintenanceEnd - failureStart);
  const operatingTime = toHours(failureStart - operationStart);

  // 🔥 workload logic
  const technicianCount = technicians.length;
  const workPerTech = repairTime / technicianCount;

  return {
    machineName,
    category,
    technicians,
    technicianCount,
    workHoursPerTechnician: +workPerTech.toFixed(2),

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
}

// ================= COMPONENT =================
function setupComponentForm() {
  const form = document.getElementById("componentForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = form.querySelector("button[type='submit']");
    toggleBtn(btn, true);

    try {
      const componentName = getValue("componentName");
      const install = new Date(getValue("installDate"));
      const replace = new Date(getValue("replacementDate"));

      if (!componentName || !install || !replace) {
        throw new Error("Data komponen belum lengkap");
      }

      if (replace <= install) {
        throw new Error("Tanggal tidak valid");
      }

      const hours = toHours(replace - install);

      await push(ref(db, "components"), {
        componentName,
        lifespanHours: +hours.toFixed(2),
        createdAt: Date.now()
      });

      showNotification("✅ Komponen tersimpan", "success");
      form.reset();

    } catch (err) {
      showNotification("❌ " + err.message, "error");
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
      const hours = toHours(new Date(replace) - new Date(install));
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
  btn.innerHTML = loading
    ? '<i class="fas fa-spinner fa-spin"></i> Menyimpan...'
    : "Simpan Data";
}

function showNotification(msg, type = "info") {
  const el = document.getElementById("notification");
  if (!el) return;

  el.className = `notification ${type}`;
  el.innerHTML = msg;
  el.style.display = "block";

  setTimeout(() => el.style.display = "none", 4000);
}

window.switchTab = switchTab;
