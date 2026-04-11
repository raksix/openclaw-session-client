import { ClientSideConnection, AgentSideConnection } from '@agentclientprotocol/sdk';
import WebSocket from 'ws';
import { loadOrCreateDeviceIdentity, signDevicePayload } from 'openclaw/dist/device-identity-D3srcfXR.js';
import crypto from 'node:crypto';

interface GatewayConfig {
  url: string;
  password?: string;
}

interface SessionInfo {
  key: string;
  sessionId: string;
}

class OpenClawGateway {
  private ws: WebSocket | null = null;
  private client: any = null;
  private deviceIdentity: any = null;
  private config: GatewayConfig;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private pendingRequests: Map<string, { resolve: Function; reject: Function; timer: NodeJS.Timeout }> = new Map();
  private isConnected = false;
  private messageId = 0;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    // Load device identity
    this.deviceIdentity = loadOrCreateDeviceIdentity();
    console.log('[Gateway] Device ID:', this.deviceIdentity.deviceId);

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.url);

      this.ws.on('open', () => {
        console.log('[Gateway] WebSocket connected');
      });

      this.ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        this.handleMessage(msg);
      });

      this.ws.on('error', (err) => {
        console.error('[Gateway] WebSocket error:', err.message);
        reject(err);
      });

      this.ws.on('close', () => {
        console.log('[Gateway] WebSocket closed');
        this.isConnected = false;
      });

      // Wait for connection to be established
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  private handleMessage(msg: any) {
    // Handle challenge
    if (msg.event === 'connect.challenge') {
      this.handleChallenge(msg.payload).catch(console.error);
      return;
    }

    // Handle response to our request
    if (msg.id && this.pendingRequests.has(msg.id)) {
      const pending = this.pendingRequests.get(msg.id);
      clearTimeout(pending!.timer);
      this.pendingRequests.delete(msg.id);
      if (msg.error) {
        pending!.reject(new Error(msg.error.message || msg.error));
      } else {
        pending!.resolve(msg.result);
      }
      return;
    }

    // Handle events (like session updates)
    if (msg.event) {
      console.log('[Gateway] Event:', msg.event, msg.payload || '');
      const handler = this.messageHandlers.get(msg.event);
      if (handler) {
        handler(msg.payload);
      }
    }
  }

  private async handleChallenge(payload: { nonce: string; ts: number }): Promise<void> {
    const { nonce, ts } = payload;

    // Build auth payload (v3 format)
    const authPayload = [
      'v3',
      this.deviceIdentity.deviceId,
      'session-manager', // clientId
      'session-manager', // clientMode
      'operator',        // role
      '',                // scopes (empty for now)
      String(ts),
      '',                // token
      nonce,
      'linux',
      'server'
    ].join('|');

    const signature = signDevicePayload(this.deviceIdentity.privateKeyPem, authPayload);

    // Also try with password if configured
    let authObj: any = {};
    if (this.config.password) {
      authObj.password = this.config.password;
    }

    const connectParams = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'session-manager',
        version: '1.0.0',
        platform: 'linux',
        mode: 'session-manager',
        instanceId: crypto.randomUUID()
      },
      auth: authObj,
      role: 'operator',
      scopes: [],
      device: {
        id: this.deviceIdentity.deviceId,
        publicKey: this.deviceIdentity.publicKeyPem,
        signature,
        signedAt: ts,
        nonce
      }
    };

    this.sendRequest('connect', connectParams).then((result: any) => {
      console.log('[Gateway] Connected!', result ? 'OK' : 'No result');
      this.isConnected = true;
    }).catch((err: Error) => {
      console.error('[Gateway] Connect failed:', err.message);
    });
  }

  private sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'));
        return;
      }

      const id = String(++this.messageId);
      const frame = { method, params, id };

      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }, 30000);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify(frame));
    });
  }

  async createSession(agentId: string = 'main', channel: string = 'telegram', channelPeer: string = 'furkan11', channelContext: string = 'direct'): Promise<SessionInfo> {
    const result = await this.sendRequest('sessions.create', {
      agentId,
      channel,
      channelPeer,
      channelContext
    });

    return {
      key: result.key,
      sessionId: result.sessionId
    };
  }

  async sendMessage(sessionKey: string, content: string): Promise<any> {
    return this.sendRequest('sessions.send', {
      sessionKey,
      content
    });
  }

  async listSessions(): Promise<any[]> {
    return this.sendRequest('sessions.list', {});
  }

  onEvent(event: string, handler: (data: any) => void) {
    this.messageHandlers.set(event, handler);
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const gateway = new OpenClawGateway({
  url: 'ws://127.0.0.1:18789',
  password: 'Fe277353'
});

// Quick test
async function test() {
  try {
    console.log('Connecting to gateway...');
    await gateway.connect();
    console.log('Connected!');
    
    console.log('Creating session...');
    const session = await gateway.createSession();
    console.log('Session created:', session);
    
    console.log('Sending message...');
    const response = await gateway.sendMessage(session.key, 'Merhaba! Test mesajıdır.');
    console.log('Response:', response);
    
    gateway.close();
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

// test();
