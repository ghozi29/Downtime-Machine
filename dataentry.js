import { db, ref, push } from "./firebase-config.js";

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  console.log("Data Entry page loaded");
  
  // Setup tabs
  document.getElementById("tabMaintenanceBtn")?.addEventListener("click", () => switchTab('maintenance'));
  document.getElementById("tabComponentBtn")?.addEventListener("click", () => switchTab('component'));
  
  // Setup area selector
  document.getElementById("areaSelect")?.addEventListener("change", (e) => {
    showNotification(`Area berubah ke: ${e.target.value}`, "info");
  });
  
  // Setup forms
  setupMaintenanceForm();
  setupComponentForm();
  setupDateCalculation();
});

// ================= SWITCH TAB =================
function switchTab(tab) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  if (tab === 'maintenance') {
    document.getElementById("tabMaintenanceBtn").classList.add('active');
    document.getElementById("tabMaintenance").classList.add('active');
    document.getElementById("tabComponent").classList.remove('active');
  } else {
    document.getElementById("tabComponentBtn").classList.add('active');
    document.getElementById("tabComponent").classList.add('active');
    document.getElementById("tabMaintenance").classList.remove('active');
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
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    submitBtn.disabled = true;
    
    try {
      // Get values
      const machineName = document.getElementById("machineName").value;
      const category = document.getElementById("machineCategory").value;
      const operationStart = document.getElementById("operationStart").value;
      const failureStart = document.getElementById("failureStart").value;
      const maintenanceStart = document.getElementById("maintenanceStart").value;
      const maintenanceEnd = document.getElementById("maintenanceEnd").value;
      const note = document.getElementById("note").value;
      
      // Validate
      if (!machineName || !category || !operationStart || !failureStart || !maintenanceStart || !maintenanceEnd) {
        showNotification("Semua field wajib diisi!", "error");
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        return;
      }
      
      // Validate time order
      const opStart = new Date(operationStart);
      const failStart = new Date(failureStart);
      const maintStart = new Date(maintenanceStart);
      const maintEnd = new Date(maintenanceEnd);
      
      if (failStart <= opStart) {
        showNotification("Waktu rusak harus SETELAH operasi mulai!", "error");
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        return;
      }
      
      if (maintStart <= failStart) {
        showNotification("Waktu mulai perbaikan harus SETELAH waktu rusak!", "error");
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        return;
      }
      
      if (maintEnd <= maintStart) {
        showNotification("Waktu selesai perbaikan harus SETELAH waktu mulai!", "error");
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        return;
      }
      
      // Calculate durations
      const responseTime = (maintStart - failStart) / (1000 * 60 * 60);
      const repairTime = (maintEnd - maintStart) / (1000 * 60 * 60);
      const downtimeTotal = (maintEnd - failStart) / (1000 * 60 * 60);
      const operatingTime = (failStart - opStart) / (1000 * 60 * 60);
      
      // Get current area
      const area = document.getElementById("areaSelect").value;
      
      // Prepare data
      const recordData = {
        machineName,
        category,
        operationStart,
        failureStart,
        maintenanceStart,
        maintenanceEnd,
        responseTime: parseFloat(responseTime.toFixed(2)),
        repairTime: parseFloat(repairTime.toFixed(2)),
        downtimeTotal: parseFloat(downtimeTotal.toFixed(2)),
        operatingTime: parseFloat(operatingTime.toFixed(2)),
        note,
        createdAt: new Date().toISOString()
      };
      
      console.log("Saving to Firebase:", recordData);
      
      // Save to Firebase
      const dbRef = ref(db, `area/${area}/records`);
      const result = await push(dbRef, recordData);
      
      console.log("Saved with ID:", result.key);
      
      showNotification(`
        <strong>✅ Data berhasil disimpan!</strong><br>
        Mesin: ${machineName}<br>
        Downtime: ${downtimeTotal.toFixed(2)} jam
      `, "success");
      
      form.reset();
      
    } catch (error) {
      console.error("Error saving:", error);
      showNotification("❌ Gagal menyimpan: " + error.message, "error");
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
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    submitBtn.disabled = true;
    
    try {
      const componentName = document.getElementById("componentName").value;
      const installDate = document.getElementById("installDate").value;
      const replacementDate = document.getElementById("replacementDate").value;
      const operatingHours = document.getElementById("operatingHours").value;
      const note = document.getElementById("componentNote").value;
      
      if (!componentName || !installDate || !replacementDate) {
        showNotification("Nama komponen, tanggal pasang dan ganti wajib diisi!", "error");
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        return;
      }
      
      const install = new Date(installDate);
      const replace = new Date(replacementDate);
      
      if (replace <= install) {
        showNotification("Tanggal penggantian harus setelah tanggal pemasangan!", "error");
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        return;
      }
      
      const lifespanHours = (replace - install) / (1000 * 60 * 60);
      const area = document.getElementById("areaSelect").value;
      
      const componentData = {
        componentName,
        installDate,
        replacementDate,
        lifespanHours: parseFloat(lifespanHours.toFixed(2)),
        operatingHours: operatingHours || lifespanHours,
        note,
        createdAt: new Date().toISOString()
      };
      
      console.log("Saving component:", componentData);
      
      const dbRef = ref(db, `area/${area}/components`);
      const result = await push(dbRef, componentData);
      
      showNotification(`✅ Komponen ${componentName} berhasil disimpan!`, "success");
      
      form.reset();
      document.getElementById("operatingHours").value = "";
      
    } catch (error) {
      console.error("Error:", error);
      showNotification("❌ Gagal menyimpan: " + error.message, "error");
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });
}

// ================= AUTO CALCULATE =================
function setupDateCalculation() {
  const installDate = document.getElementById("installDate");
  const replacementDate = document.getElementById("replacementDate");
  const operatingHours = document.getElementById("operatingHours");
  
  if (installDate && replacementDate) {
    const calculate = () => {
      if (installDate.value && replacementDate.value) {
        const install = new Date(installDate.value);
        const replace = new Date(replacementDate.value);
        
        if (replace > install) {
          const hours = (replace - install) / (1000 * 60 * 60);
          operatingHours.value = hours.toFixed(2);
        }
      }
    };
    
    installDate.addEventListener("change", calculate);
    replacementDate.addEventListener("change", calculate);
  }
}

// ================= NOTIFICATION =================
function showNotification(message, type = "info") {
  const notification = document.getElementById("notification");
  if (!notification) return;
  
  notification.className = `notification ${type}`;
  notification.innerHTML = message;
  notification.style.display = "block";
  
  setTimeout(() => {
    notification.style.display = "none";
  }, 5000);
}

// Make function global for HTML onclick
window.switchTab = switchTab;