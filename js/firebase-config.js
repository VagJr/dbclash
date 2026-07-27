/* ==========================================================================
   Dragon Ball Clash Action TCG — Official Firebase Realtime Database
   ========================================================================== */

import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, push, onValue, onChildAdded, remove, serverTimestamp } from "firebase/database";

export const firebaseConfig = {
  apiKey: "AIzaSyC7QPgafnNuSmEiMq5QoENvzHYbubd-IyM",
  authDomain: "dragonclash.firebaseapp.com",
  databaseURL: "https://dragonclash-default-rtdb.firebaseio.com",
  projectId: "dragonclash",
  storageBucket: "dragonclash.firebasestorage.app",
  messagingSenderId: "185764498121",
  appId: "1:185764498121:web:661ae2ae1d73b4722f5b18",
  measurementId: "G-KQRYP0DHSC"
};

let app = null;
let db = null;

try {
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  console.log("[FirebaseManager] Connected to Realtime Database WebSockets!");
} catch (e) {
  console.warn("[FirebaseManager] Initialization warning:", e);
}

export { db, ref, set, push, onValue, onChildAdded, remove, serverTimestamp };

class FirebaseManager {
  constructor() {
    this.isOnline = true;
    this.config = firebaseConfig;
    this.databaseURL = firebaseConfig.databaseURL;
    this.db = db;
  }

  generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }
}

export const firebaseManager = new FirebaseManager();
