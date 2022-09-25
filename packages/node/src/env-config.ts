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
// export const polygonMumbaiChainId = '8001';
// export const polygonMumbaiRpc = "https://rpc-mumbai.maticvigil.com";

/* ========== API ============== */
export const ethereumRpc = process.env.ETHEREUM_RPC;
export const ethereumChainId = process.env.ETHEREUM_CHAIN_ID || '1';
export const polygonRpc = process.env.POLYGON_RPC || 'https://polygon-rpc.com';
export const polygonChainId = process.env.POLYGON_CHAIN_ID || '137';
