/**
 * Builds image prompt with mandatory style-guide suffix (eyes/lips, skin retouching, photorealism).
 * See memory-bank/creative/creative-autoposting-image-prompts.md
 */

const MANDATORY_SUFFIX =
  'Sharp focus on eyes and lips with clear detail and expression. Natural skin retouching, avoiding over-smoothing or plastic look. Photorealistic style, professional photography lighting and depth.';

/**
 * @param {string} topicDescription - Scene/idea from content-planner (e.g. "Professional headshot in a modern office")
 * @returns {string} Full prompt for Nano Banana Pro
 */
export function buildImagePrompt(topicDescription) {
  const topic = (topicDescription || '').trim();
  if (!topic) return MANDATORY_SUFFIX;
  return `${topic}. ${MANDATORY_SUFFIX}`;
}
