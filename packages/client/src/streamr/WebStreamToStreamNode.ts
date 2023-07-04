import { Readable, TransformOptions } from 'stream';

import { WebStreamToNodeStream } from './exports';

/**
 * Convert browser ReadableStream to Node stream.Readable.
 */
declare function WebStreamToNodeStream(
	webStream: ReadableStream | Readable,
	nodeStreamOptions?: TransformOptions
): Readable;

export { WebStreamToNodeStream };
