import fs from 'fs';
import http from 'http';
import path from 'path';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { RoomManager } from './RoomManager';
import { setupSocketHandlers } from './socketHandlers';
import { getAvailableNetworkInterfaces } from './network';

const SERVER_VERSION = '1.1.1';
const port = parseInt(process.env.PORT || '3001', 10);
const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const roomManager = new RoomManager(io);
setupSocketHandlers(io, roomManager);

const startTime = Date.now();

/**
 * Ищем собранный веб-клиент (dist/index.html).
 * Варианты: запуск из исходников (tsx), из корня проекта, либо бандл рядом с папкой dist.
 */
function findClientDist(): string | null {
  // В ESM (tsx) __dirname недоступен, поэтому опираемся на путь к запускаемому файлу
  const entryDir = path.dirname(path.resolve(process.argv[1] || '.'));
  const candidates = [
    path.resolve(entryDir, 'dist'),
    path.resolve(entryDir, '../dist'),
    path.resolve(entryDir, '../../../dist'),
    path.resolve(process.cwd(), 'dist'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return null;
}

const clientDist = findClientDist();

app.use(express.json());

app.get('/api/server-info', (_req, res) => {
  res.json({
    version: SERVER_VERSION,
    port,
    activeRooms: roomManager.getRoomCount(),
    totalPlayers: roomManager.getTotalPlayerCount(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    interfaces: getAvailableNetworkInterfaces(),
  });
});

app.get('/api/status', (_req, res) => {
  res.json({
    name: 'SPYVERSE Dedicated Server',
    version: SERVER_VERSION,
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    activeRooms: roomManager.getRoomCount(),
    totalPlayers: roomManager.getTotalPlayerCount(),
    interfaces: getAvailableNetworkInterfaces(),
  });
});

if (clientDist) {
  // Игра доступна напрямую по адресу сервера: друзьям не нужно ничего собирать
  app.use(express.static(clientDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.status(503).type('text/plain; charset=utf-8').send(
      'Веб-клиент не найден. Соберите его командой "npm run build" в папке проекта.'
    );
  });
}

server.listen(port, '0.0.0.0', () => {
  const ifaces = getAvailableNetworkInterfaces();
  console.log('====================================================');
  console.log(`   SPYVERSE DEDICATED SERVER v${SERVER_VERSION} RUNNING`);
  console.log(`   Port: ${port}`);
  console.log(`   Client: ${clientDist ? clientDist : 'NOT FOUND (run npm run build)'}`);
  console.log('====================================================');
  console.log('Адреса для друзей (открывать в браузере или вводить в Настройках):');
  for (const iface of ifaces) {
    console.log(` - [${iface.type.toUpperCase()}] ${iface.name}: http://${iface.address}:${port}`);
  }
  console.log('====================================================');
});
