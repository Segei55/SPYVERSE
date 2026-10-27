@echo off
chcp 65001 >nul
title SPYVERSE Dedicated Server
setlocal EnableExtensions
cd /d "%~dp0"

rem Порт: первый аргумент или переменная PORT (по умолчанию 3001)
if not "%~1"=="" set "PORT=%~1"
if "%PORT%"=="" set "PORT=3001"

rem 1) Готовая сборка из GitHub Actions (рядом лежит spyverse-server.cjs)
if exist "spyverse-server.cjs" (
  where node >nul 2>nul
  if errorlevel 1 goto :no_node
  echo [INFO] Запуск SPYVERSE Dedicated Server на порту %PORT%...
  node spyverse-server.cjs
  goto :end
)

rem 2) Запуск из исходников репозитория
where node >nul 2>nul
if errorlevel 1 goto :no_node

where npm >nul 2>nul
if errorlevel 1 goto :no_node

if not exist "node_modules" (
  echo [INFO] Первый запуск: установка зависимостей...
  call npm install --legacy-peer-deps
  if errorlevel 1 goto :fail
)

if not exist "dist\index.html" (
  echo [INFO] Сборка веб-клиента...
  call npm run build
  if errorlevel 1 goto :fail
)

echo [INFO] Запуск SPYVERSE Dedicated Server на порту %PORT%...
echo [INFO] Друзья подключаются по адресу http://ВАШ_IP:%PORT%
echo [INFO] Остановить сервер: Ctrl+C
call npm run start:server
goto :end

:no_node
echo [ОШИБКА] Node.js 20+ не найден. Установите его с https://nodejs.org и запустите файл снова.
goto :end

:fail
echo [ОШИБКА] Не удалось подготовить сервер. Посмотрите сообщения выше.

:end
echo.
pause
endlocal
