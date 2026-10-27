import { io, Socket } from 'socket.io-client';

let currentSocket: Socket | null = null;
let currentServerUrl: string = '';

export function getStoredServerUrl(): string {
  try {
    return localStorage.getItem('spyverse_server_url') || '';
  } catch {
    return '';
  }
}

export function setStoredServerUrl(url: string): void {
  try {
    localStorage.setItem('spyverse_server_url', url);
  } catch {}
}

export function getSocket(customUrl?: string): Socket {
  const targetUrl = customUrl || getStoredServerUrl() || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

  if (currentSocket && currentServerUrl === targetUrl && currentSocket.connected) {
    return currentSocket;
  }

  if (currentSocket) {
    currentSocket.disconnect();
  }

  currentServerUrl = targetUrl;
  currentSocket = io(targetUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
  });

  return currentSocket;
}

export function disconnectSocket(): void {
  if (currentSocket) {
    currentSocket.disconnect();
    currentSocket = null;
  }
}
