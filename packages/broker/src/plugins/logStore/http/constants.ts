// Only applying when the request isn't using text/event-stream
// It's a separate file to be able to mock on tests
export const EVENTS_PER_RESPONSE_LIMIT_ON_NON_STREAM = 5_000;
