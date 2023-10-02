import { metrics, trace } from '@opentelemetry/api';

export const globalTelemetryObjects = trace.getTracer('logstore-broker');
export const meter = metrics.getMeter('logstore-broker');
