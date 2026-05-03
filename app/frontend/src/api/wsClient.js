// WebSocket client for Battleship game
// Usage: import wsClient from './wsClient';
// wsClient.connect();
// wsClient.send({ type: 'CREATE_GAME', maxPlayers: 4 });
// wsClient.onMessage = (msg) => { ... };

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:5183/ws/game';

class WSClient {
  constructor() {
    this.ws = null;
    this.onMessage = null;
    this.onOpen = null;
    this.onClose = null;
    this.onError = null;
  }

  connect() {
    this.ws = new WebSocket(WS_URL);
    this.ws.onopen = (event) => {
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

  send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

const wsClient = new WSClient();
export default wsClient;
