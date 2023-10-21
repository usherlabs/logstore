import {
	bundleToBytes,
	bytesToBundle,
	DataItem,
	ICompression,
	MAX_BUNDLE_BYTE_SIZE,
} from '@kyvejs/protocol';
import _ from 'lodash';

import { bufferSplit } from '../../utils/buffer';
import { gunzip, gzip } from '../../utils/gzip';
import { Slogger } from '../../utils/slogger';

const gzipSplitPrimaryDelimiter = Buffer.from('!!!!-------:LS_PD:-------!!!!');

function componentsFromBundle(bundle: DataItem[]): {
	report: { [key: string]: unknown };
	events: { [key: string]: unknown } | undefined;
	messages: DataItem[];
} {
	const lastItem = bundle[bundle.length - 1];
	const report = lastItem.value.r;
	const events = lastItem.value.e;

	const remainingProps = _.omit(lastItem.value, 'r', 'e');

	// Construct the messages with the modified last item
	const messages = [
		...bundle.slice(0, bundle.length - 1),
		{
			...lastItem,
			value: remainingProps,
		},
	];

	return { report, events, messages };
}

export class GzipSplit implements ICompression {
	public name = 'LogStoreGzipSplit';
	public mimeType = 'application/gzip';

	public static split(data: Buffer) {
		return bufferSplit(data, gzipSplitPrimaryDelimiter);
	}

	public static join(data: Buffer[]) {
		const buffers: Buffer[] = [];
		const size = data.length;
		data.forEach((b, i) => {
			buffers.push(b);
			if (i !== size - 1) {
				buffers.push(gzipSplitPrimaryDelimiter);
			}
		});
		return Buffer.concat(buffers);
	}

	async compress(data: Buffer) {
		const bundle = bytesToBundle(data);
		const { report, events, messages } = componentsFromBundle(bundle);
		const messagesBuffer = bundleToBytes(messages);
		const reportBuffer = bundleToBytes(report as any);
		const promises = [gzip(messagesBuffer), gzip(reportBuffer)];
		if (events) {
			const eventsBuffer = bundleToBytes(events as any);
			promises.push(gzip(eventsBuffer));
		}
		const zips = await Promise.all(promises);

		return GzipSplit.join(zips);
	}

	async decompress(data: Buffer) {
		Slogger.instance.debug('GzipSplit.decompress - data', data.toString());
		const zips = GzipSplit.split(data);

		// limit maxOutputLength to protect against zip bombs
		const json = await Promise.all(
			zips.map((zip) => gunzip(zip, { maxOutputLength: MAX_BUNDLE_BYTE_SIZE }))
		);

		Slogger.instance.debug('GzipSplit.decompress - output', {
			json: json.map((j) => j.toString()),
		});

		const bundle = bytesToBundle(json[0]);
		const report = JSON.parse(json[1].toString());
		let events;
		if (json.length > 2) {
			events = JSON.parse(json[2].toString());
		}

		Slogger.instance.debug('GzipSplit.decompress - output', {
			bundle,
			report,
			events,
		});

		bundle[bundle.length - 1].value.r = report;
		bundle[bundle.length - 1].value.e = events;

		return bundleToBytes(bundle);
	}
}
