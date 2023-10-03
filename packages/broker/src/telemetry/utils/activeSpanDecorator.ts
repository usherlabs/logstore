import { context, Context, Span, SpanOptions } from '@opentelemetry/api';

import { globalTelemetryObjects } from '../globalTelemetryObjects';

/**
 * Creates a traced method decorator that wraps the original method with tracing functionality.
 * When the decorated method is called, a new span is started and ended around the execution of the original method.
 * The span will have the specified name and options, and will be created with the specified context or the active context if not provided.
 * If an exception is thrown during the execution of the method, the span's status code will be set to ERROR and the exception will be re-thrown.
 * If the method returns a Promise, the span will be ended when the Promise is settled.
 * Otherwise, the span will be ended immediately after the method returns.
 *
 * @param spanName - The name of the span to be created.
 * @param spanOptions - The options to be applied to the span. Optional.
 * @param spanContext - The context to be used for creating the span. Optional. If not provided, the active context will be used.
 *
 * @returns The decorated descriptor.
 */
function createTracedMethod(
	spanName: string,
	spanOptions?: SpanOptions,
	spanContext?: Context
) {
	return function (
		_target: object,
		_propertyKey: string,
		descriptor: PropertyDescriptor
	) {
		const originalMethod = descriptor.value;

		descriptor.value = function (...args: any[]) {
			let result: unknown;
			globalTelemetryObjects.startActiveSpan(
				spanName,
				spanOptions ?? {},
				spanContext ?? context.active(),
				(span: Span) => {
					try {
						result = originalMethod.apply(this, args);
						span.setStatus({ code: 0 }); // Set status code to OK
					} catch (e) {
						span.setStatus({
							code: 2, // Set status code to ERROR
							message: e.message,
						});
						throw e; // re-throw the error
					} finally {
						if (result instanceof Promise) {
							result.finally(() => span.end()).catch(() => span.end());
						} else {
							span.end();
						}
					}
				}
			);
			return result;
		};

		return descriptor;
	};
}

/**
 * Decorator that starts an active span for a method.
 *
 * @param {string} [spanName] - The name of the span. If not provided, it will use the target's constructor name and property key.
 * @param {SpanOptions} [spanOptions] - The options to configure the span.
 * @param {Context} [spanContext] - The context of the span.
 * @returns {Function} - The decorated method.
 */
export function StartActiveSpan(
	spanName?: string,
	spanOptions?: SpanOptions,
	spanContext?: Context
) {
	return function (
		target: object,
		propertyKey: string,
		descriptor: PropertyDescriptor
	) {
		const usedSpanName =
			spanName ?? `${target.constructor.name}.${propertyKey}`;
		return createTracedMethod(usedSpanName, spanOptions, spanContext)(
			target,
			propertyKey,
			descriptor
		);
	};
}
