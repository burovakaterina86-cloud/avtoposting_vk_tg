import cron from 'node-cron';
import { logger } from './logger.js';
import { runPipeline } from './pipeline.js';

/**
 * Start cron scheduler or run once based on config.
 * @param {{ cron: string, runOnce: boolean }} schedulerConfig
 * @param {import('grammy').Bot} bot - Telegram bot instance
 */
export function startScheduler(schedulerConfig, bot) {
  if (schedulerConfig.runOnce) {
    logger.info('[Scheduler] RUN_ONCE=true, running pipeline once');
    runPipeline(bot).catch((err) => {
      logger.error({ err: err.message }, '[Scheduler] pipeline error');
      process.exit(1);
    });
    // Don't exit - keep process alive for button callbacks
    return;
  }

  const expression = schedulerConfig.cron;
  if (!cron.validate(expression)) {
    logger.error({ expression }, '[Scheduler] invalid POST_CRON');
    process.exit(1);
  }

  cron.schedule(expression, async () => {
    logger.info('[Scheduler] running scheduled pipeline');
    try {
      await runPipeline(bot);
    } catch (err) {
      logger.error({ err: err.message }, '[Scheduler] scheduled run failed');
    }
  });

  logger.info({ cron: expression }, '[Scheduler] cron scheduled');
}
