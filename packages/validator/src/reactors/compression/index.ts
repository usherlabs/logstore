import { ICompression } from '@kyvejs/protocol';

import { GzipSplit } from './GzipSplit';

/**
 * compressionFactory creates the correct compression class
 * from the specified id. Current compression types are:
 *
 * 0 - NoCompression
 * 1 - Gzip
 * x - NoCompression (default)
 *
 * @method compressionFactory
 * @param {number} compressionId the id of the compression
 * @return {ICompression}
 */

/**
 * Log Store Note:
 *
 * Force NoCompression as Compression happens within the ArweaveSplit StorageProvider
 */
export const compressionFactory = (): ICompression => {
	return new GzipSplit();
};
