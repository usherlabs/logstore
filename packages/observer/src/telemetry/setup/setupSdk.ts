import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { Resource } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import process from 'process';

import { PACKAGE_NAME } from '../../constants';

const otelTracingExport = process.env.TRACING_URL;
const otelMetricsExport = process.env.METRICS_URL;

const exporterOptions = {
	url: otelTracingExport,
} satisfies ConstructorParameters<typeof OTLPTraceExporter>[0];

export const traceExporter = otelTracingExport
	? new OTLPTraceExporter(exporterOptions)
	: undefined;

export const metricReader = otelMetricsExport
	? new PeriodicExportingMetricReader({
			exporter: new OTLPMetricExporter({
				url: otelMetricsExport,
			}),
			exportIntervalMillis: 30_000,
	  })
	: undefined;

const isLocal = process.env.IS_LOCAL === 'true';

const contextManager = new AsyncHooksContextManager();
contextManager.enable();

export const sdk: NodeSDK = new NodeSDK({
	traceExporter,
	metricReader: metricReader,
	contextManager: contextManager,
	instrumentations: [
		getNodeAutoInstrumentations({
			'@opentelemetry/instrumentation-fs': {
				enabled: false,
			},
		}),
		new HttpInstrumentation({
			enabled: true,
		}),
	],
	resource: new Resource({
		[SemanticResourceAttributes.SERVICE_NAME]: isLocal
			? `${PACKAGE_NAME} (local)`
			: PACKAGE_NAME,
	}),
});

export const enabledObservabilityFeatures = {
	tracing: !!traceExporter,
	metrics: !!metricReader,
};

export const isAnyObservabilityFeatureEnabled = Object.values(
	enabledObservabilityFeatures
).some((value) => value);
