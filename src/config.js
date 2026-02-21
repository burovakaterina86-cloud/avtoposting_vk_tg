import 'dotenv/config';
import { logger } from './logger.js';

const required = [
  'OPENAI_API_KEY',
  'KIE_AI_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHANNEL_ID',
  'VK_ACCESS_TOKEN',
  'VK_GROUP_ID',
];

function parseReferencePhotos(raw) {
  if (!raw?.trim()) return [];
  return raw.split(',').map(u => u.trim()).filter(Boolean);
}

function loadConfig() {
  const dryRun = process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';
  const requiredVars = dryRun ? ['OPENAI_API_KEY', 'KIE_AI_API_KEY'] : required;
  const missing = requiredVars.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    logger.error({ missing }, '[Config] Missing required env vars');
    throw new Error(`Missing required env: ${missing.join(', ')}. Copy .env.example to .env and fill values.`);
  }

  const baseUrl = (process.env.KIE_AI_BASE_URL || 'https://api.kie.ai').replace(/\/$/, '');

  return Object.freeze({
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },
    kie: {
      apiKey: process.env.KIE_AI_API_KEY,
      baseUrl,
      imageModel: process.env.KIE_AI_IMAGE_MODEL || 'nano-banana-pro',
      jobsUrl: `${baseUrl}/api/v1/jobs`,
      referencePhotos: parseReferencePhotos(process.env.REFERENCE_PHOTO_URLS),
    },
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      channelId: process.env.TELEGRAM_CHANNEL_ID || '',
    },
    vk: {
      accessToken: process.env.VK_ACCESS_TOKEN || '',
      groupId: process.env.VK_GROUP_ID || '',
    },
    scheduler: {
      cron: process.env.POST_CRON || '0 10 * * *',
      runOnce: process.env.RUN_ONCE === 'true' || process.env.RUN_ONCE === '1',
    },
    statePath: process.env.STATE_PATH || 'state.json',
    dryRun: process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1',
    adminId: process.env.ADMIN_ID || '943657550',
  });
}

export const config = loadConfig();
