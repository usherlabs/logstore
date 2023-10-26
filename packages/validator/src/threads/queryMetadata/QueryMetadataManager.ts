import { DataItem } from '@kyvejs/protocol';
import { QueryMetadataRequest, QueryMetadataResponse, SystemMessageType } from '@logsn/protocol';
import { BrandedString, EthereumAddress } from '@streamr/utils';
import type { RootDatabase } from 'lmdb';
import path from 'path';
import { merge, take, tap } from 'rxjs';



import { IRuntimeExtended } from '../../types';
import { Database } from '../../utils/database';
import { SystemMessageFromStream } from '../SystemListener';
import { QueryMetadataProcess } from './QueryMetadataProcess';


//   QueryMetadataManager
type KeyParameter = {
	fromKey: number;
	toKey: number;
};
type Key = BrandedString<'key'>;
type NodeMetadataMap = Map<EthereumAddress, QueryMetadataResponse['payload']>;
type DB = RootDatabase<NodeMetadataMap, Key>;

/**
 * QueryMetadataManager Class:
 * - Manages QueryMetadataProcess instances.
 * - Listens to and handles query metadata responses.
 * - Caches completed metadata payloads.
 * - Controls message stream subscriptions.
 * - Generates keys for caching and process retrieval.
 */
export class QueryMetadataManager {
	private readonly processes: Map<string, QueryMetadataProcess> = new Map();
	private _metadataCache: DB;

	constructor(
		private readonly _cachePath: string,
		private readonly core: IRuntimeExtended
	) {}

	public stop = () => undefined;

	public start() {
		this.initializeCache();
		const { messagesStreamFromType } = this.core.listener;

		// listen to query metadata responses from the network
		const queryMetadataResponseFlow$ = messagesStreamFromType(
			SystemMessageType.QueryMetadataResponse
		).pipe(tap(this.onResponseMessage));
		const queryMetadataRequestFlow$ = messagesStreamFromType(
			SystemMessageType.QueryMetadataRequest
		).pipe(tap(this.onRequestMessage));

		const subscription = merge(
			queryMetadataResponseFlow$,
			queryMetadataRequestFlow$
		).subscribe();

		// stop any previous subscription before starting a new one
		this.stop();
		this.stop = () => subscription.unsubscribe();
	}

	public getCachedMetadataForBundleItem(item: DataItem): NodeMetadataMap {
		const toKey = item.key;
		const fromKey = this.core.getPreviousKeyForDataItemKey(toKey);
		const key = this.getKey({
			fromKey: +fromKey,
			toKey: +toKey,
		});
		return this.metadataCache.get(key);
	}

	private get metadataCache() {
		if (!this._metadataCache) {
			throw new Error('Metadata cache not initialized');
		}
		return this._metadataCache;
	}

	private getKey({ fromKey, toKey }: KeyParameter) {
		return `${fromKey}-${toKey}` as Key;
	}

	public getOrCreateProcess({
		fromKey,
		toKey,
	}: KeyParameter): QueryMetadataProcess {
		const key = this.getKey({
			fromKey: fromKey,
			toKey: toKey,
		});
		if (!this.processes.has(key)) {
			const queryMetadataProcess = new QueryMetadataProcess(
				this.core,
				fromKey,
				toKey
			);
			queryMetadataProcess.fromState('ready').pipe(
				// we need to complete the process and unsubscribe from the stream
				// once the process completes, otherwise it will keep reprocessing it
				take(1),
				tap(async () => {
					await this.flushMetadata(queryMetadataProcess);
				})
			);
			this.processes.set(key, queryMetadataProcess);
		}
		return this.processes.get(key);
	}

	private async flushMetadata(queryMetadataProcess: QueryMetadataProcess) {
		const { fromKey, toKey } = queryMetadataProcess;
		const key = this.getKey({
			fromKey: fromKey,
			toKey: toKey,
		});
		const metadata = queryMetadataProcess.flushMetadataPayloads();

		await this.metadataCache.put(key, metadata);
	}

	private initializeCache() {
		const dbPath = path.join(this._cachePath, 'cache');
		this._metadataCache = Database.create('query-metadata', dbPath) as DB;
	}

	private onResponseMessage({
		message,
		metadata,
	}: SystemMessageFromStream<QueryMetadataResponse>) {
		const { from, to } = message;
		const queryMetadataProcess = this.getOrCreateProcess({
			fromKey: from,
			toKey: to,
		});
		queryMetadataProcess.handleResponseMessage(message, metadata);
	}

	private async onRequestMessage({
		message,
		metadata,
	}: SystemMessageFromStream<QueryMetadataRequest>) {
		const { from, to } = message;
		const queryMetadataProcess = this.getOrCreateProcess({
			fromKey: from,
			toKey: to,
		});

		await queryMetadataProcess.handleRequestMessage(message, metadata);
	}
}
