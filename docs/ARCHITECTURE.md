# Архитектура SPYVERSE

SPYVERSE — это многоплатформенная шпионская социальная игра, построенная по принципу монорепозитория с чистым разделением обязанностей, криптографически безопасным распределением ролей и авторитетным сервером.

```text
SPYVERSE/
├── apps/
│   ├── client/          # Общий React-клиент (интерфейс, Web Audio, WebRTC)
│   ├── desktop/         # Electron-оболочка (безопасный preload, contextIsolation)
│   ├── server/          # Сетевой сервер (Socket.IO, WebRTC-сигнализация, комнаты)
│   └── mobile/          # Интеграция Capacitor для Android
├── packages/
│   ├── shared/          # Общие типы, DTO, схемы Zod, события Socket.IO
│   ├── game-engine/     # Чистая игровая логика (PRNG, таймеры, голосование, победы)
│   └── content/         # 19 официальных наборов локаций, валидатор, импорт/экспорт
├── docs/
│   ├── ARCHITECTURE.md  # Настоящий документ
│   ├── NETWORKING.md    # Сетевое взаимодействие, LAN, Hamachi, WebRTC
│   └── PROGRESS.md      # Чеклист реализации и верификации
├── .github/workflows/   # CI/CD: сборка Windows, Linux, Android, Server
├── server.ts            # Full-stack сервер Express + Vite + Socket.IO (порт 3000)
├── package.json
└── tsconfig.json
```

---

## 1. Потоки данных и безопасность

### Серверная авторитетность (Server Authority)
- Клиенты **не знают** роли других участников и **не знают** секретную локацию.
- Сервер генерирует случайную секретную локацию и случайных шпионов с помощью криптографически стойкого генератора (`crypto.getRandomValues`).
- Каждому клиенту отправляется индивидуальное событие `player_secret`, содержащее только его личные данные.
- Общее состояние комнаты `room_state_update` передаёт список игроков, фазу игры, таймер и статус готовности, но поле `secretLocationName` и роли `revealedRoles` передаются только после перехода в фазу `ended`.

### Проверка входных данных (Zod)
Все сетевые сообщения, поступающие от клиентов, валидируются Zod-схемами (`CreateRoomPayloadSchema`, `CastVotePayloadSchema`, `SpyGuessPayloadSchema`, `ChatSendPayloadSchema`). Некорректные сообщения отклоняются с кодом ошибки `INVALID_PAYLOAD`.

---

## 2. Игровой движок (`packages/game-engine`)
- **Криптографический генератор:** `cryptoRandomInt(min, max)` и алгоритм тасования Фишера-Йетса `secureShuffle(arr)`.
- **Распределение ролей:** `assignRoles(players, pack, settings)` гарантирует честный баланс: шпионы не получают локацию, мирные получают локацию и уникальную роль.
- **Подсчёт голосов:** `calculateVoteResults(players, revoteCount, revoteOnTie)` поддерживает большинство, ничьи и повторные голосования.
- **Сверка догадки шпиона:** `checkSpyGuess(guess, actual)` устойчива к регистру, пробелам и пунктуации.

---

## 3. Десктопная архитектура (Electron)
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- Минимальный API через `contextBridge.exposeInMainWorld('electronAPI', ...)`
- Безопасное открытие внешних ссылок исключительно через `shell.openExternal`.

---

## 4. Мобильная интеграция (Capacitor Android)
- Переиспользование общего React-клиента из папки сборки `dist/`.
- Доступ к микрофону для WebRTC голосовой связи через `android.permission.RECORD_AUDIO`.
- Разрешение `usesCleartextTraffic="true"` для локального подключения к домашнему серверу по HTTP/WS.
