import { name, version } from '../package.json';
import { parseBoolean, parseEvmPriv } from './utils/parser';

export const appPackageName = process.env.APP_NAME || name;
export const appVersion = process.env.APP_VERSION || version;
export const appName = `${appPackageName}@${appVersion}`;

/* ========== TRACKING ========== */
export const sentry = {
	dsn: process.env.SENTRY_DSN || '',
	release: process.env.SENTRY_RELEASE || appName,
};

export const getEvmPrivateKey = () => parseEvmPriv('EVM_PRIVATE_KEY');
export const useStreamrTestConfig = () =>
	parseBoolean('USE_STREAMR_TEST_CONFIG');

export const copyFromTimeIndex = process.env.COPY_FROM_TIME_INDEX;
export const overrideStartBlockNumber = process.env.START_BLOCK_NUMBER || '0';
