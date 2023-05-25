import {
	LoggerFactory,
	Stream,
	StreamMetadata,
} from '@concertodao/streamr-client';
import crypto from 'crypto';

import { LogStoreClient } from '../../src/LogStoreClient';
import { counterId } from '../../src/utils/utils';

export function mockLoggerFactory(clientId?: string): LoggerFactory {
	return new LoggerFactory({
		id: clientId ?? counterId('TestCtx'),
		logLevel: 'info',
	});
}

export const uid = (prefix?: string): string =>
	counterId(`p${process.pid}${prefix ? '-' + prefix : ''}`);

const getTestName = (module: NodeModule): string => {
	const fileNamePattern = new RegExp('.*/(.*).test\\...');
	const groups = module.filename.match(fileNamePattern);
	return groups !== null ? groups[1] : module.filename;
};

const randomTestRunId =
	process.pid != null ? process.pid : crypto.randomBytes(4).toString('hex');

export const createRelativeTestStreamId = (
	module: NodeModule,
	suffix?: string
): string => {
	return counterId(
		`/test/${randomTestRunId}/${getTestName(module)}${
			suffix !== undefined ? '-' + suffix : ''
		}`,
		'-'
	);
};

export const createTestStream = async (
	logStoreClient: LogStoreClient,
	module: NodeModule,
	props?: Partial<StreamMetadata>
): Promise<Stream> => {
	const stream = await logStoreClient.createStream({
		id: createRelativeTestStreamId(module),
		...props,
	});
	return stream;
};
