import { config } from './config.js';
import { logger } from './logger.js';
import { readState, writeState } from './state.js';
import { selectNextTopic } from './services/topic-selector.js';
import { generateDraft } from './services/draft-generator.js';
import { generateText } from './services/openai.js';
import { generateImage } from './services/kieai.js';
import { sendDraftToAdminForApproval } from './publishers/telegram.js';

/**
 * One full run: select topic -> generate draft JSON -> send to admin for approval.
 * @param {import('grammy').Bot} bot - Telegram bot instance
 */
export async function runPipeline(bot) {
  const statePath = config.statePath;
  const state = await readState(statePath);

  // Reset weekly link counter if needed
  const now = new Date();
  const resetDate = state.weeklyLinksResetAt ? new Date(state.weeklyLinksResetAt) : null;
  if (!resetDate || (now - resetDate) / (1000 * 60 * 60 * 24) >= 7) {
    state.weeklyLinksCount = 0;
    state.weeklyLinksResetAt = now.toISOString();
    logger.info('[Pipeline] Reset weekly link counter');
  }

  // Select topic
  const { topic, shouldIncludeLink } = selectNextTopic(state);
  logger.info({ topic_id: topic.id, include_link: shouldIncludeLink }, '[Pipeline] Topic selected');

  // Generate draft
  let draft;
  try {
    draft = await generateDraft(topic, shouldIncludeLink, generateText, config.openai);
  } catch (err) {
    logger.error({ err: err.message, topic_id: topic.id }, '[Pipeline] Draft generation failed');
    throw err;
  }

  // Generate poster image via NanoBanana Pro
  let imageUrl = null;
  if (draft.nano_prompt?.prompt) {
    logger.info({ nano_prompt: draft.nano_prompt.prompt }, '[Pipeline] NanoBanana prompt');
    try {
      imageUrl = await generateImage(draft.nano_prompt.prompt, config.kie);
      logger.info({ imageUrl }, '[Pipeline] Image generated');
    } catch (err) {
      logger.warn({ err: err.message }, '[Pipeline] Image generation failed, continuing without image');
    }
  }
  draft.imageUrl = imageUrl;

  if (config.dryRun) {
    logger.info({ draft }, '[Pipeline] DRY RUN — skip send to admin, no state update');
    return;
  }

  // Update state
  const updatedUsedTopics = [...state.usedTopics, topic.id];
  const updatedLastCaseLinks = { ...state.lastCaseLinks };
  let updatedWeeklyLinksCount = state.weeklyLinksCount;

  if (shouldIncludeLink && topic.case_key) {
    updatedLastCaseLinks[topic.case_key] = now.toISOString();
    updatedWeeklyLinksCount += 1;
  }

  await writeState(statePath, {
    lastRunAt: now.toISOString(),
    usedTopics: updatedUsedTopics,
    weeklyLinksCount: updatedWeeklyLinksCount,
    weeklyLinksResetAt: state.weeklyLinksResetAt,
    lastCaseLinks: updatedLastCaseLinks,
    pendingDraft: {
      topic_id: topic.id,
      draft,
      createdAt: now.toISOString(),
    },
  });

  // Send to admin for approval
  await sendDraftToAdminForApproval(bot, draft, config.adminId);

  logger.info({ adminId: config.adminId, topic_id: topic.id }, '[Pipeline] Draft sent to admin, awaiting approval');
}
