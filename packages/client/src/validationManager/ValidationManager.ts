import type { Schema } from 'ajv';
import {
	type StreamID,
	type StreamMetadata,
	StreamrClient,
} from 'streamr-client';
import { inject, Lifecycle, scoped } from 'tsyringe';

import { StreamrClientInjectionToken } from '../streamr/StreamrClient';
import { defaultAjv, getSchemaFromMetadata } from './getStreamSchema';
import type { SchemaParams } from './types';
import { getOrNull } from 'effect/Option';

@scoped(Lifecycle.ContainerScoped)
export class ValidationManager {
	constructor(
		@inject(StreamrClientInjectionToken)
		private streamrClient: StreamrClient
	) {}

	public async setValidationSchema({
		schemaOrHash,
		protocol,
		streamId,
	}: {
		streamId: string;
	} & SchemaParams): Promise<void> {
		const stream = await this.streamrClient.getStream(streamId);
		const actualMetadata = stream.getMetadata();

		if (typeof schemaOrHash === 'object') {
			await defaultAjv.validateSchema(schemaOrHash, true);
		}

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
			id: streamId,
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

	public async getValidationSchemaFromStreamMetadata(metadata: StreamMetadata) {
		const maybeSchemaPromise = getSchemaFromMetadata(metadata).pipe(getOrNull);

		if (!maybeSchemaPromise) {
			return null;
		}

		return maybeSchemaPromise;
	}

	public async getValidationSchema({
		streamId,
	}: {
		streamId: StreamID;
	}): Promise<Schema | null> {
		const actualMetadata = await this.streamrClient
			.getStream(streamId)
			.then((s) => s.getMetadata());

		return this.getValidationSchemaFromStreamMetadata(actualMetadata);
	}
}
