import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, push, onValue, remove, update };
export default db;
