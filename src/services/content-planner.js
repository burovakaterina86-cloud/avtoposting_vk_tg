/**
 * Returns topic/theme for current run. Rotates among four themes; uses lastThemeIndex from state.
 */

const THEMES = [
  { id: 'automation', label: 'Automation', topicEn: 'Professional headshot in a modern office, confident expression, business casual, automation and technology theme.' },
  { id: 'makecom', label: 'Make.com', topicEn: 'Creative workspace with no-code tools and integrations, friendly professional, Make.com and workflow automation theme.' },
  { id: 'neural', label: 'Neural networks', topicEn: 'Tech professional in a sleek environment, neural networks and AI theme, sharp and modern.' },
  { id: 'prompts', label: 'Prompts', topicEn: 'Content creator or marketer setting, prompts and copywriting theme, expressive and engaging.' },
];

/**
 * @param {number} lastThemeIndex - 0..3 from state
 * @returns {{ theme: typeof THEMES[0], nextIndex: number }}
 */
export function getThemeForRun(lastThemeIndex) {
  const index = Math.max(0, lastThemeIndex % THEMES.length);
  const theme = THEMES[index];
  const nextIndex = (index + 1) % THEMES.length;
  return { theme, nextIndex };
}

export function getThemes() {
  return THEMES;
}
