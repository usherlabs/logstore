import Hypercore from 'hypercore';
import Hyperswarm from 'hyperswarm';
import moment from 'moment';
import pump from 'pump';

const sleep = (ts: number) => new Promise((resolve) => setTimeout(resolve, ts));

async function createCore(namespace: string) {
	const core = new Hypercore(`./cache-${namespace}`);

	await core.ready();

	core.createReadStream({ live: true }).on('data', (chunk) => {
		console.log('server read stream', chunk.toString());
	});

	const cleanup = async () => {
		await core.close();
	};
	return { core, cleanup };
}

async function start() {
	const A = await createCore('a');
	console.log(
		'Hypercore ready\n',
		moment().utcOffset(-180).format('LLLL'),
		'\n key',
		A.core.key.toString('hex')
	);

	const B = await createCore('b');
	console.log(
		'Hypercore B ready\n',
		moment().utcOffset(-180).format('LLLL'),
		'\n key',
		B.core.key.toString('hex')
	);

	const sw = new Hyperswarm();

	sw.join(A.core.discoveryKey, {
		lookup: true, // find & connect to peers
		announce: true, // optional- announce self as a connection target
	});

	sw.join(B.core.discoveryKey, {
		lookup: true, // find & connect to peers
		announce: true, // optional- announce self as a connection target
	});

	sw.on('connection', (conn, info) => {
		console.log('\nswarm on connection\n');
		//setInterval(() => core.append("server live content " + Date.now()), 1000);
		if (info.peer) {
			//console.log(chalk.green("\nRemote Replicate\n"));
			console.log('server connected to ', JSON.stringify(info.peer));
			const stream = A.core.replicate(true, { live: true });
			pump(stream, conn, stream);

			//setInterval(() => core.append("live content " + Date.now()), 2000);
		}
	});

	console.log('Swarm Peers: ', sw.peers);

	for (let i = 0; i < 50; i++) {
		await A.core.append(`content ${i}`);
	}
	for (let i = 0; i < 50; i++) {
		await B.core.append(`content ${i + 50}`);
	}
	console.log(
		'CORE A: block  0 ',
		Buffer.from(await A.core.get(0)).toString('utf-8')
	);
	console.log(
		'CORE A: block ',
		A.core.length,
		await A.core.get(A.core.length - 1)
	);
	console.log('CORE A: total ', A.core.length, 'blocks');

	await sleep(1000);

	console.log(
		'CORE B: block  4 ',
		Buffer.from(await B.core.get(4)).toString('utf-8')
	);
	console.log(
		'CORE B: block ',
		B.core.length,
		await B.core.get(B.core.length - 1)
	);
	console.log('CORE B: total ', B.core.length, 'blocks');
}

// start the core.
start();
