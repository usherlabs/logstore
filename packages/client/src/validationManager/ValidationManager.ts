import type { StreamID, StreamrClient } from '@logsn/streamr-client';
import type { Schema } from 'ajv';
import { Option } from 'effect';

import { getSchemaFromMetadata } from './getStreamSchema';
import type { SchemaParams } from './types';

export class ValidationManager {
	constructor(private readonly streamrClient: StreamrClient) {}

	public async setValidationSchema({
		schemaOrHash,
		protocol,
		streamId,
	}: {
		streamId: string;
	} & SchemaParams): Promise<void> {
		const actualMetadata = await this.streamrClient
			.getStream(streamId)
			.then((s) => s.getMetadata());
		await this.streamrClient.updateStream({
			...actualMetadata,
			// @ts-expect-error Metadata on streamr doesn't specify additional properties
			logstore: {
				// @ts-expect-error Metadata on streamr doesn't specify additional properties
				...actualMetadata.logstore,
				schema: {
					schemaOrHash,
					protocol,
				},
			},
		});
	}

	public async removeValidationSchema({
		streamId,
	}: {
		streamId: StreamID;
	}): Promise<void> {
		const actualMetadata = await this.streamrClient
			.getStream(streamId)
			.then((s) => s.getMetadata());

		// @ts-expect-error Metadata on streamr doesn't specify additional properties
		if (actualMetadata.logstore?.schema) {
			// @ts-expect-error Metadata on streamr doesn't specify additional properties
			delete actualMetadata.logstore.schema;
			await this.streamrClient.updateStream({
				...actualMetadata,
				id: streamId,
			});
		}
	}

	public async getValidationSchema({
		streamId,
	}: {
		streamId: StreamID;
	}): Promise<Schema | null> {
		const actualMetadata = await this.streamrClient
			.getStream(streamId)
			.then((s) => s.getMetadata());

		const schemaOptions: SchemaParams | undefined =
			// @ts-expect-error Metadata on streamr doesn't specify additional properties
			actualMetadata.logstore?.schema;
		if (!schemaOptions) {
			return null;
		}

		const maybeSchemaPromise = getSchemaFromMetadata(
			// @ts-expect-error Metadata on streamr doesn't specify additional properties
			actualMetadata.logstore.schema
		).pipe(Option.getOrNull);

		if (!maybeSchemaPromise) {
			return null;
		}

		return maybeSchemaPromise;
	}
}
