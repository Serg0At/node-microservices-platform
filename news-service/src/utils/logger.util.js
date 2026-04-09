import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, service, method, duration, ...meta }) => {
  let log = `${timestamp} [${level}]`;

  if (service) log += ` [${service}]`;
  if (method) log += ` [${method}]`;
  log += ` ${stack || message}`;
  if (duration !== undefined) log += ` (${duration}ms)`;

  const extra = Object.keys(meta).length ? JSON.stringify(meta) : '';
  if (extra) log += ` ${extra}`;

  return log;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'news-service' },
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat)
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(logFormat),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: combine(logFormat),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    })
  ]
});

if (process.env.NODE_ENV === 'production') {
  logger.transports.forEach(t => {
    if (t instanceof winston.transports.Console) {
      t.format = combine(logFormat);
    }
  });
}

export default logger;
