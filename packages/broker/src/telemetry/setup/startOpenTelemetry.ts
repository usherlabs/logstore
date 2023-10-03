import process from 'process';

import { isAnyObservabilityFeatureEnabled, sdk } from './setupSdk';

// initialize the SDK and register with the OpenTelemetry API
// this enables the API to record telemetry

if (isAnyObservabilityFeatureEnabled) {
	sdk.start();
	// gracefully shut down the SDK on process exit
	process.on('SIGTERM', () => {
		sdk
			.shutdown()
			.then(() => console.log('Tracing terminated'))
			.catch((error: Error) => console.log('Error terminating tracing', error))
			.finally(() => process.exit(0));
	});
}
