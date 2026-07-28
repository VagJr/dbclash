/* ==========================================================================
   Dragon Ball Clash Action TCG - Dojo Leaderboards & Real-Time Socket.io Chat
   ========================================================================== */

import { socketManager } from './socket-config.js';

export const DOJO_RANKINGS = [
  { name: "Kame School Dojo", leader: "Master Roshi", power: 15420, icon: "🐢" },
  { name: "Turtle Hermit Clan", leader: "Goku_SSJ", power: 12890, icon: "⚡" },
  { name: "Royal Saiyan Army", leader: "PrinceVegeta", power: 11450, icon: "👑" },
  { name: "Crane School", leader: "Tien_Shin", power: 8900, icon: "👁️" },
  { name: "Red Ribbon Dojos", leader: "Android17", power: 6500, icon: "🤖" }
];

class ChatManager {
  constructor() {
    this.messages = [];
    this.onMessageCallback = null;
    this.currentRoom = null;
    this.initSocketChat();
  }

  setRoom(roomId) {
    this.currentRoom = roomId || null;
    this.messages = [];
  }

  initSocketChat() {
    socketManager.on('chat_message', (data) => {
      if (!data) return;

      // Filtering: Room chat vs Global chat
      const isRoomMsg = !!data.roomCode && data.roomCode !== 'global';
      if (isRoomMsg) {
        // If message belongs to another room, drop it
        if (this.currentRoom !== data.roomCode) return;
      } else {
        // If it's a global message, only show if we are in global chat (not in a match room)
        if (this.currentRoom !== null && this.currentRoom !== 'global') return;
      }

      const msg = {
        user: data.user || 'Guerreiro Z',
        text: data.text || '',
        time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        roomCode: data.roomCode || null
      };

      this.messages.push(msg);

      if (this.onMessageCallback) {
        this.onMessageCallback(msg);
      }
    });
  }

  addMessage(user, text) {
    if (!text || !text.trim()) return null;

    // Send chat to server via WebSockets
    socketManager.emit('send_chat', {
      user: user || 'Guerreiro Z',
      text: text.trim(),
      roomCode: this.currentRoom || null
    });

    return null;
  }
}

export const chatManager = new ChatManager();
