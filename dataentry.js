import { db, ref, push, update, increment } from "./firebase-config.js";

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  setupMaintenanceForm();
});

// ================= FORM =================
function setupMaintenanceForm() {
  const form = document.getElementById("maintenanceForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = form.querySelector("button[type='submit']");
    btn.disabled = true;
    btn.innerText = "Menyimpan...";

    try {
      // ===== GET DATA =====
      const machineName = document.getElementById("machineName").value;
      const category = document.getElementById("machineCategory").value;
      const operationStart = document.getElementById("operationStart").value;
      const failureStart = document.getElementById("failureStart").value;
      const maintenanceStart = document.getElementById("maintenanceStart").value;
      const maintenanceEnd = document.getElementById("maintenanceEnd").value;

      const technicians = Array.from(
        document.getElementById("technicians").selectedOptions
      ).map(o => o.value);

      if (!machineName || technicians.length === 0) {
        alert("Data belum lengkap!");
        return;
      }

      // ===== TIME =====
      const opStart = new Date(operationStart);
      const failStart = new Date(failureStart);
      const maintStart = new Date(maintenanceStart);
      const maintEnd = new Date(maintenanceEnd);

      const repairTime = (maintEnd - maintStart) / 3600000;

      // ===== AREA =====
      const area = document.getElementById("areaSelect")?.value || "default";

      // ===== DATE =====
      const now = new Date();
      const month = now.toISOString().slice(0, 7);

      // ===== RAW SAVE =====
      await push(ref(db, `area/${area}/records`), {
        machineName,
        category,
        technicians,
        repairTime,
        createdAt: now.toISOString()
      });

      // ===== WORKLOAD CALC =====
      const workloadPerPerson = repairTime / technicians.length;

      const updates = {};

      technicians.forEach(name => {
        // total
        updates[`area/${area}/summary/workload/${name}/totalJobs`] = increment(1);
        updates[`area/${area}/summary/workload/${name}/totalRepair`] = increment(workloadPerPerson);

        // bulanan
        updates[`area/${area}/summary/monthly/${month}/${name}/jobs`] = increment(1);
        updates[`area/${area}/summary/monthly/${month}/${name}/repair`] = increment(workloadPerPerson);
      });

      await update(ref(db), updates);

      alert("✅ Data tersimpan & workload terupdate");
      form.reset();

    } catch (err) {
      console.error(err);
      alert("❌ Error");
    } finally {
      btn.disabled = false;
      btn.innerText = "Simpan Data Mesin";
    }
  });
}
