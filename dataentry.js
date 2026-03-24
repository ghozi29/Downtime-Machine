import { db, ref, push, update } from "./firebase-config.js";

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  setupMaintenanceForm();
  setupComponentForm();
  setupDateCalculation();
});

// ================= MAINTENANCE FORM =================
function setupMaintenanceForm() {
  const form = document.getElementById("maintenanceForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = 'Menyimpan...';
    submitBtn.disabled = true;

    try {
      // ================= GET DATA =================
      const machineName = document.getElementById("machineName").value;
      const category = document.getElementById("machineCategory").value;
      const operationStart = document.getElementById("operationStart").value;
      const failureStart = document.getElementById("failureStart").value;
      const maintenanceStart = document.getElementById("maintenanceStart").value;
      const maintenanceEnd = document.getElementById("maintenanceEnd").value;
      const note = document.getElementById("note").value;

      // ✅ MULTI PERSONIL
      const technicians = Array.from(
        document.getElementById("technicians").selectedOptions
      ).map(opt => opt.value);

      // ================= VALIDASI =================
      if (!machineName || !category || !operationStart || !failureStart || !maintenanceStart || !maintenanceEnd || technicians.length === 0) {
        alert("Semua field wajib diisi!");
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        return;
      }

      // ================= TIME CALCULATION =================
      const opStart = new Date(operationStart);
      const failStart = new Date(failureStart);
      const maintStart = new Date(maintenanceStart);
      const maintEnd = new Date(maintenanceEnd);

      const responseTime = (maintStart - failStart) / 3600000;
      const repairTime = (maintEnd - maintStart) / 3600000;
      const downtimeTotal = (maintEnd - failStart) / 3600000;
      const operatingTime = (failStart - opStart) / 3600000;

      // ================= AREA SAFE =================
      const area = document.getElementById("areaSelect")?.value || "default";

      // ================= DATE HELPER =================
      const now = new Date();
      const month = now.toISOString().slice(0, 7);

      // ================= RAW DATA =================
      const recordData = {
        machineName,
        category,
        technicians,
        operationStart,
        failureStart,
        maintenanceStart,
        maintenanceEnd,
        responseTime: +responseTime.toFixed(2),
        repairTime: +repairTime.toFixed(2),
        downtimeTotal: +downtimeTotal.toFixed(2),
        operatingTime: +operatingTime.toFixed(2),
        note,
        month,
        createdAt: now.toISOString()
      };

      // ================= SAVE RAW =================
      const newRef = await push(ref(db, `area/${area}/records`), recordData);

      // ================= UPDATE SUMMARY (🔥 OPTIMASI) =================
      const updates = {};

      technicians.forEach(name => {
        updates[`area/${area}/summary/workload/${name}/totalJobs`] = 1;
        updates[`area/${area}/summary/workload/${name}/totalDowntime`] = downtimeTotal;

        // summary bulanan
        updates[`area/${area}/summary/monthly/${month}/technicians/${name}/jobs`] = 1;
        updates[`area/${area}/summary/monthly/${month}/technicians/${name}/downtime`] = downtimeTotal;
      });

      await update(ref(db), updates);

      // ================= SUCCESS =================
      alert(`Data berhasil disimpan!\nDowntime: ${downtimeTotal.toFixed(2)} jam`);

      form.reset();

    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan data!");
    } finally {
      submitBtn.innerHTML = "Simpan Data Mesin";
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

    const componentName = document.getElementById("componentName").value;
    const installDate = document.getElementById("installDate").value;
    const replacementDate = document.getElementById("replacementDate").value;

    const install = new Date(installDate);
    const replace = new Date(replacementDate);

    const lifespanHours = (replace - install) / 3600000;

    const area = document.getElementById("areaSelect")?.value || "default";

    const data = {
      componentName,
      installDate,
      replacementDate,
      lifespanHours: +lifespanHours.toFixed(2),
      createdAt: new Date().toISOString()
    };

    await push(ref(db, `area/${area}/components`), data);

    alert("Komponen disimpan!");
    form.reset();
  });
}

// ================= AUTO CALC =================
function setupDateCalculation() {
  const installDate = document.getElementById("installDate");
  const replacementDate = document.getElementById("replacementDate");
  const operatingHours = document.getElementById("operatingHours");

  const calc = () => {
    if (installDate.value && replacementDate.value) {
      const hours = (new Date(replacementDate.value) - new Date(installDate.value)) / 3600000;
      if (hours > 0) operatingHours.value = hours.toFixed(2);
    }
  };

  installDate?.addEventListener("change", calc);
  replacementDate?.addEventListener("change", calc);
}
