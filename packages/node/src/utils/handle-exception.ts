import * as Sentry from '@sentry/node';

import '@sentry/tracing';

import { sentry, appName } from '@/env-config';
import { logger } from '@/utils/logger';

const sentryOptions: Sentry.NodeOptions = {
	dsn: sentry.dsn,
	enabled: process.env.NODE_ENV !== 'test',
	release: sentry.release,
	environment: process.env.NODE_ENV,
	tracesSampleRate: 1.0,
};

if (sentry.dsn) {
	Sentry.init(sentryOptions);

	// Scope configured by default, subsequent calls to "configureScope" will add additional data
	Sentry.configureScope((scope) => {
		scope.setTag('package', appName);
		// See https://www.npmjs.com/package/@sentry/node
		scope.setTag('nodejs', process.version);
		scope.setTag('runtimeEngine', 'server');
	});
}

export { Sentry };

const handleException = (
	err: Error | any // type any here in case it's a random unknown error...
) => {
	logger.error(err);

	if (!sentry.dsn) {
		return;
	}

	Sentry.captureException(err);
};

export default handleException;
