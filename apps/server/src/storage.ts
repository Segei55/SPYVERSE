import fs from 'fs';
import path from 'path';
import os from 'os';
import { ChatMessage } from '../../../packages/shared/src/index';

function getStorageBaseDir(): string {
  // Use user home directory to ensure write permissions even if installed in program files
  const baseDir = path.join(os.homedir(), '.spyverse', 'rooms');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return baseDir;
}

function getSafeRoomDir(roomId: string): string {
  // Sanitize roomId to avoid path traversal (allow only alphanumeric and hyphen)
  const safeId = roomId.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
  const roomDir = path.join(getStorageBaseDir(), safeId, 'chat');
  if (!fs.existsSync(roomDir)) {
    fs.mkdirSync(roomDir, { recursive: true });
  }
  return roomDir;
}

export function saveRoomChatHistory(roomId: string, messages: ChatMessage[]): void {
  try {
    const roomDir = getSafeRoomDir(roomId);
    const filePath = path.join(roomDir, 'history.json');
    fs.writeFileSync(filePath, JSON.stringify(messages.slice(-200), null, 2), 'utf-8');
  } catch (err) {
    console.error(`[Storage] Failed to save chat history for room ${roomId}:`, err);
  }
}

export function loadRoomChatHistory(roomId: string): ChatMessage[] {
  try {
    const roomDir = getSafeRoomDir(roomId);
    const filePath = path.join(roomDir, 'history.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`[Storage] Failed to load chat history for room ${roomId}:`, err);
  }
  return [];
}
