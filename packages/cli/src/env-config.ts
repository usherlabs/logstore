import { name, version } from '../package.json';

export const appPackageName = process.env.APP_NAME || name;
export const appVersion = process.env.APP_VERSION || version;
export const appName = `${appPackageName}@${appVersion}`;

export const USE_TEST_CONFIG = process.env.USE_TEST_CONFIG === 'true';
