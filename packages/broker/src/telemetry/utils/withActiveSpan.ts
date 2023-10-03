import { Span } from '@opentelemetry/api';

import { globalTelemetryObjects } from '../globalTelemetryObjects';

export function withActiveSpan<T>(
	name: string,
	fn: (span: Span) => Promise<T> | T
) {
	return globalTelemetryObjects.startActiveSpan(name, async (span) => {
		// fn(span).finally(() => span.end())
		try {
			const res = await fn(span);
			return res;
		} catch (error) {
			span.recordException(error);
			throw error;
		} finally {
			span.end();
		}
	});
}
