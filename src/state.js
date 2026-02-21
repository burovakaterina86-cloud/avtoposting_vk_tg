import { readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_STATE = {
  lastRunAt: null,
  usedTopics: [],
  weeklyLinksCount: 0,
  weeklyLinksResetAt: null,
  lastCaseLinks: {},
  pendingDraft: null,
};

/**
 * State structure:
 * {
 *   lastRunAt: ISO string,
 *   usedTopics: [topic_id, ...],
 *   weeklyLinksCount: number,
 *   weeklyLinksResetAt: ISO string,
 *   lastCaseLinks: { case_key: ISO string, ... },
 *   pendingDraft: { topic_id, draft: {...}, createdAt }
 * }
 */
export async function readState(statePath) {
  try {
    const path = statePath.startsWith('/') ? statePath : join(process.cwd(), statePath);
    const raw = await readFile(path, 'utf-8');
    const data = JSON.parse(raw);
    return {
      lastRunAt: data.lastRunAt ?? null,
      usedTopics: data.usedTopics || [],
      weeklyLinksCount: data.weeklyLinksCount || 0,
      weeklyLinksResetAt: data.weeklyLinksResetAt || null,
      lastCaseLinks: data.lastCaseLinks || {},
      pendingDraft: data.pendingDraft ?? null,
    };
  } catch (err) {
    if (err.code === 'ENOENT') return DEFAULT_STATE;
    logger.warn({ err: err.message, statePath }, '[State] read failed, using default');
    return DEFAULT_STATE;
  }
}

/**
 * @param {string} statePath
 * @param {{ lastRunAt?: string | null, lastThemeIndex?: number, pendingPost?: { text: string, imageUrl: string | null, createdAt: string } | null }} state
 */
export async function writeState(statePath, state) {
  try {
    const path = statePath.startsWith('/') ? statePath : join(process.cwd(), statePath);
    const full = await readState(statePath).catch(() => DEFAULT_STATE);
    const merged = { ...full, ...state };
    await writeFile(path, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    logger.error({ err: err.message, statePath }, '[State] write failed');
    throw err;
  }
}
