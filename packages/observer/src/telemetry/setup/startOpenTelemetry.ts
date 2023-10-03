import { Logger } from '@streamr/utils';
import process from 'process';

import { moduleFromMetaUrl } from '../../utils/moduleFromMetaUrl';
import { enabledObservabilityFeatures, sdk } from './setupSdk';

const logger = new Logger(moduleFromMetaUrl(import.meta.url));

if (!enabledObservabilityFeatures.metrics) {
	throw new Error(
		'Metrics exporting is not enabled, the observer should not be running'
	);
}

// initialize the SDK and register with the OpenTelemetry API
// this enables the API to record telemetry
// We create errors here because this package is all about observing and collecting metrics
try {
	sdk.start();
} catch (err) {
	logger.error('Error starting OpenTelemetry SDK');
	logger.error(String(err));
	process.exit(1);
}

logger.info('Tracing initialized');

// gracefully shut down the SDK on process exit
process.on('SIGTERM', () => {
	sdk
		.shutdown()
		.then(() => logger.info('Tracing terminated'))
		.catch((error: Error) => logger.error('Error terminating tracing', error))
		.finally(() => process.exit(0));
});
