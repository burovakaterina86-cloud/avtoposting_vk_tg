import { Bot, InlineKeyboard } from 'grammy';
import { logger } from '../logger.js';
import { readState, writeState } from '../state.js';
import { config } from '../config.js';
import { publishToVk } from './vk.js';

const TG_MESSAGE_LIMIT = 4096;
const TG_CAPTION_LIMIT = 1024;

/**
 * Send post to Telegram channel with optional image.
 */
export async function publishToTelegram(post, telegramConfig) {
  const bot = new Bot(telegramConfig.botToken);
  const channelId = telegramConfig.channelId;

  try {
    const text = post.text;
    const imageUrl = post.imageUrl;

    if (imageUrl) {
      if (text.length <= TG_CAPTION_LIMIT) {
        await bot.api.sendPhoto(channelId, imageUrl, { caption: text, parse_mode: 'HTML' });
      } else {
        // Image first, then text separately
        await bot.api.sendPhoto(channelId, imageUrl);
        await bot.api.sendMessage(channelId, text, { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
      }
    } else {
      if (text.length <= TG_MESSAGE_LIMIT) {
        await bot.api.sendMessage(channelId, text, { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
      } else {
        const parts = splitMessage(text, TG_MESSAGE_LIMIT);
        for (const part of parts) {
          await bot.api.sendMessage(channelId, part, { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
        }
      }
    }
    logger.info({ channelId, hasImage: !!imageUrl }, '[Telegram] post published');
  } catch (err) {
    logger.error({ err: err.message, channelId }, '[Telegram] publish failed');
    throw err;
  }
}

/**
 * Split text into chunks by paragraph boundaries.
 */
function splitMessage(text, limit) {
  const parts = [];
  let current = '';
  const paragraphs = text.split('\n\n');

  for (const p of paragraphs) {
    const candidate = current ? current + '\n\n' + p : p;
    if (candidate.length <= limit) {
      current = candidate;
    } else {
      if (current) parts.push(current);
      current = p.length <= limit ? p : p.substring(0, limit);
    }
  }
  if (current) parts.push(current);
  return parts;
}

/**
 * Send draft to admin for approval — image + preview text + buttons.
 */
export async function sendDraftToAdminForApproval(bot, draft, adminId) {
  const keyboard = new InlineKeyboard()
    .text('✅ Опубликовать', 'autopost_approve')
    .text('❌ Удалить', 'autopost_reject');

  const preview = formatDraftPreview(draft);

  try {
    // Send image first if available
    if (draft.imageUrl) {
      await bot.api.sendPhoto(adminId, draft.imageUrl, { caption: '🖼 Постер к посту' });
    }

    // Send text preview with buttons
    if (preview.length <= TG_MESSAGE_LIMIT - 100) {
      await bot.api.sendMessage(adminId, preview, { parse_mode: 'HTML', reply_markup: keyboard, link_preview_options: { is_disabled: true } });
    } else {
      const parts = splitMessage(preview, TG_MESSAGE_LIMIT);
      for (let i = 0; i < parts.length - 1; i++) {
        await bot.api.sendMessage(adminId, parts[i], { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
      }
      await bot.api.sendMessage(adminId, parts[parts.length - 1], { parse_mode: 'HTML', reply_markup: keyboard, link_preview_options: { is_disabled: true } });
    }
    logger.info({ adminId, topic_id: draft.topic_id, hasImage: !!draft.imageUrl }, '[Telegram] draft sent to admin');
  } catch (err) {
    logger.error({ err: err.message, adminId }, '[Telegram] send draft to admin failed');
    throw err;
  }
}

function formatDraftPreview(draft) {
  let p = `📋 <b>Черновик поста</b>\n`;
  p += `<b>Тема:</b> ${draft.topic_id}\n\n`;

  p += `━━━ <b>Telegram</b> ━━━\n`;
  p += draft.post.text_tg + '\n\n';

  p += `━━━ <b>VK</b> ━━━\n`;
  p += escapeHtml(draft.post.text_vk) + '\n\n';

  p += `━━━ <b>Постер</b> ━━━\n`;
  p += `🎨 Заголовок: ${escapeHtml(draft.poster?.title || draft.poster?.headline || '')}\n`;
  if (draft.poster?.speech) {
    p += `💬 Пузырь: ${escapeHtml(draft.poster.speech)}\n`;
  }
  if (draft.poster?.pointer_1) {
    p += `🔴 Проблема: ${escapeHtml(draft.poster.pointer_1)}\n`;
  }
  if (draft.poster?.pointer_2) {
    p += `🔵 Решение: ${escapeHtml(draft.poster.pointer_2)}\n`;
  }

  if (draft.nano_prompt?.prompt) {
    p += `\n━━━ <b>Промпт NanoBanana</b> ━━━\n`;
    p += `<code>${escapeHtml(draft.nano_prompt.prompt)}</code>\n`;
  }

  return p;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Setup callback handlers for approval buttons.
 */
export function setupApprovalHandlers(bot) {
  bot.callbackQuery('autopost_approve', async (ctx) => {
    try {
      const state = await readState(config.statePath);
      const pendingDraft = state.pendingDraft;

      if (!pendingDraft) {
        await ctx.answerCallbackQuery({ text: 'Нет черновиков для публикации' });
        return;
      }

      const draft = pendingDraft.draft;

      // Publish to Telegram channel with image
      await publishToTelegram({ text: draft.post.text_tg, imageUrl: draft.imageUrl || null }, config.telegram);

      // Publish to VK
      try {
        await publishToVk({ text: draft.post.text_vk, imageUrl: draft.imageUrl || null }, config.vk);
      } catch (vkErr) {
        logger.warn({ err: vkErr.message }, '[Approval] VK publish failed, TG was ok');
      }

      await writeState(config.statePath, { pendingDraft: null });

      logger.info({ adminId: ctx.from.id, topic_id: draft.topic_id }, '[Approval] draft approved and published');
      try {
        await ctx.answerCallbackQuery({ text: '✅ Опубликовано!' });
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      } catch (cbErr) {
        logger.warn({ err: cbErr.message }, '[Approval] callback query expired, but post was published');
      }
    } catch (err) {
      logger.error({ err: err.message }, '[Approval] publish failed');
      try { await ctx.answerCallbackQuery({ text: '❌ Ошибка публикации' }); } catch (_) {}
    }
  });

  bot.callbackQuery('autopost_reject', async (ctx) => {
    try {
      await writeState(config.statePath, { pendingDraft: null });
      await ctx.answerCallbackQuery({ text: '🗑 Удалено' });
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      logger.info({ adminId: ctx.from.id }, '[Approval] draft rejected');
    } catch (err) {
      logger.error({ err: err.message }, '[Approval] reject failed');
      await ctx.answerCallbackQuery({ text: '❌ Ошибка' });
    }
  });

  logger.info('[Telegram] approval handlers registered');
}
