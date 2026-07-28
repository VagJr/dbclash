/* ==========================================================================
   Dragon Ball Clash Action TCG — Socket.io Client Connection & Anti-Sleep Keep-Alive
   Configured for Render Backend & Vercel Frontend Deployment
   ========================================================================== */

class SocketManager {
  constructor() {
    this.socket = null;
    this.serverUrl = this.detectServerUrl();
    this.keepAliveInterval = null;
    this.initSocket();
  }

  detectServerUrl() {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname || '';
      
      // 1. Explicit window override
      if (window.SERVER_URL) return window.SERVER_URL;

      // 2. Localhost / Local IP detection
      if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.endsWith('.local')) {
        return `http://${host}:3000`;
      }

      // 3. LocalStorage override for production customization
      if (typeof localStorage !== 'undefined' && localStorage.getItem('dbtcg_server_url')) {
        return localStorage.getItem('dbtcg_server_url');
      }
    }

    // 4. Default Render Production URL fallback
    return 'https://dbclash-server.onrender.com';
  }

  setServerUrl(url) {
    if (!url) return;
    this.serverUrl = url;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('dbtcg_server_url', url);
    }
    this.reconnect();
  }

  initSocket() {
    if (typeof io === 'undefined') {
      console.warn('[SocketManager] Socket.io client SDK not loaded yet. Retrying in 300ms...');
      setTimeout(() => this.initSocket(), 300);
      return;
    }

    try {
      console.log(`[SocketManager] Connecting to server URL: ${this.serverUrl}`);
      
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
      });

      this.socket.on('connect', () => {
        console.log(`⚡ [SocketManager] Connected successfully to: ${this.serverUrl} (Socket ID: ${this.socket.id})`);
        this.startKeepAlive();
      });

      this.socket.on('disconnect', (reason) => {
        console.warn(`⚠️ [SocketManager] Disconnected: ${reason}`);
      });

      this.socket.on('connect_error', (err) => {
        console.warn(`❌ [SocketManager] Connection error to ${this.serverUrl}:`, err.message);
      });
    } catch (e) {
      console.error('[SocketManager] Failed to initialize socket:', e);
    }
  }

  reconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
    this.initSocket();
  }

  startKeepAlive() {
    if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);

    // Ping Render server every 3.5 minutes (210,000 ms) to prevent sleeping
    this.keepAliveInterval = setInterval(() => {
      fetch(`${this.serverUrl}/ping`)
        .then(res => res.json())
        .then(data => {
          if (this.socket && this.socket.connected) {
            this.socket.emit('keep_alive_ping');
          }
        })
        .catch(() => {});
    }, 210000);
  }

  emit(event, data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn(`[SocketManager] Cannot emit '${event}': Socket disconnected.`);
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

export const socketManager = new SocketManager();
