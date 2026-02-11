import { db } from "./firebase-config.js";
import { ref, push, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const TOTAL_MONTHLY_HOURS = 240; // 8 jam x 30 hari

// Ambil elemen DOM untuk KPI
const mttr = document.getElementById("mttr");
const mtbf = document.getElementById("mtbf");
const mttf = document.getElementById("mttf");
const availability = document.getElementById("availability");
const totalDowntimeElem = document.getElementById("totalDowntime");
const totalBreakdownElem = document.getElementById("totalBreakdown");

const pieChartEl = document.getElementById("pieChart");
const paretoChartEl = document.getElementById("paretoChart");
const barChartEl = document.getElementById("barChart");
const rankChartEl = document.getElementById("rankChart");
const lineChartEl = document.getElementById("lineChart");

let pie, pareto, bar, rank, line;

if (pieChartEl) {
  pie = new Chart(pieChartEl, {
    type: "pie",
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: ["#42a5f5", "#66bb6a", "#ffa726"]
      }]
    }
  });

  pareto = new Chart(paretoChartEl, {
    data: {
      labels: [],
      datasets: [
        {
          type: "bar",
          label: "Downtime",
          data: [],
          backgroundColor: "#42a5f5"
        },
        {
          type: "line",
          label: "Cumulative %",
          data: [],
          borderColor: "#ef5350",
          yAxisID: "y1"
        }
      ]
    },
    options: {
      scales: {
        y: { beginAtZero: true },
        y1: {
          position: "right",
          min: 0,
          max: 100,
          ticks: { callback: val => val + "%" }
        }
      }
    }
  });

  bar = new Chart(barChartEl, {
    type: "bar",
    data: {
      labels: [],
      datasets: [{
        label: "Downtime",
        data: [],
        backgroundColor: "#66bb6a"
      }]
    }
  });

  rank = new Chart(rankChartEl, {
    type: "bar",
    data: {
      labels: [],
      datasets: [{
        label: "Ranking",
        data: [],
        backgroundColor: "#ef5350"
      }]
    },
    options: {
      indexAxis: "y"
    }
  });

  line = new Chart(lineChartEl, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Trend",
        data: [],
        borderColor: "#42a5f5",
        fill: false
      }]
    }
  });
}

// Form Input
const form = document.getElementById("maintenanceForm");
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const notification = document.getElementById("notification");

    try {
      const machineName = document.getElementById("machineName").value.trim();
      const category = document.getElementById("category").value;
      const note = document.getElementById("note").value.trim();
      const start = new Date(document.getElementById("startRepair").value);
      const end = new Date(document.getElementById("endRepair").value);

      if (end <= start) throw "Tanggal selesai harus setelah tanggal mulai.";

      const downtime = (end - start) / (1000 * 60 * 60); // jam

      await push(ref(db, "area/hormon/records"), {
        machineName,
        category,
        note,
        downtimeHours: downtime,
        date: start.toISOString().split("T")[0]
      });

      notification.innerText = "✅ Data berhasil disimpan!";
      notification.className = "notification success";
      notification.style.display = "block";
      setTimeout(() => notification.style.display = "none", 3000);

      form.reset();
    } catch (err) {
      notification.innerText = "❌ " + err;
      notification.className = "notification error";
      notification.style.display = "block";
    }
  });
}

// Ambil data realtime dari Firebase dan update dashboard
onValue(ref(db, "area/hormon/records"), (snapshot) => {
  let totalDowntime = 0;
  let count = 0;
  let categoryData = {};
  let machineData = {};
  let trendData = {};

  const tbody = document.querySelector("#historyTable tbody");
  if (tbody) tbody.innerHTML = "";

  snapshot.forEach(child => {
    let d = child.val();

    totalDowntime += d.downtimeHours;
    count++;

    categoryData[d.category] = (categoryData[d.category] || 0) + d.downtimeHours;
    machineData[d.machineName] = (machineData[d.machineName] || 0) + d.downtimeHours;
    const month = d.date.substring(0, 7);
    trendData[month] = (trendData[month] || 0) + d.downtimeHours;

    if (tbody) {
      tbody.innerHTML += `
        <tr>
          <td>${d.machineName}</td>
          <td>${d.category}</td>
          <td>${d.date}</td>
          <td>${d.downtimeHours.toFixed(2)}</td>
          <td>${d.note}</td>
        </tr>
      `;
    }
  });

  // Update KPI
  if (count > 0) {
    mttr.innerText = (totalDowntime / count).toFixed(2) + " Jam";
    mtbf.innerText = ((TOTAL_MONTHLY_HOURS - totalDowntime) / count).toFixed(2) + " Jam";
    mttf.innerText = (TOTAL_MONTHLY_HOURS / count).toFixed(2) + " Jam";
    availability.innerText = (((TOTAL_MONTHLY_HOURS - totalDowntime) / TOTAL_MONTHLY_HOURS) * 100).toFixed(1) + "%";
    totalDowntimeElem.innerText = totalDowntime.toFixed(2) + " Jam";
    totalBreakdownElem.innerText = count;
  } else {
    mttr.innerText = mtbf.innerText = mttf.innerText = availability.innerText = totalDowntimeElem.innerText = totalBreakdownElem.innerText = "0";
  }

  // Update Pie Chart
  if (pie) {
    pie.data.labels = Object.keys(categoryData);
    pie.data.datasets[0].data = Object.values(categoryData);
    pie.update();

    // Bar Chart Downtime per machine
    bar.data.labels = Object.keys(machineData);
    bar.data.datasets[0].data = Object.values(machineData);
    bar.update();

    // Worst machine ranking (sorted descending)
    let sorted = Object.entries(machineData).sort((a, b) => b[1] - a[1]);

    rank.data.labels = sorted.map(x => x[0]);
    rank.data.datasets[0].data = sorted.map(x => x[1]);
    rank.update();

    // Monthly trend
    const sortedMonths = Object.keys(trendData).sort();
    line.data.labels = sortedMonths;
    line.data.datasets[0].data = sortedMonths.map(m => trendData[m]);
    line.update();

    // Pareto chart
    let cumulative = 0;
    let cumulativeData = [];
    sorted.forEach(item => {
      cumulative += item[1];
      cumulativeData.push((cumulative / totalDowntime * 100).toFixed(1));
    });

    pareto.data.labels = sorted.map(x => x[0]);
    pareto.data.datasets[0].data = sorted.map(x => x[1]);
    pareto.data.datasets[1].data = cumulativeData;
    pareto.update();
  }
});
