// WebSocket client for Battleship game
// Usage: import wsClient from './wsClient';
// wsClient.connect();
// wsClient.send({ type: 'CREATE_GAME', maxPlayers: 4 });
// wsClient.onMessage = (msg) => { ... };

import { WS_URL } from '@/constants/network'

class WSClient {
  constructor() {
    this.ws = null;
    this.onMessage = null;
    this.onOpen = null;
    this.onClose = null;
    this.onError = null;
    this.pendingMessages = [];
  }

  connect() {
    if (this.ws) {
      const state = this.ws.readyState;
      if (state === WebSocket.CONNECTING || state === WebSocket.OPEN) {
        return;
      }
      try {
        this.ws.close();
      } catch (_) {
        // Ignore: socket may already be unusable.
      }
      this.ws = null;
    }
    this.ws = new WebSocket(WS_URL);
    this.ws.onopen = (event) => {
      if (this.pendingMessages.length > 0) {
        for (const payload of this.pendingMessages) {
          this.ws.send(payload);
        }
        this.pendingMessages = [];
      }
      if (this.onOpen) this.onOpen(event);
    };
    this.ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        data = event.data;
      }
      if (this.onMessage) this.onMessage(data);
    };
    this.ws.onclose = (event) => {
      if (this.onClose) this.onClose(event);
    };
    this.ws.onerror = (event) => {
      if (this.onError) this.onError(event);
    };
  }

  /**
   * Ouvre une connexion si aucune connexion utilisable (apres fermeture reseau, veille navigateur, etc.).
   */
  ensureOpen() {
    const state = this.ws?.readyState;
    if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;
    this.connect();
  }

  send(obj) {
    const payload = JSON.stringify(obj);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      this.pendingMessages.push(payload);
      return;
    }
    this.pendingMessages.push(payload);
    this.connect();
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

const wsClient = new WSClient();
export default wsClient;
