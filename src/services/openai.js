import axios from 'axios';
import { logger } from '../logger.js';

/**
 * Generate text via OpenAI Chat Completions API (GPT-4o-mini).
 * @param {string} prompt - User message
 * @param {import('../config.js').config['openai']} openaiConfig
 * @returns {Promise<string>} Assistant text
 */
export async function generateText(prompt, openaiConfig) {
  const url = `${openaiConfig.baseUrl}/chat/completions`;
  try {
    const { data } = await axios.post(
      url,
      {
        model: openaiConfig.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${openaiConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60_000,
      }
    );
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      logger.warn({ response: data }, '[OpenAI] Unexpected chat response shape');
      return '';
    }
    return content.trim();
  } catch (err) {
    logger.error({ err: err.message, url }, '[OpenAI] generateText failed');
    throw err;
  }
}
