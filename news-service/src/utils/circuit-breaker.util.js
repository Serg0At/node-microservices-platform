import CircuitBreaker from 'opossum';
import logger from './logger.util.js';

const defaultOptions = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 10000,
  volumeThreshold: 5,
};

function createBreaker(name, options = {}) {
  const breaker = new CircuitBreaker((fn) => fn(), { ...defaultOptions, ...options, name });

  breaker.on('open',     () => logger.warn(`Circuit breaker [${name}] opened — failing fast`));
  breaker.on('halfOpen', () => logger.info(`Circuit breaker [${name}] half-open — testing`));
  breaker.on('close',    () => logger.info(`Circuit breaker [${name}] closed — recovered`));
  breaker.on('fallback', () => logger.warn(`Circuit breaker [${name}] fallback triggered`));

  return breaker;
}

export const dbBreaker     = createBreaker('database', { timeout: 5000 });
export const redisBreaker  = createBreaker('redis',    { timeout: 2000 });
export const rabbitBreaker = createBreaker('rabbitmq', { timeout: 5000, resetTimeout: 20000 });
export const s3Breaker     = createBreaker('s3',       { timeout: 10000 });
