import 'dotenv/config';

import { Heartbeat } from './heartbeat';

let heartbeat: Heartbeat;

async function main() {
	heartbeat = new Heartbeat();
	await heartbeat.init();
	heartbeat.start();
}

process.on('SIGTERM', async () => {
	console.info('SIGTERM signal received.');
	await heartbeat.stop();
});

void main().then();
