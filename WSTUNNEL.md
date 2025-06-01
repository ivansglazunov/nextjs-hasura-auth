# Wstunnel Integration

WebSocket туннелирование с автоматическим управлением поддоменами для Next.js приложений.

## ⚠️ КРИТИЧЕСКИ ВАЖНО: Системные требования

### Обязательная установка wstunnel binary

**Wstunnel НЕ БУДЕТ РАБОТАТЬ без установленного системного binary!**

Установите wstunnel binary перед использованием:

```bash
# Скачайте последнюю версию для вашей платформы
cd /tmp
wget https://github.com/erebe/wstunnel/releases/download/v10.4.0/wstunnel_10.4.0_linux_amd64.tar.gz

# Распакуйте и установите
tar -xzf wstunnel_10.4.0_linux_amd64.tar.gz
sudo mv wstunnel /usr/local/bin/
sudo chmod +x /usr/local/bin/wstunnel

# Проверьте установку
wstunnel --version
```

**Поддерживаемые платформы:**
- Linux AMD64: `wstunnel_*_linux_amd64.tar.gz`
- Linux ARM64: `wstunnel_*_linux_arm64.tar.gz`
- macOS: `wstunnel_*_darwin_amd64.tar.gz`
- Windows: `wstunnel_*_windows_amd64.tar.gz`

Ссылка на релизы: https://github.com/erebe/wstunnel/releases

## Обзор

Система Wstunnel предоставляет автоматическое создание HTTPS туннелей для локальных приложений через WebSocket соединения. Интегрируется с CloudFlare DNS, Let's Encrypt SSL и Nginx для полного управления поддоменами.

## Архитектура

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Local App       │    │ Wstunnel Service │    │ External Client │
│ localhost:PORT  │    │ /api/wstunnel    │    │ Browser/App     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │ 1. Register           │                       │
         ├──────────────────────▶│ 2. Create Subdomain   │
         │                       ├─ DNS Record            │
         │                       ├─ SSL Certificate       │
         │                       ├─ Nginx Config          │
         │                       ├─ tmux + wstunnel       │
         │ 3. Start wstunnel     │                       │
         │    client (WS)        │                       │
         ├──────────────────────▶│ 4. HTTP Request       │
         │                       │◀──────────────────────┤
         │ 5. Proxy via tunnel   │                       │
         │◀──────────────────────┤ 6. Response           │
         │                       ├──────────────────────▶│
         │                       │                       │
         │ 7. Unregister         │                       │
         ├──────────────────────▶│ 8. Cleanup            │
         │                       ├─ Kill tmux            │
         │                       ├─ Remove Nginx         │
         │                       ├─ Remove SSL           │
         │                       ├─ Remove DNS           │
```

## Компоненты

### 1. API Endpoint
**`/app/api/wstunnel/[uuid]/route.ts`**

```typescript
// POST /api/wstunnel/[uuid] - Создать туннель
// POST /api/wstunnel/[uuid]?undefine=1 - Удалить туннель

export async function POST(request: NextRequest, { params }: { params: { uuid: string } })
```

### 2. Основная логика
**`lib/wstunnel.ts`**

```typescript
// Класс управления туннелями
export class Wstunnel {
  async define(uuid: string, port: number): Promise<WstunnelResult>
  async undefine(uuid: string): Promise<void>
  async clearUnused(): Promise<void>
  async clear(): Promise<void>
}

// Основная функция обработки
export async function handleWstunnel(options: WstunnelOptions): Promise<WstunnelResult>
```

### 3. Утилиты
**`lib/find-port.ts`** - Поиск свободных портов
**`wstunnel-test-client.ts`** - Тестовый HTTP клиент

## Переменные окружения

```bash
# Обязательные для продакшена
HASYX_DNS_DOMAIN=yourdomain.com
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ZONE_ID=your_zone_id  
LETSENCRYPT_EMAIL=admin@yourdomain.com

# Блокирует выполнение в Vercel (автоматически)
VERCEL=1
```

## Использование

### Программный API

```typescript
import { handleWstunnel } from 'hasyx/lib/wstunnel';

// Создать туннель
const result = await handleWstunnel({
  uuid: 'my-app-123'
});

if (result.success) {
  console.log(`Tunnel created: https://${result.subdomain}`);
  console.log(`Local port: ${result.port}`);
}

// Удалить туннель
await handleWstunnel({
  uuid: 'my-app-123',
  undefine: true
});
```

### HTTP API

```bash
# Создать туннель
curl -X POST http://localhost:3000/api/wstunnel/my-app-123

# Удалить туннель  
curl -X POST http://localhost:3000/api/wstunnel/my-app-123?undefine=1
```

### Тестовый клиент

```typescript
import { WstunnelTestClient } from './wstunnel-test-client';

const client = new WstunnelTestClient({
  uuid: 'test-123',
  port: 3001
});

await client.start();  // Запускает сервер и регистрирует туннель
await client.stop();   // Останавливает сервер и удаляет туннель
```

## Безопасность

### Vercel Protection
Система автоматически блокирует выполнение в serverless Vercel окружении:

```typescript
if (process.env.VERCEL) {
  return {
    success: false,
    error: 'Wstunnel cannot run in serverless Vercel environment'
  };
}
```

### Изоляция процессов
- Каждый туннель запускается в отдельной tmux сессии
- Имена сессий: `hasyx_<wstunnel-id>_<uuid>`
- Автоматическая очистка неиспользуемых сессий

## Тестирование

### Запуск тестов

```bash
npm test -- lib/wstunnel.test.ts --verbose
```

### Структура тестов

1. **Core Tests** - Без переменных окружения:
   - Поиск портов
   - Валидация UUID
   - Проверка Vercel
   - Создание тестового клиента
   - Проверка зависимостей (tmux, wstunnel)

2. **Integration Tests** - С реальными переменными:
   - Создание/удаление туннелей
   - Регистрация тестового клиента
   - Валидация переменных окружения

### Условное выполнение

```typescript
const isEnvAvailable = Boolean(
  process.env.HASYX_DNS_DOMAIN &&
  process.env.CLOUDFLARE_API_TOKEN &&
  process.env.CLOUDFLARE_ZONE_ID &&
  process.env.LETSENCRYPT_EMAIL
);

(isEnvAvailable ? describe : describe.skip)('Integration Tests', () => {
  // Тесты с реальной средой
});
```

## Требования системы

### Обязательные зависимости
- **tmux** - Управление сессиями
- **wstunnel** - WebSocket туннелирование  
- **nginx** - Reverse proxy
- **certbot** - SSL сертификаты

### Проверка зависимостей

```bash
# Проверить tmux
tmux -V

# Проверить wstunnel
wstunnel --version

# Проверить nginx
nginx -v

# Проверить certbot
certbot --version
```

## Примеры интеграции

### Express.js приложение

```typescript
import express from 'express';
import { handleWstunnel } from 'hasyx/lib/wstunnel';

const app = express();
const PORT = 3001;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Создать туннель для этого приложения
  const result = await handleWstunnel({
    uuid: 'my-express-app'
  });
  
  if (result.success) {
    console.log(`🚀 App available at: https://${result.subdomain}`);
  }
});
```

### Next.js API Route

```typescript
// pages/api/create-tunnel.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { handleWstunnel } from 'hasyx/lib/wstunnel';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { uuid } = req.body;
  const result = await handleWstunnel({ uuid });
  
  res.json(result);
}
```

## Troubleshooting

### Частые проблемы

**DNS не пропагируется:**
```bash
# Проверить DNS запись
dig my-app.yourdomain.com

# Дождаться пропагации (до 5 минут)
```

**SSL сертификат не создается:**
```bash
# Проверить nginx конфигурацию
nginx -t

# Проверить доступность домена
curl -I http://my-app.yourdomain.com
```

**Порт занят:**
```typescript
// Использовать автоматический поиск порта
import { findPort } from 'hasyx/lib/find-port';
const port = await findPort(3000, 4000);
```

### Логирование

```typescript
import Debug from 'hasyx/lib/debug';
const debug = Debug('wstunnel');

// Включить отладку
export DEBUG=wstunnel*
npm start
```

## Производительность

### Лимиты
- Максимум 100 одновременных туннелей на экземпляр
- Автоматическая очистка неиспользуемых туннелей каждые 10 минут
- Таймаут создания туннеля: 60 секунд

### Мониторинг

```typescript
// Проверить активные туннели
const wstunnel = new Wstunnel(subdomainManager);
const activeTunnels = await wstunnel.list();
console.log(`Active tunnels: ${activeTunnels.length}`);

// Очистить неиспользуемые
await wstunnel.clearUnused();
```

## Changelog

### v1.0.0 (2025-01-XX)
- ✅ Базовая реализация Wstunnel класса
- ✅ API endpoint `/api/wstunnel/[uuid]`
- ✅ Интеграция с SubdomainManager  
- ✅ Тестовый клиент с нативным HTTP сервером
- ✅ Комплексная система тестирования
- ✅ Автоматическое управление tmux сессиями
- ✅ Graceful shutdown и cleanup
- ✅ Проверка Vercel окружения
- ✅ Валидация переменных окружения 