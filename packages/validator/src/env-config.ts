import { name, version } from '../package.json';
import { parseEvmPriv } from './utils/parser';

export const appPackageName = process.env.APP_NAME || name;
export const appVersion = process.env.APP_VERSION || version;
export const appName = `${appPackageName}@${appVersion}`;

/* ========== TRACKING ========== */
export const sentry = {
	dsn: process.env.SENTRY_DSN || '',
	release: process.env.SENTRY_RELEASE || appName,
};

export const evmPrivateKey = parseEvmPriv('EVM_PRIVATE_KEY');
