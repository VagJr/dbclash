/* ==========================================================================
   Dragon Ball Clash Action TCG - Dojo Leaderboards & Real-Time Firebase Chat
   ========================================================================== */

import { db } from './firebase-config.js';
import { ref, push, onChildAdded } from 'firebase/database';

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
    this.chatListenerUnsubscribe = null;
    this.initFirebaseChat('global_chat');
  }

  setRoom(roomId) {
    this.currentRoom = roomId;
    this.messages = [];
    this.initFirebaseChat(roomId ? `rooms/${roomId}/chat` : 'global_chat');
  }

  initFirebaseChat(path) {
    if (!db) return;
    try {
      if (this.chatListenerUnsubscribe) {
        // Since Firebase V9 onChildAdded returns the unsubscribe function
        this.chatListenerUnsubscribe();
      }
      const chatRef = ref(db, path);
      this.chatListenerUnsubscribe = onChildAdded(chatRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const msg = {
            user: data.user || 'Guerreiro Z',
            text: data.text || '',
            time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          this.messages.push(msg);
          if (this.onMessageCallback) {
            this.onMessageCallback(msg);
          }
        }
      });
    } catch (e) {
      console.warn('[ChatManager] Firebase chat error:', e);
    }
  }

  addMessage(user, text) {
    if (!text || !text.trim()) return null;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msg = { user, text: text.trim(), time };
    
    if (db) {
      try {
        const path = this.currentRoom ? `rooms/${this.currentRoom}/chat` : 'global_chat';
        push(ref(db, path), msg);
      } catch (e) {
        this.messages.push(msg);
      }
    } else {
      this.messages.push(msg);
    }
    return msg;
  }
}

export const chatManager = new ChatManager();
