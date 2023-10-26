import {
	LogStoreClient,
	MessageMetadata,
	Stream,
	Subscription,
} from '@logsn/client';
import {
	QueryMetadataRequest,
	QueryMetadataResponse,
	SystemMessage,
	SystemMessageType,
} from '@logsn/protocol';
import { BrandedString, Logger } from '@streamr/utils';

import { SystemCache } from './SystemCache';

const INTERVAL = 100;
const PAYLOAD_LIMIT = 50;

const logger = new Logger(module);

type Key = BrandedString<'key'>;
const getKey = (from: number, to: number): Key => `${from}-${to}` as Key;

type ActiveRequest = [QueryMetadataRequest, number];

export class QueryMetadataManager {
	private subscription?: Subscription;
	private activeRequests = new Map<Key, ActiveRequest>();
	public readonly COOLDOWN_MS = 2_000;

	constructor(
		private readonly client: LogStoreClient,
		private readonly systemStream: Stream,
		private readonly cache: SystemCache
	) {
		//
	}

	public async start() {
		this.subscription = await this.client.subscribe(
			this.systemStream,
			this.onMessage.bind(this)
		);

		logger.info('Started');
	}

	public async stop() {
		await this.subscription?.unsubscribe();

		logger.info('Stopped');
	}

	private async onMessage(message: unknown, metadata: MessageMetadata) {
		const systemMessage = SystemMessage.deserialize(message);
		if (systemMessage.messageType !== SystemMessageType.QueryMetadataRequest) {
			return;
		}

		const request = systemMessage as QueryMetadataRequest;
		logger.debug('Received QueryMetadataRequest %s', JSON.stringify(request));

		setImmediate(async () => {
			await this.processRequest(request, metadata.timestamp);
		});
	}

	public async processRequest(
		queryMetadataRequest: QueryMetadataRequest,
		requestCreatedAtTimestamp: number
	) {
		const activeRequestForKey = this.getActiveRequestForKey({
			from: queryMetadataRequest.from,
			to: queryMetadataRequest.to,
			requestCreatedAtTimestamp: requestCreatedAtTimestamp,
		});
		if (activeRequestForKey !== null) {
			return;
		}

		const key = getKey(queryMetadataRequest.from, queryMetadataRequest.to);
		this.activeRequests.set(key, [
			queryMetadataRequest,
			requestCreatedAtTimestamp,
		]);

		const { from, to } = queryMetadataRequest;

		const cacheRecords = this.cache.get(from, to);

		let seqNum: number = 0;
		const payload: [SystemMessage, MessageMetadata][] = [];
		for await (const cacheRecord of cacheRecords) {
			payload.push([cacheRecord.message, cacheRecord.metadata]);

			if (payload.length === PAYLOAD_LIMIT) {
				await this.sendResponse(
					queryMetadataRequest,
					requestCreatedAtTimestamp,
					seqNum++,
					payload.splice(0),
					// this is not the last response, even if the next is empty
					false
				);
				await new Promise((resolve) => setTimeout(resolve, INTERVAL));
			}
		}

		// we may be sending empty payload, but that's ok, it's important to signalize we ended
		await this.sendResponse(
			queryMetadataRequest,
			requestCreatedAtTimestamp,
			seqNum++,
			payload,
			true
		);
	}

	public getActiveRequestForKey({
		from,
		to,
		requestCreatedAtTimestamp,
	}: {
		from: number;
		to: number;
		requestCreatedAtTimestamp: number;
	}): {
		remainingCooldownInMs: number;
		currentActiveRequest: ActiveRequest;
	} | null {
		const activeRequest = this.activeRequests.get(getKey(from, to));
		if (activeRequest === undefined) {
			return null;
		}
		const timestampDiff = requestCreatedAtTimestamp - activeRequest[1];
		const remainingCooldownInMs = Math.max(this.COOLDOWN_MS - timestampDiff, 0);
		return remainingCooldownInMs > 0
			? {
					remainingCooldownInMs: remainingCooldownInMs,
					currentActiveRequest: activeRequest,
			  }
			: null;
	}

	private async sendResponse(
		request: QueryMetadataRequest,
		requestTimestamp: number,
		seqNum: number,
		payload: [SystemMessage, MessageMetadata][],
		isLast: boolean
	) {
		const queryMetadataResponse = new QueryMetadataResponse({
			requestId: request.requestId,
			seqNum,
			payload,
			requestTimestamp,
			from: request.from,
			to: request.to,
			isLast,
		});

		const serializedResponse = queryMetadataResponse.serialize();

		await this.systemStream.publish(serializedResponse);
		logger.debug(
			'Published QueryMetadataResponse %s',
			JSON.stringify({
				requestId: queryMetadataResponse.requestId,
				seqNum: queryMetadataResponse.seqNum,
				bytes: serializedResponse.length,
			})
		);
	}
}
