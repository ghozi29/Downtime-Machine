// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.6.1/firebase-app.js";
import { 
  getDatabase, ref, push, get, update, remove, increment 
} from "https://www.gstatic.com/firebasejs/10.6.1/firebase-database.js";

// ================== CONFIG ==================
const firebaseConfig = {
  apiKey: "AIzaSyCdjG0w6QOMdYzWsqF_QZKl7yHJOrcyjbQ",
  authDomain: "iotcamar.firebaseapp.com",
  databaseURL: "https://iotcamar-default-rtdb.firebaseio.com",
  projectId: "iotcamar",
  storageBucket: "iotcamar.firebasestorage.app",
  messagingSenderId: "878187768527",
  appId: "1:878187768527:web:e5c6412e811b15251825ba",
  measurementId: "G-V40ZQ4Y9RS"
};

// ================== INITIALIZE ==================
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ================== HELPERS ==================

// Push data ke path tertentu
async function addData(path, data) {
  try {
    const dbRef = ref(db, path);
    const result = await push(dbRef, data);
    return result.key; // kembalikan key baru
  } catch (err) {
    console.error("Push Error:", err);
    throw err;
  }
}

// Get data dari path
async function getData(path) {
  try {
    const snap = await get(ref(db, path));
    return snap.val();
  } catch (err) {
    console.error("Get Error:", err);
    throw err;
  }
}

// Update data (partial) di path tertentu
async function updateData(updatesObj) {
  try {
    await update(ref(db), updatesObj);
  } catch (err) {
    console.error("Update Error:", err);
    throw err;
  }
}

// Hapus data dari path tertentu
async function deleteData(path) {
  try {
    await remove(ref(db, path));
  } catch (err) {
    console.error("Delete Error:", err);
    throw err;
  }
}

// Increment field (untuk summary/workload)
function incrementValue(by = 1) {
  return increment(by);
}

// ================== EXPORT ==================
export {
  db,
  ref,
  push,
  get,
  update,
  remove,
  increment,
  addData,
  getData,
  updateData,
  deleteData,
  incrementValue
};
