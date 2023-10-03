import { metrics, trace } from '@opentelemetry/api';

import { PACKAGE_NAME } from '../constants';

export const tracer = trace.getTracer(PACKAGE_NAME);
export const meter = metrics.getMeter(PACKAGE_NAME);
