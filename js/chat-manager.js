/* ==========================================================================
   Dragon Ball Clash Action TCG - Dojo Leaderboards & Global Chat Engine
   ========================================================================== */

export const DOJO_RANKINGS = [
  { name: "Kame School Dojo", leader: "Master Roshi", power: 15420, icon: "🐢" },
  { name: "Turtle Hermit Clan", leader: "Goku_SSJ", power: 12890, icon: "⚡" },
  { name: "Royal Saiyan Army", leader: "PrinceVegeta", power: 11450, icon: "👑" },
  { name: "Crane School", leader: "Tien_Shin", power: 8900, icon: "👁️" },
  { name: "Red Ribbon Dojos", leader: "Android17", power: 6500, icon: "🤖" }
];

class ChatManager {
  constructor() {
    this.messages = [
      { user: "Goku_SSJ", text: "Who wants a quick clash match? Room code incoming!", time: "10:14" },
      { user: "PrinceVegeta", text: "My Kamehameha clash power is unbeatable!", time: "10:15" },
      { user: "Trunks_Time", text: "Remember to use Z-Vanish against heavy combos!", time: "10:16" }
    ];
  }

  addMessage(user, text) {
    const msg = { user, text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    this.messages.push(msg);
    return msg;
  }
}

export const chatManager = new ChatManager();
