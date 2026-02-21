import axios from 'axios';
import { logger } from '../logger.js';

/**
 * Create image job (Nano Banana Pro), poll until done, return image URL.
 * @param {string} prompt - Full image prompt
 * @param {import('../config.js').config['kie']} kieConfig
 * @returns {Promise<string>} Image URL
 */
export async function generateImage(prompt, kieConfig) {
  const createUrl = `${kieConfig.jobsUrl}/createTask`;
  const authHeaders = {
    Authorization: `Bearer ${kieConfig.apiKey}`,
    'Content-Type': 'application/json',
  };

  try {
    logger.info({ createUrl, model: kieConfig.imageModel }, '[KieAI] Creating image task');

    const input = {
      prompt,
      aspect_ratio: '3:4',
      resolution: '2K',
      output_format: 'jpg',
    };

    // Add reference photo(s) if configured
    if (kieConfig.referencePhotos?.length > 0) {
      input.image_input = kieConfig.referencePhotos;
      logger.info({ count: kieConfig.referencePhotos.length }, '[KieAI] Adding reference photos');
    }

    const { data: createData } = await axios.post(
      createUrl,
      { model: kieConfig.imageModel, input },
      { headers: authHeaders, timeout: 30_000 }
    );

    const taskId = createData?.data?.taskId ?? createData?.taskId;
    if (!taskId) {
      logger.warn({ response: createData }, '[KieAI] createTask did not return taskId');
      throw new Error('Kie.ai createTask: no taskId');
    }

    logger.info({ taskId }, '[KieAI] Image task created, polling status');

    // Poll via GET /api/v1/jobs/recordInfo?taskId=...
    const pollBaseUrl = `${kieConfig.jobsUrl}/recordInfo`;
    const maxAttempts = 60;
    const pollIntervalMs = 5000;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, pollIntervalMs));

      const { data: queryData } = await axios.get(pollBaseUrl, {
        params: { taskId },
        headers: { Authorization: `Bearer ${kieConfig.apiKey}` },
        timeout: 15_000,
      });

      const state = queryData?.data?.state;
      logger.info({ taskId, state, attempt: i + 1 }, '[KieAI] Poll status');

      if (state === 'success') {
        const resultJson = queryData?.data?.resultJson;
        if (resultJson) {
          try {
            const result = typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson;
            const url = result?.resultUrls?.[0];
            if (url) return url;
          } catch (parseErr) {
            logger.warn({ resultJson }, '[KieAI] failed to parse resultJson');
          }
        }
        logger.warn({ response: queryData?.data }, '[KieAI] success but no image URL');
        throw new Error('Kie.ai: no image URL in result');
      }

      if (state === 'fail') {
        const failMsg = queryData?.data?.failMsg ?? 'unknown';
        throw new Error(`Kie.ai image job failed: ${failMsg}`);
      }
    }
    throw new Error('Kie.ai image job timeout');
  } catch (err) {
    logger.error({ err: err.message, promptLength: prompt?.length }, '[KieAI] generateImage failed');
    throw err;
  }
}
