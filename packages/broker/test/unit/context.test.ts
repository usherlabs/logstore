import { ctx } from '../../src/telemetry/context';

it('context works as expected', async () => {
	ctx.operation.enterWith('test');
	let referenceObject = 'test';

	expect(ctx.operation.getStore()).toBe('test');
	expect(referenceObject).toBe('test');

	ctx.operation.enterWith('test2');
	referenceObject = 'test2';

	const execution1 = executeAfterDelay(() => {
		expect(ctx.operation.getStore()).toBe('test2');
		// different because we set it after the execution
		expect(referenceObject).toBe('test3');
	}, 100);

	referenceObject = 'test3';
	ctx.operation.enterWith('test3');

	expect(ctx.operation.getStore()).toBe('test3');

	// we await to simplify the test
	await execution1;

	await new Promise<void>((resolve) => {
		setTimeout(() => {
			expect(ctx.operation.getStore()).toBe('test3');
			resolve();
		}, 100);
		ctx.operation.enterWith('test4');
		referenceObject = 'test4';
	});

	const execution2 = executeAfterDelay(() => {
		expect(ctx.operation.getStore()).toBe('test4');
		ctx.operation.enterWith('test5');
		referenceObject = 'test5';
	}, 100);

	expect(ctx.operation.getStore()).toBe('test4');
	expect(referenceObject).toBe('test4');
	await execution2;
	expect(ctx.operation.getStore()).toBe('test4');
	expect(referenceObject).toBe('test5');
});

const executeAfterDelay = (fn: (...args: any[]) => any, delay: number) =>
	new Promise((resolve) => setTimeout(() => resolve(fn()), delay));
