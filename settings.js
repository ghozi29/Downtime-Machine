import { db, ref, set, get } from "./firebase-config.js";

// ================= ELEMENTS =================
const themeSelect = document.getElementById("themeSelect");
const notifEmail = document.getElementById("notifEmail");
const saveEmailBtn = document.getElementById("saveEmailBtn");
const testEmailBtn = document.getElementById("testEmailBtn");
const defaultChart = document.getElementById("defaultChart");
const defaultPeriod = document.getElementById("defaultPeriod");
const resetSettingsBtn = document.getElementById("resetSettingsBtn");
const notification = document.getElementById("notification");

// ================= GLOBAL =================
const settingsRef = ref(db, "settings");

// ================= INIT =================
document.addEventListener("DOMContentLoaded", async () => {
  loadSettings();
});

// ================= LOAD SETTINGS =================
async function loadSettings() {
  try {
    const snapshot = await get(settingsRef);
    const data = snapshot.exists() ? snapshot.val() : {};

    // Load Theme
    if (data.theme) {
      themeSelect.value = data.theme;
      applyTheme(data.theme);
    }

    // Load Email
    if (data.email) notifEmail.value = data.email;

    // Load chart & period
    if (data.defaultChart) defaultChart.value = data.defaultChart;
    if (data.defaultPeriod) defaultPeriod.value = data.defaultPeriod;

  } catch (err) {
    showNotification("Gagal memuat pengaturan: " + err.message, "error");
  }
}

// ================= SAVE SETTINGS =================
saveEmailBtn.addEventListener("click", () => {
  const email = notifEmail.value.trim();
  if (!email) return showNotification("Email tidak boleh kosong", "error");

  set(ref(db, "settings/email"), email)
    .then(() => showNotification("Email berhasil disimpan", "success"))
    .catch(err => showNotification("Gagal simpan email: " + err.message, "error"));
});

// ================= THEME CHANGE =================
themeSelect.addEventListener("change", () => {
  const theme = themeSelect.value;
  applyTheme(theme);
  set(ref(db, "settings/theme"), theme);
});

function applyTheme(theme) {
  document.body.className = theme;
}

// ================= DASHBOARD PREFERENCES =================
defaultChart.addEventListener("change", () => {
  set(ref(db, "settings/defaultChart"), defaultChart.value);
});

defaultPeriod.addEventListener("change", () => {
  set(ref(db, "settings/defaultPeriod"), defaultPeriod.value);
});

// ================= RESET =================
resetSettingsBtn.addEventListener("click", () => {
  if (!confirm("Yakin ingin reset semua pengaturan ke default?")) return;

  const defaultSettings = {
    theme: "light",
    email: "",
    defaultChart: "line",
    defaultPeriod: "month"
  };

  set(settingsRef, defaultSettings)
    .then(() => {
      loadSettings();
      showNotification("Pengaturan berhasil direset", "success");
    })
    .catch(err => showNotification("Gagal reset: " + err.message, "error"));
});

// ================= TEST EMAIL =================
testEmailBtn.addEventListener("click", async () => {
  const email = notifEmail.value.trim();
  if (!email) return showNotification("Email tidak boleh kosong", "error");

  try {
    // Kirim request ke Cloud Function / backend untuk kirim email
    const res = await fetch("/sendTestEmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const data = await res.json();
    if (data.success) showNotification("Test email berhasil dikirim!", "success");
    else showNotification("Gagal kirim test email", "error");

  } catch (err) {
    showNotification("Error: " + err.message, "error");
  }
});

// ================= UTIL =================
function showNotification(msg, type = "info") {
  notification.className = `notification ${type}`;
  notification.innerText = msg;
  notification.style.display = "block";
  setTimeout(() => notification.style.display = "none", 3000);
}
