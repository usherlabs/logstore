import { JsonRpcProvider } from '@ethersproject/providers';
import { DataItem, sha256 } from '@kyvejs/protocol';
import {
	CONFIG_TEST,
	LogStoreClient,
	validateConfig as validateClientConfig,
} from '@logsn/client';
import ContractAddresses from '@logsn/contracts/address.json';
import { SystemMessageType } from '@logsn/protocol';
// import { ethers } from 'ethers';
import fse from 'fs-extra';

import { Item } from './core/item';
import { Report } from './core/report';
import {
	appPackageName,
	appVersion,
	getEvmPrivateKey,
	useStreamrTestConfig,
} from './env-config';
import { Managers } from './managers';
import { BroadbandSubscriber } from './shared/BroadbandSubscriber';
import {
	MessageMetricsSubject,
	MessageMetricsSummary,
} from './shared/MessageMetricsSummary';
import { rollingConfig } from './shared/rollingConfig';
import { ChainSources } from './sources';
import { EventsIndexer, SystemListener, TimeIndexer } from './threads';
import { Heartbeat } from './threads/Heartbeat';
// import { SystemRecovery } from './threads/SystemRecovery';
import { IConfig, IRuntimeExtended } from './types';
import { Slogger } from './utils/slogger';
import Validator from './validator';

const METRICS_SUBJECTS: MessageMetricsSubject[] = [
	{
		subject: 'ProofOfReport',
		type: SystemMessageType.ProofOfReport,
	},
	{
		subject: 'QueryRequest',
		type: SystemMessageType.QueryRequest,
	},
	{
		subject: 'QueryResponse',
		type: SystemMessageType.QueryResponse,
	},
	{
		subject: 'QueryPropagate',
		type: SystemMessageType.QueryPropagate,
	},
	{
		subject: 'RecoveryRequest',
		type: SystemMessageType.RecoveryRequest,
	},
	{
		subject: 'RecoveryResponse',
		type: SystemMessageType.RecoveryResponse,
	},
	{
		subject: 'RecoveryComplete',
		type: SystemMessageType.RecoveryComplete,
	},
];
const METRICS_INTERVAL = 60 * 1000;

export default class Runtime implements IRuntimeExtended {
	private _homeDir: string;
	public name = appPackageName;
	public version = appVersion;
	public config: IConfig = {
		heartbeatStreamId: '',
		recoveryStreamId: '',
		systemStreamId: '',
		sources: [],
		fees: {
			writeMultiplier: 1,
			treasuryMultiplier: 0.5, // Consumed from the Brokers by treasury for re-allocation to finance Validators
			readMultiplier: 0.05, // 5% of the write. For comparison AWS Serverless DynamoDB read fees are 20% of the write fees, prorated to the nearest 4kb
		},
	};
	public chain: ChainSources;
	public heartbeat: Heartbeat;
	public listener: SystemListener;
	public time: TimeIndexer;
	public events: EventsIndexer;
	public managers: Managers;
	private _startKey: number;
	private _startBlockNumber: number;

	async setup(core: Validator, homeDir: string) {
		Slogger.register(core.logger);
		core.logger.debug('Home Directory:', homeDir);

		this.chain = new ChainSources(this.config.sources);

		const startBlock = await this.startBlockNumber();
		this._homeDir = homeDir;

		const clientConfig = useStreamrTestConfig() ? CONFIG_TEST : {};
		validateClientConfig(clientConfig);

		// Tweaks suggested by the Streamr Team
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		clientConfig.network!.webrtcSendBufferMaxMessageCount = 5000;
		clientConfig.gapFill = true;
		clientConfig.gapFillTimeout = 30 * 1000;

		// core.logger.debug('Streamr Config', streamrConfig);
		const privateKey = getEvmPrivateKey(); // The Validator needs to stake in QueryManager
		// const signer = new ethers.Wallet(privateKey);
		const logStoreClient = new LogStoreClient({
			...clientConfig,
			auth: {
				privateKey,
			},
		});

		const heartbeatStream = await logStoreClient.getStream(
			this.config.heartbeatStreamId
		);

		const systemStream = await logStoreClient.getStream(
			this.config.systemStreamId
		);

		// const recoveryStream = await logStoreClient.getStream(
		// 	this.config.recoveryStreamId
		// );

		const heartbeatSubscriber = new BroadbandSubscriber(
			logStoreClient,
			heartbeatStream
		);

		const systemSubscriber = new BroadbandSubscriber(
			logStoreClient,
			systemStream
		);

		const messageMetricsSummary = new MessageMetricsSummary(METRICS_SUBJECTS);

		this.heartbeat = new Heartbeat(heartbeatSubscriber);

		// const recovery = new SystemRecovery(
		// 	logStoreClient,
		// 	recoveryStream,
		// 	signer,
		// 	messageMetricsSummary,
		// 	core.logger,
		// 	this
		// );

		let startKey = parseInt(core.pool.data.current_key, 10) || 0;
		if (startKey) {
			startKey -= rollingConfig(startKey).prev.keyStep;
		}

		this.events = new EventsIndexer(
			homeDir,
			core.pool.id,
			startBlock,
			this.chain,
			core.lcd,
			core.logger
		);
		this.time = new TimeIndexer(homeDir, startBlock, this.chain, core.logger);

		this.listener = new SystemListener(
			homeDir,
			logStoreClient,
			systemSubscriber,
			// recovery,
			messageMetricsSummary,
			core.logger
		);

		this.managers = new Managers(this.chain, this.events);

		setInterval(
			() =>
				core.logger.info(
					`Metrics ${JSON.stringify(messageMetricsSummary.summary)}`
				),
			METRICS_INTERVAL
		);
	}

	async runThreads() {
		await this.heartbeat.start();
		await this.time.start();
		await this.listener.start();
		await this.events.start();
	}

	async ready(core: Validator, syncPoolState: () => Promise<void>) {
		// const getCurrentKeyMs = async () => {
		// 	/* eslint-disable */
		// 	const nextKey = core.pool.data!.current_key
		// 		? await this.nextKey(core, core.pool.data!.current_key)
		// 		: core.pool.data!.start_key;
		// 	/* eslint-enable */
		//
		// 	return parseInt(nextKey, 10) * 1000;
		// };

		// const listenerHasValidData = async () => {
		// 	let currentKeyMs = await getCurrentKeyMs();
		// 	if (!currentKeyMs) {
		// 		// If the pool hasn't started yet, then this check can pass.
		// 		return;
		// 	}
		// 	// If the pool has started, then the currentKey > listener.startTime to proceed.
		// 	// ie. Listener should start before the start of the bundle.
		// 	while (
		// 		!this.listener.startTimestamp ||
		// 		this.listener.startTimestamp > currentKeyMs
		// 	) {
		// 		if (!this.listener.startTimestamp) {
		// 			core.logger.info(
		// 				'SystemListener is not started yet. Sleeping for 10 seconds...'
		// 			);
		// 			await sleep(10 * 1000);
		// 		} else {
		// 			const sleepMs = this.listener.startTimestamp - currentKeyMs + 1000;
		// 			core.logger.info(
		// 				`SystemListener.startTime (${
		// 					this.listener.startTimestamp
		// 				}) is greater than currentKeyMs (${currentKeyMs}). Sleeping for ${(
		// 					sleepMs / 1000
		// 				).toFixed(2)} seconds...`
		// 			);
		// 			await sleep(sleepMs);
		// 		}
		// 		await syncPoolState();
		// 		currentKeyMs = await getCurrentKeyMs();
		// 	}
		// };

		await Promise.all([
			this.events.ready(),
			// listenerHasValidData(),
			this.time.ready(),
		]);
	}

	async validateSetConfig(rawConfig: string): Promise<void> {
		const config: IConfig = JSON.parse(rawConfig);

		if (!config.sources.length) {
			throw new Error(`Config does not have any sources`);
		}

		// if in alpha network then replace sources defined by the pool config with Alchemy source
		if (config.sources.find((source) => source.includes('polygon-rpc.com'))) {
			config.sources = [
				'https://polygon-mainnet.g.alchemy.com/v2/TZ57-u9wrzpTTndvgMNQqPq790OaEdpp',
			];
		}

		let chainId = null;
		for (const source of config.sources) {
			const provider = new JsonRpcProvider(source);
			const network = await provider.getNetwork();
			if (typeof chainId !== 'number') {
				chainId = network.chainId;
			} else if (chainId !== network.chainId) {
				throw new Error(
					`Config sources have different network chain identifiers`
				);
			}
		}
		const systemContracts = ContractAddresses[chainId];
		if (typeof systemContracts === 'undefined') {
			throw new Error(`Config sources have invalid network chain identifier`);
		}

		const isDevNetwork =
			systemContracts.nodeManagerAddress ===
			'0x85ac4C8E780eae81Dd538053D596E382495f7Db9';

		const heartbeatStreamId = isDevNetwork
			? `${systemContracts.nodeManagerAddress}/heartbeat`
			: '0xa156eda7dcd689ac725ce9595d4505bf28256454/alpha-heartbeat';

		const recoveryStreamId = isDevNetwork
			? `${systemContracts.nodeManagerAddress}/recovery`
			: '0xa156eda7dcd689ac725ce9595d4505bf28256454/alpha-recovery';

		const systemStreamId = isDevNetwork
			? `${systemContracts.nodeManagerAddress}/system`
			: '0xa156eda7dcd689ac725ce9595d4505bf28256454/alpha-system';

		this.config = {
			...this.config,
			...config,
			heartbeatStreamId,
			recoveryStreamId,
			systemStreamId,
		};
	}

	// * Data items are produced here for the bundle in local cache. The local bundle is then used for voting on proposed bundles, and creating new bundle proposals?
	async getDataItem(core: Validator, key: string): Promise<DataItem> {
		const keyInt = parseInt(key, 10);
		if (!keyInt) {
			return { key, value: { m: [] } };
		}

		if (keyInt > this.time.latestTimestamp) {
			core.logger.info(
				'Key is greater than last indexed block/timestamp. Failing prevalidation to retry...'
			);
			return null;
		}

		// -------- Produce the Data Item --------
		const fromKey = (keyInt - rollingConfig(keyInt).prev.keyStep).toString();
		const item = new Item(this, core.logger, fromKey, key);
		const messages = await item.generate();

		return {
			key,
			value: { m: messages },
		};
	}

	// https://github.com/KYVENetwork/kyvejs/tree/main/common/protocol/src/methods/helpers/saveGetTransformDataItem.ts#L33
	async prevalidateDataItem(_: Validator, item: DataItem): Promise<boolean> {
		return item && !!item.value;
	}

	// https://github.com/KYVENetwork/kyvejs/tree/main/common/protocol/src/methods/helpers/saveGetTransformDataItem.ts#L44
	async transformDataItem(_: Validator, item: DataItem): Promise<DataItem> {
		return item;
	}

	// Check if data items from different sources are the same. Fantastic 👏
	async validateDataItem(
		_: Validator,
		proposedDataItem: DataItem,
		validationDataItem: DataItem
	): Promise<boolean> {
		const proposedDataItemHash = sha256(
			Buffer.from(JSON.stringify(proposedDataItem.value.m))
		);
		const validationDataItemHash = sha256(
			Buffer.from(JSON.stringify(validationDataItem.value.m))
		);

		const isValid = proposedDataItemHash === validationDataItemHash;

		if (!isValid) {
			await fse.outputFile(
				`${this._homeDir}/bundles/${proposedDataItem.key}-proposed.json`,
				JSON.stringify(proposedDataItem, null, 2)
			);
			await fse.outputFile(
				`${this._homeDir}/bundles/${validationDataItem.key}-validation.json`,
				JSON.stringify(validationDataItem, null, 2)
			);
		}

		return isValid;
	}

	async summarizeDataBundle(
		core: Validator,
		bundle: DataItem[]
	): Promise<string> {
		const firstItem = bundle.at(0);
		const lastItem = bundle.at(-1);

		const summary = [lastItem.key];

		core.logger.info(`Create Report: ${lastItem.key}`);
		const report = new Report(this, core.logger, firstItem.key, lastItem.key);
		const systemReport = await report.generate();
		const reportData = systemReport.serialize();
		const reportHash = sha256(Buffer.from(JSON.stringify(reportData))); // use sha256 of entire report to include report.events.
		core.logger.debug(`Report hash generated: ${reportHash}`);

		lastItem.value.r = reportData;
		summary.push(reportHash);

		core.logger.info(`Create Events: ${lastItem.key}`);
		const eventsForColdStore = this.events.prepare(true);
		console.log(eventsForColdStore);
		if (eventsForColdStore.length > 0) {
			core.logger.debug(
				`${eventsForColdStore.length} events prepared for cold storage`
			);
			const eventsHash = sha256(
				Buffer.from(JSON.stringify(eventsForColdStore))
			);
			lastItem.value.e = eventsForColdStore;
			summary.push(eventsHash);
		}

		await fse.outputFile(
			`${this._homeDir}/bundles/${firstItem.key}-${lastItem.key}.json`,
			JSON.stringify(bundle, null, 2)
		);

		return summary.join('_');
	}

	async startKey(): Promise<number> {
		if (!this._startKey) {
			this._startKey = await this.chain.getTimestampByBlock(
				await this.startBlockNumber()
			);
		}

		return this._startKey;
	}

	async startBlockNumber(): Promise<number> {
		if (!this._startBlockNumber) {
			this._startBlockNumber = await this.chain.getStartBlockNumber();
		}

		return this._startBlockNumber;
	}

	// nextKey is called before getDataItem, therefore the dataItemCounter will be max_bundle_size when report is due.
	// https://github.com/KYVENetwork/kyvejs/blob/main/common/protocol/src/methods/main/runCache.ts#L147
	async nextKey(core: Validator, key: string): Promise<string> {
		let keyInt = parseInt(key, 10);

		if (!keyInt) {
			const startKey = await this.startKey();
			core.logger.info(`Log Store Network Start key: ${startKey}`);
			return startKey.toString();
		}

		keyInt += rollingConfig(keyInt).curr.keyStep;

		return keyInt.toString();
	}
}
