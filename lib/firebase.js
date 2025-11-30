import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyA7t3kr9r5kE-MpwxgeQphpI2GC4MrggPA",
  authDomain: "saferoute-ebc53.firebaseapp.com",
  projectId: "saferoute-ebc53",
  storageBucket: "saferoute-ebc53.firebasestorage.app",
  messagingSenderId: "347906821298",
  appId: "1:347906821298:web:5816a0f69c3596c7ed0dab",
  measurementId: "G-Z9F1WNHSCM",

  // IMPORTANT: Only the ROOT URL
  databaseURL:
    "https://saferoute-ebc53-default-rtdb.asia-southeast1.firebasedatabase.app/",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
