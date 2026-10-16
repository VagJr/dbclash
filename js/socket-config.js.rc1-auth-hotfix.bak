/* ==========================================================================
   Dragon Ball Clash Action TCG - Resilient Authenticated Socket Client
   ========================================================================== */

class SocketManager {
  constructor() {
    this.socket = null;
    this.serverUrl = this.detectServerUrl();
    this.keepAliveInterval = null;
    this.listeners = new Map();
    this.authToken = this.readAuthToken();
    this.connectWaiters = [];

    if (typeof window !== 'undefined') {
      window.addEventListener('dbclash-auth-changed', event => {
        this.setAuthToken(event?.detail?.token || null);
      });
    }

    this.initSocket();
  }

  readAuthToken() {
    try {
      return typeof localStorage !== 'undefined'
        ? localStorage.getItem('dbtcg_session_token')
        : null;
    } catch {
      return null;
    }
  }

  detectServerUrl() {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname || '';
      if (window.SERVER_URL) return window.SERVER_URL;

      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.startsWith('192.168.') ||
        host.startsWith('10.') ||
        host.endsWith('.local')
      ) {
        return `http://${host}:3000`;
      }

      try {
        const override = localStorage.getItem('dbtcg_server_url');
        if (override) return override;
      } catch {}
    }

    return 'https://dbclash-server.onrender.com';
  }

  setServerUrl(url) {
    if (!url || url === this.serverUrl) return;
    this.serverUrl = url;
    try { localStorage.setItem('dbtcg_server_url', url); } catch {}
    this.reconnect();
  }

  initSocket() {
    if (typeof io === 'undefined') {
      setTimeout(() => this.initSocket(), 300);
      return;
    }

    if (this.socket) {
      try {
        this.socket.removeAllListeners();
        this.socket.disconnect();
      } catch {}
    }

    this.socket = io(this.serverUrl, {
      transports: ['websocket', 'polling'],
      auth: { token: this.authToken || null },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    this.attachInternalListeners();
    this.attachRegisteredListeners();
  }

  attachInternalListeners() {
    this.socket.on('connect', () => {
      console.log(`[SocketManager] Connected: ${this.socket.id}`);
      this.startKeepAlive();
      const waiters = this.connectWaiters.splice(0);
      waiters.forEach(resolve => resolve(true));
    });

    this.socket.on('disconnect', reason => {
      console.warn(`[SocketManager] Disconnected: ${reason}`);
    });

    this.socket.on('connect_error', err => {
      console.warn(`[SocketManager] Connection error: ${err.message}`);
    });
  }

  attachRegisteredListeners() {
    for (const [event, callbacks] of this.listeners.entries()) {
      for (const callback of callbacks) {
        this.socket.on(event, callback);
      }
    }
  }

  setAuthToken(token) {
    const normalized = token || null;
    if (normalized === this.authToken) return;

    this.authToken = normalized;

    if (!this.socket) {
      this.initSocket();
      return;
    }

    this.socket.auth = { token: this.authToken };
    if (this.socket.connected) {
      this.socket.disconnect().connect();
    } else {
      this.socket.connect();
    }
  }

  reconnect() {
    this.initSocket();
  }

  waitForConnection(timeoutMs = 8000) {
    if (this.socket?.connected) return Promise.resolve(true);

    return new Promise(resolve => {
      const timeout = setTimeout(() => resolve(false), timeoutMs);
      this.connectWaiters.push(ok => {
        clearTimeout(timeout);
        resolve(ok);
      });
    });
  }

  startKeepAlive() {
    if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
    this.keepAliveInterval = setInterval(() => {
      fetch(`${this.serverUrl}/ping`)
        .then(res => res.json())
        .then(() => {
          if (this.socket?.connected) this.socket.emit('keep_alive_ping');
        })
        .catch(() => {});
    }, 210000);
  }

  emit(event, data, ack) {
    if (!this.socket?.connected) {
      console.warn(`[SocketManager] Cannot emit '${event}': disconnected.`);
      if (typeof ack === 'function') ack({ success: false, code: 'DISCONNECTED' });
      return false;
    }

    this.socket.emit(event, data, ack);
    return true;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    const set = this.listeners.get(event);
    if (set.has(callback)) return;
    set.add(callback);
    if (this.socket) this.socket.on(event, callback);
  }

  off(event, callback) {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
      if (set.size === 0) this.listeners.delete(event);
    }
    if (this.socket) this.socket.off(event, callback);
  }
}

export const socketManager = new SocketManager();
