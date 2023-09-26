import { JsonRpcProvider } from '@ethersproject/providers';
import { DataItem, sha256 } from '@kyvejs/protocol';
import {
	CONFIG_TEST,
	LogStoreClient,
	validateConfig as validateClientConfig,
} from '@logsn/client';
import ContractAddresses from '@logsn/contracts/address.json';
import { SystemMessageType } from '@logsn/protocol';
import { ethers } from 'ethers';
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
import { SystemListener, TimeIndexer } from './threads';
import { Heartbeat } from './threads/Heartbeat';
import { SystemRecovery } from './threads/SystemRecovery';
import { IConfig, IRuntimeExtended } from './types';
import Validator from './validator';

const METRICS_SUBJECTS: MessageMetricsSubject[] = [
	{
		subject: 'ProofOfMessageStored',
		type: SystemMessageType.ProofOfMessageStored,
	},
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
	public heartbeat: Heartbeat;
	public listener: SystemListener;
	public time: TimeIndexer;
	private _startBlockNumber: number;
	private _startKey: number;

	async setupThreads(core: Validator, homeDir: string) {
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
		const signer = new ethers.Wallet(privateKey);
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

		const recoveryStream = await logStoreClient.getStream(
			this.config.recoveryStreamId
		);

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

		const recovery = new SystemRecovery(
			logStoreClient,
			recoveryStream,
			signer,
			messageMetricsSummary,
			core.logger
		);

		let startKey = parseInt(core.pool.data.current_key, 10) || 0;
		if (startKey) {
			startKey -= rollingConfig(startKey).prev.keyStep;
		}

		this.time = new TimeIndexer(startKey, homeDir, this.config, core.logger);

		this.listener = new SystemListener(
			homeDir,
			logStoreClient,
			systemSubscriber,
			recovery,
			messageMetricsSummary,
			core.logger
		);

		await this.heartbeat.start();
		await this.time.start();
		await this.listener.start();

		setInterval(
			() =>
				core.logger.info(
					`Metrics ${JSON.stringify(messageMetricsSummary.summary)}`
				),
			METRICS_INTERVAL
		);
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

		await Managers.setSources(config.sources);

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

		if (
			!this.time.latestTimestamp ||
			keyInt > this.time.latestTimestamp ||
			!this.listener.latestTimestamp ||
			keyInt > this.listener.latestTimestamp / 1000
		) {
			return null;
		}

		// -------- Produce the Data Item --------
		const item = new Item(core, this, this.config, key, key);
		await item.prepare();
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
		core.logger.info(`Create Report: ${lastItem.key}`);
		const report = new Report(
			core,
			this,
			this.config,
			firstItem.key,
			lastItem.key
		);
		await report.prepare();
		const systemReport = await report.generate();
		const reportData = systemReport.serialize();
		const reportHash = sha256(Buffer.from(JSON.stringify(reportData))); // use sha256 of entire report to include "events".

		lastItem.value.r = reportData;

		await fse.outputFile(
			`${this._homeDir}/bundles/${firstItem.key}-${lastItem.key}.json`,
			JSON.stringify(bundle, null, 2)
		);

		return lastItem.key + '_' + reportHash;
	}

	async startBlockNumber(): Promise<number> {
		if (!this._startBlockNumber) {
			this._startBlockNumber = await Managers.withSources<number>(
				async (managers) => {
					return await managers.node.getStartBlockNumber();
				}
			);
		}

		return this._startBlockNumber;
	}

	async startKey(): Promise<number> {
		if (!this._startKey) {
			const startBlockNumber = await this.startBlockNumber();
			// Re-fetch the start key from sources rather than from time-index, as time-index starts from last report id
			this._startKey = await Managers.withSources<number>(async (managers) => {
				return (await managers.getBlock(startBlockNumber)).timestamp;
			});
		}

		return this._startKey;
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
