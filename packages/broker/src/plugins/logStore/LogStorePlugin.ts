import {
	QueryLastOptions,
	QueryMessage,
	QueryMessageType,
	QueryRequest,
	QueryResponse,
	QueryType,
} from '@concertodao/logstore-protocol';
import { StreamMessage, StreamMessageType } from '@streamr/protocol';
import { EthereumAddress, Logger, MetricsContext } from '@streamr/utils';
import { Schema } from 'ajv';
import { Stream } from 'streamr-client';

import {
	formLogStoreQueryStreamId,
	formLogStoreSystemStreamId,
} from '../../client/utils/utils';
import { Plugin, PluginOptions } from '../../Plugin';
import PLUGIN_CONFIG_SCHEMA from './config.schema.json';
import { LogStore, startCassandraLogStore } from './LogStore';
import { LogStoreConfig } from './LogStoreConfig';

const logger = new Logger(module);

export interface LogStorePluginConfig {
	cassandra: {
		hosts: string[];
		username: string;
		password: string;
		keyspace: string;
		datacenter: string;
	};
	logStoreConfig: {
		refreshInterval: number;
	};
	// TODO: Do we need the cluster config for LogStore
	cluster: {
		// If clusterAddress is undefined, the broker's address will be used
		clusterAddress?: EthereumAddress;
		clusterSize: number;
		myIndexInCluster: number;
	};
}

const isStorableMessage = (msg: StreamMessage): boolean => {
	return msg.messageType === StreamMessageType.MESSAGE;
};

export class LogStorePlugin extends Plugin<LogStorePluginConfig> {
	constructor(options: PluginOptions) {
		super(options);
	}

	private logStore?: LogStore;
	private logStoreConfig?: LogStoreConfig;
	private messageListener?: (msg: StreamMessage) => void;

	async start(): Promise<void> {
		const assignmentStream = await this.logStoreClient.getStream(
			formLogStoreSystemStreamId(
				//TODO: StrictConfig required
				this.brokerConfig.client.contracts!.logStoreManagerChainAddress!
			)
		);

		const logStoreQueryStreamId = formLogStoreQueryStreamId(
			//TODO: StrictConfig required
			this.brokerConfig.client.contracts!.logStoreManagerChainAddress!
		).toString();

		await this.logStoreClient.subscribe(
			logStoreQueryStreamId,
			async (content, metadata) => {
				logger.trace(
					'Received LogStoreQuery, content: %s metadata: %s',
					content,
					metadata
				);

				const queryMessage = QueryMessage.deserialize(content);
				logger.trace('Deserialized QueryRequest: %s', queryMessage);

				if (queryMessage.messageType === QueryMessageType.QueryRequest) {
					const queryRequest = queryMessage as QueryRequest;
					logger.trace('Deserialized queryRequest: %s', queryRequest);

					switch (queryRequest.queryType) {
						case QueryType.Last:
							// eslint-disable-next-line no-case-declarations
							const { last } = queryRequest.queryOptions as QueryLastOptions;

							// eslint-disable-next-line no-case-declarations
							const readableStrem = this.logStore!.requestLast(
								queryRequest.streamId,
								0,
								last
							);

							for await (const chunk of readableStrem) {
								const streamMessage = chunk as StreamMessage;
								const queryResponse = new QueryResponse({
									requestId: queryMessage.requestId,
									payload: streamMessage.serialize(),
									isFinal: false,
								});
								await this.logStoreClient.publish(
									logStoreQueryStreamId,
									queryResponse.serialize()
								);
							}

							// eslint-disable-next-line no-case-declarations
							const fianleQqueryResponse = new QueryResponse({
								requestId: queryMessage.requestId,
								payload: '',
								isFinal: true,
							});
							await this.logStoreClient.publish(
								logStoreQueryStreamId,
								fianleQqueryResponse.serialize()
							);

							// await new Promise<void>((resolve) => {
							// 	readableStrem.on('data', async () => {
							// 		let chunk;
							// 		// There is some data to read now.
							// 		while (null !== (chunk = readableStrem.read())) {
							// 			const queryResponse = new QueryResponse({
							// 				requestId: queryMessage.requestId,
							// 				body: 'BODY',
							// 			});
							// 			await this.streamrClient.publish(
							// 				logStoreQueryStreamId,
							// 				queryResponse
							// 			);
							// 		}
							// 	});

							// 	readableStrem.on('end', () => {
							// 		resolve();
							// 	});
							// });
							// for await (const _chunk of readableStrem) {
							// 	const queryResponse = new QueryResponse({
							// 		requestId: queryMessage.requestId,
							// 		body: 'BODY',
							// 	});
							// 	this.streamrClient.publish(
							// 		logStoreQueryStreamId,
							// 		queryResponse
							// 	);
							// }

							// await pipeline(
							// 	readableStrem,
							// 	async function* (source, { signal }) {
							// 		for await (const chunk of source) {
							// 			yield await processChunk(chunk, { signal });
							// 		}
							// 	}
							// );

							break;
						case QueryType.From:
							// TODO: implement respnose for QueryType.From
							break;
						case QueryType.Range:
							// TODO: implement respnose for QueryType.Range
							break;
					}

					// const queryResponse = new QueryResponse({
					// 	requestId: queryMessage.requestId,
					// 	body: 'Query Response from LogsStorePlugin',
					// });
					// await this.streamrClient.publish(
					// 	logStoreQueryStreamId,
					// 	queryResponse.serialize()
					// );
				}
			}
		);

		const metricsContext = (
			await this.logStoreClient!.getNode()
		).getMetricsContext();
		this.logStore = await this.startCassandraStorage(metricsContext);

		this.logStoreConfig = await this.startLogStoreConfig(assignmentStream);
		this.messageListener = (msg) => {
			if (
				isStorableMessage(msg) &&
				this.logStoreConfig!.hasStreamPart(msg.getStreamPartID())
			) {
				this.logStore!.store(msg);
			}
		};
		const node = await this.logStoreClient.getNode();
		node.addMessageListener(this.messageListener);
	}

	async stop(): Promise<void> {
		const node = await this.logStoreClient.getNode();
		node.removeMessageListener(this.messageListener!);
		this.logStoreConfig!.getStreamParts().forEach((streamPart) => {
			node.unsubscribe(streamPart);
		});
		await Promise.all([this.logStore!.close(), this.logStoreConfig!.destroy()]);
	}

	// eslint-disable-next-line class-methods-use-this
	override getConfigSchema(): Schema {
		return PLUGIN_CONFIG_SCHEMA;
	}

	private async startCassandraStorage(
		metricsContext: MetricsContext
	): Promise<LogStore> {
		const cassandraStorage = await startCassandraLogStore({
			contactPoints: [...this.pluginConfig.cassandra.hosts],
			localDataCenter: this.pluginConfig.cassandra.datacenter,
			keyspace: this.pluginConfig.cassandra.keyspace,
			username: this.pluginConfig.cassandra.username,
			password: this.pluginConfig.cassandra.password,
			opts: {
				useTtl: false,
			},
		});
		cassandraStorage.enableMetrics(metricsContext);
		return cassandraStorage;
	}

	private async startLogStoreConfig(
		systemStream: Stream
	): Promise<LogStoreConfig> {
		const node = await this.logStoreClient.getNode();

		const logStoreConfig = new LogStoreConfig(
			this.pluginConfig.cluster.clusterSize,
			this.pluginConfig.cluster.myIndexInCluster,
			this.pluginConfig.logStoreConfig.refreshInterval,
			this.logStoreClient,
			{
				onStreamPartAdded: async (streamPart) => {
					try {
						await node.subscribeAndWaitForJoin(streamPart); // best-effort, can time out
					} catch (_e) {
						// no-op
					}
					try {
						await systemStream.publish({
							streamPart,
						});
						logger.debug(
							'published message to assignment stream %s',
							systemStream.id
						);
					} catch (e) {
						logger.warn(
							'failed to publish to assignment stream %s, reason: %s',
							systemStream.id,
							e
						);
					}
				},
				onStreamPartRemoved: (streamPart) => {
					node.unsubscribe(streamPart);
				},
			}
		);
		await logStoreConfig.start();
		return logStoreConfig;
	}
}
