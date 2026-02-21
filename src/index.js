import { Bot } from 'grammy';
import { config } from './config.js';
import { logger } from './logger.js';
import { setupApprovalHandlers } from './publishers/telegram.js';
import { startScheduler } from './scheduler.js';

process.on('uncaughtException', (err) => {
  logger.fatal({ err: err.stack || err.message || String(err) }, 'uncaughtException');
  console.error(err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason: reason?.stack || reason?.message || String(reason) }, 'unhandledRejection');
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

logger.info('[App] studio_essa_ai autoposting starting');

// Create bot and setup approval handlers
const bot = new Bot(config.telegram.botToken);
setupApprovalHandlers(bot);

// Start scheduler/run once
if (config.scheduler.runOnce) {
  logger.info('[App] RUN_ONCE mode, running pipeline immediately');
  const { runPipeline } = await import('./pipeline.js');
  try {
    await runPipeline(bot);
    logger.info('[App] Pipeline completed successfully');
    
    // Start bot to handle approval callbacks
    bot.start({
      onStart: () => logger.info('[App] Bot started for approval callbacks'),
    });
  } catch (err) {
    logger.fatal({ err: err.stack || err.message }, '[App] Pipeline failed');
    process.exit(1);
  }
} else {
  // Scheduled mode
  bot.start({
    onStart: () => {
      logger.info('[App] Bot started, starting scheduler');
      startScheduler(config.scheduler, bot);
    },
  });
}

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
