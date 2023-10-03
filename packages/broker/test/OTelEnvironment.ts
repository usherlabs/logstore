import NodeEnvironment from 'jest-environment-node';

import {
	metricReader,
	sdk,
	traceExporter,
} from '../src/telemetry/setup/setupSdk';

class CustomEnvironment extends NodeEnvironment {
	override async setup() {
		sdk.start();
		await super.setup();

		this.global.teardownOTel = async () => {
			// TODO this won't work, I didn't figure how to get metrics exported
			//  correctly from our tests
			// The problem is that the tests are run in a separate process, so
			//  the metrics are not exported, as per isolation of modules during tests
			//  so best current way to test is mocking the counters.
			// Tracing works nicely
			await metricReader?.forceFlush();
			await traceExporter?.forceFlush();
			await sdk.shutdown();
		};
	}

	override async teardown() {
		// @ts-ignore
		await this.global.teardownOTel();
		await super.teardown();
	}

	runScript(script: any) {
		// @ts-ignore
		return super.runScript(script);
	}
}

module.exports = CustomEnvironment;
