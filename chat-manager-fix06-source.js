/* ==========================================================================
   Dragon Ball Clash Action TCG - Real-Time Socket.io Chat
   ========================================================================== */

import { socketManager } from './socket-config.js';

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
    socketManager.on('chat_message', data => {
      if (!data) return;

      const isRoomMsg = !!data.roomCode && data.roomCode !== 'global';
      if (isRoomMsg) {
        if (this.currentRoom !== data.roomCode) return;
      } else if (this.currentRoom !== null && this.currentRoom !== 'global') {
        return;
      }

      const msg = {
        user: String(data.user || 'Guerreiro Z').slice(0, 40),
        text: String(data.text || '').slice(0, 300),
        time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        roomCode: data.roomCode || null
      };

      this.messages.push(msg);
      if (this.messages.length > 100) this.messages.shift();
      if (this.onMessageCallback) this.onMessageCallback(msg);
    });
  }

  addMessage(_ignoredUser, text) {
    const clean = String(text || '').trim().slice(0, 300);
    if (!clean) return null;

    socketManager.emit('send_chat', {
      text: clean,
      roomCode: this.currentRoom || null
    });

    return null;
  }
}

export const chatManager = new ChatManager();
