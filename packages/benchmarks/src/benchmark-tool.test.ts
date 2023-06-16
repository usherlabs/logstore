import Benchmark from 'benchmark';
import { expect, test } from 'vitest';

test('benchmarks', async () => {
	const suite = new Benchmark.Suite();
	const testedFn = () => expect(1).toBe(1);

	suite.add('logstore-validator', async () => {
		await testedFn();
	});

	suite.on('cycle', (event: any) => {
		console.log(toStringBench(event.target));
	});

	await new Promise<void>((resolve) => {
		suite.on('complete', function (this: Benchmark.Suite) {
			console.log('Fastest is ' + this.filter('fastest').map('name'));
			resolve();
		});
		suite.run();
	});
});

function toStringBench(bench: Benchmark, batchSize = 1) {
	const { error, id, stats } = bench;
	let { hz } = bench;
	hz *= batchSize; // adjust hz by batch size
	const size = stats.sample.length;
	const pm = '\xb1';
	let result = bench.name || (Number.isNaN(id) ? id : '<Test #' + id + '>');
	if (error) {
		return result + ' Error';
	}

	result +=
		' x ' +
		Benchmark.formatNumber(+hz.toFixed(hz < 100 ? 2 : 0)) +
		' ops/sec ' +
		pm +
		stats.rme.toFixed(2) +
		'% (' +
		size +
		' run' +
		(size === 1 ? '' : 's') +
		' sampled)';
	return result;
}
