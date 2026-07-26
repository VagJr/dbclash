/* ==========================================================================
   Dragon Ball Clash Action TCG - Firebase Config & Modular Setup
   ========================================================================== */

// Firebase SDK Configuration template
export const firebaseConfig = {
  apiKey: "AIzaSyDemoKeyDBTCGApp2026",
  authDomain: "dbtcg-clash.firebaseapp.com",
  databaseURL: "https://dbtcg-clash-default-rtdb.firebaseio.com",
  projectId: "dbtcg-clash",
  storageBucket: "dbtcg-clash.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:demoappkeydbtcg"
};

class FirebaseManager {
  constructor() {
    this.isOnline = false;
    this.currentRoomId = null;
  }

  init() {
    console.log("[FirebaseManager] Initializing Firebase SDK configuration template...");
    // Will dynamically initialize if network and real credentials exist,
    // otherwise gracefully fall back to local realtime room simulator for Instant AI / Peer sandbox!
  }

  generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }
}

export const firebaseManager = new FirebaseManager();
firebaseManager.init();
