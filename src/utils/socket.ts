import { io, Socket } from 'socket.io-client';
import type { ElectronAPI } from './electron';

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
  const defaultUrl =
    typeof window !== 'undefined'
      ? window.electronAPI?.serverUrl ||
        (window.location.protocol === 'file:' ? 'http://127.0.0.1:3001' : window.location.origin)
      : 'http://localhost:3000';
  const targetUrl = customUrl || getStoredServerUrl() || defaultUrl;

  if (currentSocket && currentServerUrl === targetUrl) {
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
