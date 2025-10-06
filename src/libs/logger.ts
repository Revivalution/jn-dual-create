import pino from 'pino';

// Simple logger for serverless (no pino-pretty in production)
export const log = pino({
  level: process.env.LOG_LEVEL || 'info'
});

