import StreamrClient, { Stream, StreamMetadata } from '@streamr/sdk';
import crypto from 'crypto';

import { counterId } from '../../src/utils/utils';

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
	const randomBit = crypto.randomBytes(4).toString('hex');
	return counterId(
		`/test/${randomTestRunId}${randomBit}/${getTestName(module)}${
			suffix !== undefined ? '-' + suffix : ''
		}`,
		'-'
	);
};

export const createTestStream = async (
	streamrClient: StreamrClient,
	module: NodeModule,
	props?: Partial<StreamMetadata>
): Promise<Stream> => {
	const stream = await streamrClient.createStream({
		id: createRelativeTestStreamId(module),
		...props,
	});
	return stream;
};
