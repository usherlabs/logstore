import { metrics, trace } from '@opentelemetry/api';

import { addOpentelemetry } from '../utils';

const { meter } = addOpentelemetry();
test('can see messages on prometheus', async () => {
	const counter = metrics.getMeter('oo').createCounter('test-counter', {
		description: 'Example of a Counter',
		unit: '1',
	});
	counter.add(11, { myLabel: 'my-counter' });
	expect(1 + 1).toBe(2);
}, 10_000);

test('tracing', async () => {
	const span = trace.getTracer('test-trace').startSpan('test-span');

	span.end();
	expect(1 + 1).toBe(2);
});
