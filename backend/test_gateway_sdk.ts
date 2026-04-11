import { ClientSideConnection } from '@agentclientprotocol/sdk';
import WebSocket from 'ws';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'path';

// Load device identity
const identityPath = '/root/.openclaw/identity/device.json';
const identity = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
console.log('Device ID:', identity.deviceId);

// Import device identity functions from openclaw
const openclawPath = '/usr/lib/node_modules/openclaw/dist/device-identity-D3srcfXR.js';
const deviceIdentityModule = await import('file://' + openclawPath);
const signDevicePayload = deviceIdentityModule.a;
console.log('Sign function loaded');

// Create WebSocket connection
const ws = new WebSocket('ws://127.0.0.1:18789');

ws.on('open', () => {
  console.log('WebSocket connected');
});

ws.on('message', async (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.event === 'connect.challenge') {
    const { nonce, ts } = msg.payload;
    console.log('Challenge received:', { nonce, ts });
    
    // Build v3 auth payload
    const authPayload = [
      'v3',
      identity.deviceId,
      'session-manager',
      'session-manager',
      'operator',
      '',
      String(ts),
      '',
      nonce,
      'linux',
      'server'
    ].join('|');
    
    const signature = signDevicePayload(identity.privateKeyPem, authPayload);
    
    // Send connect request
    ws.send(JSON.stringify({
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'session-manager',
          version: '1.0.0',
          platform: 'linux',
          mode: 'session-manager',
          instanceId: crypto.randomUUID()
        },
        auth: { password: 'Fe277353' },
        role: 'operator',
        scopes: [],
        device: {
          id: identity.deviceId,
          publicKey: identity.publicKeyPem,
          signature,
          signedAt: ts,
          nonce
        }
      },
      id: '1'
    }));
  }
  
  if (msg.id === '1') {
    console.log('Connect result:', msg.result ? 'OK' : msg.error);
    if (msg.result) {
      console.log('Result:', JSON.stringify(msg.result, null, 2).substring(0, 500));
      // Now try to create a session
      setTimeout(() => {
        ws.send(JSON.stringify({
          method: 'sessions.create',
          params: {
            agentId: 'main',
            channel: 'telegram',
            channelPeer: 'furkan11',
            channelContext: 'direct'
          },
          id: '2'
        }));
      }, 100);
    } else {
      console.log('Error:', JSON.stringify(msg.error));
      ws.close();
      process.exit(1);
    }
  }
  
  if (msg.id === '2') {
    console.log('Session create result:', msg.result ? 'OK' : msg.error);
    if (msg.result) {
      console.log('Session:', JSON.stringify(msg.result, null, 2).substring(0, 500));
      // Send a message
      setTimeout(() => {
        ws.send(JSON.stringify({
          method: 'sessions.send',
          params: {
            sessionKey: msg.result.key,
            content: 'Merhaba! Bu bir test mesajıdır.'
          },
          id: '3'
        }));
      }, 100);
    }
  }
  
  if (msg.id === '3') {
    console.log('Send result:', msg.result ? 'OK' : msg.error);
    if (msg.result) {
      console.log('Response:', JSON.stringify(msg.result, null, 2).substring(0, 1000));
    }
    ws.close();
    process.exit(0);
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err.message);
});

setTimeout(() => {
  console.log('Timeout');
  ws.close();
  process.exit(0);
}, 20000);
