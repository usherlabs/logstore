import '../src/telemetry/setup/startOpenTelemetry';

import fs from 'fs';
import * as os from 'os';

import { Config } from '../src/config/config';
import { createObserver } from '../src/observer';

const homeDir = os.homedir();
const configFilename = 'observer.json';

const defaultConfigPath = `${homeDir}/.logstore/config/${configFilename}`;

const configPath = process.env.CONFIG_PATH ?? defaultConfigPath;

const content = JSON.parse(fs.readFileSync(configPath, 'utf8')) as
	| Config
	| undefined;

const observer = await createObserver(content ?? {});

try {
	await observer.start();
} catch (error) {
	console.error(error);
	process.exit(1);
}
