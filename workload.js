import { db, ref, onValue } from "./firebase-config.js";

const container = document.getElementById("workloadContainer");
const monthSelect = document.getElementById("monthFilter");

// 🔥 THRESHOLD INDUSTRI
const THRESHOLD = {
  normal: 120,
  warning: 160
};

// ================= INIT =================
const currentMonth = new Date().toISOString().slice(0, 7);
monthSelect.value = currentMonth;

loadData(currentMonth);

monthSelect.addEventListener("change", () => {
  loadData(monthSelect.value);
});

// ================= LOAD =================
function loadData(month) {
  const area = "default";
  const dbRef = ref(db, `area/${area}/summary/monthly/${month}`);

  onValue(dbRef, snapshot => {
    const data = snapshot.val();
    container.innerHTML = "";

    if (!data) {
      container.innerHTML = "<p>Tidak ada data</p>";
      return;
    }

    Object.keys(data).forEach(name => {
      const tech = data[name];

      const jobs = tech.jobs || 0;
      const repair = tech.repair || 0;

      const status = getStatus(repair);

      const card = document.createElement("div");
      card.className = "card-tech";

      card.innerHTML = `
        <img src="img/${formatName(name)}.jpg" onerror="this.src='img/default.png'">
        <h3>${name}</h3>

        <div class="status ${status.class}">
          ${status.label}
        </div>

        <p>Job: ${jobs}</p>
        <p>Repair Time: ${repair.toFixed(1)} jam</p>
      `;

      container.appendChild(card);
    });
  });
}

// ================= STATUS =================
function getStatus(repair) {
  if (repair > THRESHOLD.warning) {
    return { label: "OVERLOAD 🔴", class: "red" };
  } else if (repair > THRESHOLD.normal) {
    return { label: "WARNING 🟡", class: "yellow" };
  } else {
    return { label: "NORMAL 🟢", class: "green" };
  }
}

// ================= FORMAT FOTO =================
function formatName(name) {
  return name.toLowerCase().replace(/\s/g, "");
}
