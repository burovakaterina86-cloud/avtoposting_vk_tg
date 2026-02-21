# Autoposting System для studio_essa_ai

Автоматический генератор и публикатор постов для Telegram и VK.

- **Тексты** — OpenAI GPT-4o-mini
- **Изображения** — Kie.ai (Nano Banana Pro)

## Возможности

- 📅 Расписание по дням недели (America/Chicago timezone)
- 🎯 Выбор тем из банка topics.json по категориям
- ✍️ Генерация черновиков (текст + постер) с помощью AI
- 🖼 Публикация с изображением в Telegram и VK
- 🔗 Умная политика ссылок (не более 3 в неделю, не повторять кейс 7 дней)
- ✅ Подтверждение перед публикацией через Telegram
- 📊 Отслеживание использованных тем (без повторов)

## Требования

- Node.js >= 18.0.0
- npm

## Установка

```bash
cd autoposting
npm install
cp .env.example .env
# Отредактируй .env файл
```

## Настройка

Заполни `.env`:

```env
# OpenAI API (генерация текста)
OPENAI_API_KEY=your-openai-api-key
# OPENAI_MODEL=gpt-4o-mini

# Kie.ai API (генерация изображений)
KIE_AI_API_KEY=your-kie-ai-api-key
KIE_AI_BASE_URL=https://api.kie.ai
KIE_AI_IMAGE_MODEL=nano-banana-pro

# Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHANNEL_ID=@your_channel
ADMIN_ID=your_admin_id

# VK
VK_ACCESS_TOKEN=your_vk_token
VK_GROUP_ID=your_group_id

# Scheduler
POST_CRON=0 10 * * *
RUN_ONCE=
```

## Запуск

```bash
# Production (по расписанию)
npm start

# Одноразовый запуск (для тестов)
npm run post-once

# DRY RUN (генерация без публикации)
DRY_RUN=true npm run post-once
```

## Как это работает

1. **Планировщик** определяет день недели и выбирает категорию из `schedule.json`
2. **Topic Selector** находит следующую тему из `topics.json` по категории (без повторов)
3. **Draft Generator** генерирует текст поста (OpenAI GPT-4o-mini) и описание сцены для постера
4. **Image Generator** создаёт изображение по описанию сцены (Kie.ai Nano Banana Pro)
5. **Политика ссылок:** не более 3 ссылочных постов в неделю, не повторять один кейс чаще 1 раза в 7 дней
6. **Approval Flow:** черновик отправляется админу в Telegram с кнопками "Опубликовать" / "Удалить"
7. **Публикация:** после подтверждения — пост с картинкой в Telegram канал и VK группу

## Структура проекта

```
autoposting/
├── src/
│   ├── services/
│   │   ├── openai.js               # Генерация текста (OpenAI)
│   │   ├── kieai.js                # Генерация изображений (Kie.ai)
│   │   ├── draft-generator.js      # Двухступенчатая генерация черновиков
│   │   ├── topic-selector.js       # Выбор тем по расписанию
│   │   ├── prompt-builder.js       # Сборка промптов для изображений
│   │   └── content-planner.js      # Ротация тем
│   ├── publishers/
│   │   ├── telegram.js             # Публикация TG + approval flow
│   │   └── vk.js                   # Публикация VK (с загрузкой фото)
│   ├── pipeline.js                 # Основная логика
│   ├── scheduler.js                # node-cron
│   ├── state.js                    # Персистентное хранилище
│   ├── config.js                   # Конфигурация из env
│   ├── logger.js                   # Pino
│   ├── index.js                    # Точка входа
│   └── run-once.js                 # Одноразовый запуск
├── .env.example
├── package.json
└── README.md
```

## Технологии

- Node.js
- OpenAI API (GPT-4o-mini)
- Kie.ai (Nano Banana Pro)
- grammY (Telegram Bot API)
- VK API
- node-cron
- pino (логи)

## Лицензия

MIT
