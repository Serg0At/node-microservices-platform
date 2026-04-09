import { NotificationModel } from '../models/index.js';
import { dbBreaker } from '../utils/circuit-breaker.util.js';
import config from '../config/variables.config.js';
import logger from '../utils/logger.util.js';

let timer = null;

/**
 * Start the periodic archival job.
 * Moves notifications older than ARCHIVE_DAYS to the notification_archive table.
 */
export const startArchiver = () => {
  const intervalMs = config.NOTIFICATION.ARCHIVE_INTERVAL_MS;
  const days = config.NOTIFICATION.ARCHIVE_DAYS;

  logger.info('Archiver started', { archiveDays: days, intervalMs });

  const run = async () => {
    try {
      const count = await dbBreaker.fire(() => NotificationModel.archiveOld(days));
      if (count > 0) {
        logger.info('Archived old notifications', { count, olderThanDays: days });
      }
    } catch (err) {
      logger.error('Archival job failed', { error: err.message, stack: err.stack });
    }

    timer = setTimeout(run, intervalMs);
  };

  // Run first archival after a short delay (let the service fully boot)
  timer = setTimeout(run, 10000);
};

export const stopArchiver = () => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
    logger.info('Archiver stopped');
  }
};
