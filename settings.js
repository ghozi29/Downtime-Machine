// settings.js
import { db, ref, set, onValue, update } from "./firebase-config.js";

// ================= GLOBAL VARIABLES =================
let emailList = [];
let currentTheme = 'light';
let autoExport = false;
let notifyOnDelete = false;

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  console.log("Settings page loaded");

  // Load existing settings
  loadSettings();

  // Add email
  document.getElementById("addEmailBtn")?.addEventListener("click", addEmail);

  // Theme change
  document.querySelectorAll('input[name="theme"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      currentTheme = e.target.value;
      saveSettings();
      applyTheme();
    });
  });

  // Feature toggles
  document.getElementById("autoExport")?.addEventListener("change", (e) => {
    autoExport = e.target.checked;
    saveSettings();
  });

  document.getElementById("notifyOnDelete")?.addEventListener("change", (e) => {
    notifyOnDelete = e.target.checked;
    saveSettings();
  });
});

// ================= LOAD SETTINGS =================
function loadSettings() {
  const settingsRef = ref(db, `settings`);
  onValue(settingsRef, (snapshot) => {
    const data = snapshot.val() || {};
    
    emailList = data.emails || [];
    currentTheme = data.theme || 'light';
    autoExport = data.autoExport || false;
    notifyOnDelete = data.notifyOnDelete || false;

    renderEmailList();
    applyTheme();

    document.getElementById("autoExport").checked = autoExport;
    document.getElementById("notifyOnDelete").checked = notifyOnDelete;
    document.querySelector(`input[name="theme"][value="${currentTheme}"]`).checked = true;
  }, { onlyOnce: true });
}

// ================= EMAIL HANDLING =================
function addEmail() {
  const emailInput = document.getElementById("emailInput");
  const email = emailInput.value.trim();

  if (!email || !validateEmail(email)) {
    alert("Masukkan email yang valid!");
    return;
  }

  if (emailList.includes(email)) {
    alert("Email sudah terdaftar!");
    return;
  }

  emailList.push(email);
  emailInput.value = '';
  renderEmailList();
  saveSettings();
}

function removeEmail(email) {
  if (!confirm(`Hapus email ${email}?`)) return;
  emailList = emailList.filter(e => e !== email);
  renderEmailList();
  saveSettings();
}

function renderEmailList() {
  const ul = document.getElementById("emailList");
  ul.innerHTML = '';

  if (emailList.length === 0) {
    ul.innerHTML = '<li>Tidak ada email terdaftar</li>';
    return;
  }

  emailList.forEach(email => {
    const li = document.createElement("li");
    li.innerHTML = `${email} <button onclick="removeEmail('${email}')"><i class="fas fa-trash"></i></button>`;
    ul.appendChild(li);
  });
}

window.removeEmail = removeEmail; // agar bisa dipanggil dari HTML onclick

// ================= THEME =================
function applyTheme() {
  document.body.setAttribute('data-theme', currentTheme);
}

// ================= SAVE SETTINGS =================
function saveSettings() {
  const settingsRef = ref(db, `settings`);
  set(settingsRef, {
    emails: emailList,
    theme: currentTheme,
    autoExport: autoExport,
    notifyOnDelete: notifyOnDelete
  })
  .then(() => console.log("Settings saved"))
  .catch(err => console.error("Error saving settings:", err));
}

// ================= UTILITIES =================
function validateEmail(email) {
  // regex sederhana untuk email
  const re = /\S+@\S+\.\S+/;
  return re.test(email);
}
