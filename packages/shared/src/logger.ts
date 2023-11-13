const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';
export const minLogLevel = LOG_LEVEL === 'debug' ? 1 : 3;
