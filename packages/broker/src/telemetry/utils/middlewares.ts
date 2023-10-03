import { PublishMiddlewares } from '../../shared/BroadbandPublisher';
import { SubscriptionMiddleware } from '../../shared/BroadbandSubscriber';

/**
 * Middleware function that adds telemetry context to a published message.
 *
 * @param {Function} next - The next middleware function in the pipeline.
 * @returns {Function} - The middleware function.
 *
 * @see https://opentelemetry.io/docs/instrumentation/js/propagation/
 */
export const addTelemetryContextToPublishedMessageMiddleware: PublishMiddlewares =
	(next) => {
		// return <T>(message: T) => {
		// 	const activeContext = api.context.active();
		// 	const carrier = {};
		// 	propagation.inject(activeContext, carrier);
		// 	const telemetryContextStr = JSON.stringify(carrier);
		// 	const messageStr = JSON.stringify(message);
		// 	return next(`${messageStr}!context!${telemetryContextStr}`);
		// };

		// todo - create non invasive way to do this
		return next;
	};

/**
 * Middleware for retrieving telemetry context from a message.
 *
 * This middleware checks if the message contains telemetry context information,
 * and if so, extracts and sets the telemetry context before calling the next middleware.
 * If the message does not contain telemetry context, it simply calls the next middleware.
 *
 * @param {Function} next - The next middleware to call.
 * @returns {Function} A middleware function that takes in a message and metadata.
 *
 * @see https://opentelemetry.io/docs/instrumentation/js/propagation/
 */
export const getTelemetryContextMiddleware: SubscriptionMiddleware =
	(next) => (message, metadata) => {
		// so to deserialize the message we need to do this:
		// first let's detect if the message is a telemetry message
		// if (typeof message === 'string' && message.includes('!context!')) {
		// 	// if it is, we need to split it
		// 	const [messageStr, telemetryContextStr] = message.split('!context!');
		// 	// and then we need to parse the message
		// 	const nextMessage = JSON.parse(messageStr);
		// 	// and the telemetry context
		// 	const telemetryContext = JSON.parse(telemetryContextStr);
		// 	// and then we need to set the telemetry context
		// 	const activeContext = propagation.extract(
		// 		api.context.active(),
		// 		telemetryContext
		// 	);
		// 	api.context.with(activeContext, () => {
		// 		next(nextMessage, metadata);
		// 	});
		// } else {
		// 	// if it's not a telemetry message, we just call the next middleware
		// 	next(message, metadata);
		// }

		// todo - create non invasive way to do this
		next(message, metadata);
	};
