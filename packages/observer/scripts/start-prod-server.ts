import '../src/telemetry/setup/startOpenTelemetry';

import fs from 'fs';
import * as os from 'os';

import { Config } from '../src/config/config';
import { createObserver } from '../src/observer';

const homeDir = os.homedir();
const configFilename = 'observer.json';

const fullConfigPath = `${homeDir}/.logstore/config/${configFilename}`;

const content = JSON.parse(fs.readFileSync(fullConfigPath, 'utf8')) as
	| Config
	| undefined;

const observer = await createObserver(content ?? {});

try {
	await observer.start();
} catch (error) {
	console.error(error);
	process.exit(1);
}
