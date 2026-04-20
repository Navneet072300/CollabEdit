/**
 * WebSocket client with:
 *   - Automatic reconnect with exponential backoff (1s → 2s → 4s → … → 30s)
 *   - Message queue: messages sent while disconnected are held and flushed on reconnect
 *   - Status callbacks so the UI can show connection state
 */

export type ConnectionStatus = "connected" | "connecting" | "reconnecting" | "disconnected";

export interface WSClientOptions {
  url: string;
  onMessage: (msg: unknown) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  onOpen?: () => void;
}

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;

export class WSClient {
  private ws: WebSocket | null = null;
  private queue: string[] = [];
  private backoff = BASE_BACKOFF_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private opts: WSClientOptions;

  constructor(opts: WSClientOptions) {
    this.opts = opts;
    this._connect();
  }

  private _connect(): void {
    this.opts.onStatusChange(this.backoff === BASE_BACKOFF_MS ? "connecting" : "reconnecting");
    const ws = new WebSocket(this.opts.url);
    this.ws = ws;

    ws.onopen = () => {
      this.backoff = BASE_BACKOFF_MS; // reset backoff on successful connect
      this.opts.onStatusChange("connected");
      this.opts.onOpen?.();
      // Flush queued messages
      const toFlush = this.queue.splice(0);
      for (const msg of toFlush) ws.send(msg);
    };

    ws.onmessage = (evt) => {
      try {
        this.opts.onMessage(JSON.parse(evt.data));
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      this.ws = null;
      if (this.intentionalClose) return;
      this.opts.onStatusChange("reconnecting");
      this.reconnectTimer = setTimeout(() => this._connect(), this.backoff);
      this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  send(msg: unknown): void {
    const raw = JSON.stringify(msg);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(raw);
    } else {
      this.queue.push(raw);
    }
  }

  close(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.opts.onStatusChange("disconnected");
  }
}
