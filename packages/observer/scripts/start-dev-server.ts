import '../src/telemetry/setup/startOpenTelemetry';

import config from '../configs/development-1.env.json';
import { Config } from '../src/config/config';
import { createObserver } from '../src/observer';

const typesafeConfig = {
	...config,
} as Config;

const observer = await createObserver(typesafeConfig);

try {
	await observer.start();
} catch (error) {
	console.error(error);
	process.exit(1);
}
