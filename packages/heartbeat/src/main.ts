import 'dotenv/config';

import { Heartbeat } from './heartbeat';

const KYVE_API_URL = `http://${process.env.STREAMR_DOCKER_DEV_HOST}:1317`;
const POOL_ID = 0;

let heartbeat: Heartbeat;

async function getTotalBundles() {
	const response = await fetch(
		`${KYVE_API_URL}/kyve/query/v1beta1/pool/${POOL_ID}`
	);
	const pool = (await response.json()).pool;
	return parseInt(pool.data.total_bundles);
}

async function main() {
	let totalBundles = await getTotalBundles();
	while (!totalBundles) {
		console.log(`Pool TotalBundles is ${totalBundles}. Waiting 5s to retry...`);
		await new Promise((resolve) => setTimeout(resolve, 5 * 1000));
		totalBundles = await getTotalBundles();
	}

	heartbeat = new Heartbeat();
	await heartbeat.init();
	heartbeat.start();
}

process.on('SIGTERM', async () => {
	console.info('SIGTERM signal received.');
	await heartbeat.stop();
});

void main().then();
