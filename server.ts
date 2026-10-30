import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { RoomManager } from './apps/server/src/RoomManager';
import { setupSocketHandlers } from './apps/server/src/socketHandlers';
import { getAvailableNetworkInterfaces } from './apps/server/src/network';

async function startServer() {
  const port = parseInt(process.env.PORT || '3000', 10);
  const app = express();
  const server = http.createServer(app);

  // Setup Socket.IO
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  const roomManager = new RoomManager(io);
  setupSocketHandlers(io, roomManager);

  app.use(express.json());

  // API endpoint for host network status & interfaces
  app.get('/api/server-info', (req, res) => {
    res.json({
      version: '1.1.2',
      port,
      activeRooms: roomManager.getRoomCount(),
      totalPlayers: roomManager.getTotalPlayerCount(),
      interfaces: getAvailableNetworkInterfaces(),
    });
  });

  // In development, mount Vite middleware; in production, serve built dist/
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`[SPYVERSE Full-Stack] Server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('[SPYVERSE Server] Startup error:', err);
  process.exit(1);
});
