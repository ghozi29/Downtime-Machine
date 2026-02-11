import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "WWWPaooyjOdxYeGKHvzFoA0fw8fceyHlrNhg3pOw",
  databaseURL: "https://iotcamar-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
