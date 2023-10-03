import { meter } from '../globalTelemetryObjects';

const openStreams = meter.createUpDownCounter('node.open_streams', {
	description: 'Total number of open streams',
	unit: 'streams',
});
