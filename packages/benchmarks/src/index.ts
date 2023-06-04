import autocannon from 'autocannon';

export async function start() {
	try {
		const result = await autocannon({
			url: 'http://localhost:3000',
			connections: 10, //default
			pipelining: 1, // default
			duration: 10, // default
			workers: 4,
		});
		console.log(result);
	} catch (e) {
		console.log(e);
	}
}

// eslint-disable-next-line
start();
