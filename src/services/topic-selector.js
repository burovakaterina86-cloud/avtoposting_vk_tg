import topics from '../../../.cursor/topics.json' with { type: 'json' };
import schedule from '../../../.cursor/schedule.json' with { type: 'json' };
import { logger } from '../logger.js';

/**
 * Select next topic based on day of week schedule and usage history.
 * @param {object} state - Current state with usedTopics, weeklyLinks, lastCaseLinks
 * @returns {{ topic: object, shouldIncludeLink: boolean }}
 */
export function selectNextTopic(state) {
  const now = new Date();
  const dayName = now.toLocaleString('en-US', { weekday: 'long', timeZone: schedule.timezone }).toLowerCase();
  const daySchedule = schedule.days[dayName];

  if (!daySchedule) {
    logger.warn({ dayName }, '[TopicSelector] No schedule for this day');
    throw new Error(`No schedule configured for ${dayName}`);
  }

  const categories = daySchedule.primary_categories;
  const usedTopicIds = state.usedTopics || [];

  // Filter topics by category and not recently used
  const candidates = topics.filter((t) => {
    if (!categories.includes(t.category)) return false;
    if (usedTopicIds.includes(t.id)) return false;
    return true;
  });

  if (candidates.length === 0) {
    logger.info('[TopicSelector] All topics used, resetting');
    // Reset usedTopics for this category
    const freshCandidates = topics.filter((t) => categories.includes(t.category));
    if (freshCandidates.length === 0) {
      throw new Error(`No topics found for categories: ${categories.join(', ')}`);
    }
    const topic = freshCandidates[0];
    const shouldIncludeLink = decideLinkInclusion(topic, state, daySchedule.include_link);
    return { topic, shouldIncludeLink };
  }

  const topic = candidates[0];
  const shouldIncludeLink = decideLinkInclusion(topic, state, daySchedule.include_link);

  return { topic, shouldIncludeLink };
}

/**
 * Decide if link should be included based on policy and state.
 */
function decideLinkInclusion(topic, state, dayLinkPolicy) {
  if (dayLinkPolicy === false) return false;
  if (!topic.case_link) return false;

  const weeklyLinksCount = state.weeklyLinksCount || 0;
  const maxPerWeek = schedule.link_policy.max_posts_with_links_per_week;

  if (weeklyLinksCount >= maxPerWeek) {
    logger.info({ weeklyLinksCount, max: maxPerWeek }, '[TopicSelector] Weekly link limit reached');
    return false;
  }

  // Check if this case was linked recently
  const lastCaseLinks = state.lastCaseLinks || {};
  const lastLinkedAt = lastCaseLinks[topic.case_key];
  if (lastLinkedAt) {
    const daysSince = (Date.now() - new Date(lastLinkedAt).getTime()) / (1000 * 60 * 60 * 24);
    const minDays = schedule.link_policy.do_not_repeat_same_case_within_days;
    if (daysSince < minDays) {
      logger.info({ case_key: topic.case_key, daysSince, minDays }, '[TopicSelector] Case linked too recently');
      return false;
    }
  }

  if (dayLinkPolicy === 'only_if_case') {
    return !!topic.case_key;
  }

  return true;
}
