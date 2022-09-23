import { name, version } from '../package.json';

export const isProd = process.env.NODE_ENV === 'production';
export const appPackageName = process.env.APP_NAME || name;
export const appVersion = process.env.APP_VERSION || version;
export const appName = `${appPackageName}@${appVersion}`;
export const logLevel = process.env.LOG_LEVEL || 'info';

/* ========== TRACKING ========== */
export const sentry = {
	dsn: process.env.SENTRY_DSN || '',
	release: process.env.SENTRY_RELEASE || appName,
};

/* ========== TESTING ========== */
export const arweaveLocalPort = process.env.ARWEAVE_LOCAL_PORT;
