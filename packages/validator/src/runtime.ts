import { JsonRpcProvider } from '@ethersproject/providers';
import { DataItem, sha256 } from '@kyvejs/protocol';
import ContractAddresses from '@logsn/contracts/address.json';

import { Item } from './core/item';
import { Report } from './core/report';
import { appPackageName, appVersion } from './env-config';
import Listener from './listener';
import { Managers } from './managers';
import { IConfig, IRuntimeExtended } from './types';
import Validator from './validator';

export default class Runtime implements IRuntimeExtended {
	public name = appPackageName;
	public version = appVersion;
	public config: IConfig = {
		systemStreamId: '',
		sources: [],
		fees: {
			writeMultiplier: 1,
			treasuryMultiplier: 0.5, // Consumed from the Brokers by treasury for re-allocation to finance Validators
			read: 0.00000001, // value in USD
		},
	};
	public listener: Listener;
	private managers: Managers;

	async setupThreads(core: Validator, homeDir: string) {
		this.listener = new Listener(
			this.config.systemStreamId,
			homeDir,
			core.logger
		);

		// eslint-disable-next-line
		this.listener.start();
	}

	async validateSetConfig(rawConfig: string): Promise<void> {
		const config: IConfig = JSON.parse(rawConfig);

		if (!config.sources.length) {
			throw new Error(`Config does not have any sources`);
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

		this.managers = new Managers(config.sources[0]);
		await this.managers.init();

		this.config = {
			...this.config,
			...config,
			systemStreamId: `${systemContracts.nodeManagerAddress}/system`,
		};
	}

	// ? Producing data items here is include automatic management of local bundles, and proposed bundles.
	async getDataItem(core: Validator, key: string): Promise<DataItem> {
		const keyInt = parseInt(key, 10);

		if (keyInt > (await this.managers.getBlockTime())) {
			return null;
		}

		const item = new Item(core, this.listener, this.config, key);
		await item.prepare();
		const messages = await item.generate();

		return {
			key,
			value: { messages },
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
			Buffer.from(JSON.stringify(proposedDataItem.value.messages))
		);
		const validationDataItemHash = sha256(
			Buffer.from(JSON.stringify(validationDataItem.value.messages))
		);

		return proposedDataItemHash === validationDataItemHash;
	}

	async summarizeDataBundle(
		core: Validator,
		bundle: DataItem[]
	): Promise<string> {
		const lastItem = bundle.at(-1);
		core.logger.info(`Create Report: ${lastItem.key}`);
		const report = new Report(core, this.listener, this.config, lastItem.key);
		await report.prepare();
		lastItem.value.report = await report.generate();

		return lastItem.key;
	}

	// nextKey is called before getDataItem, therefore the dataItemCounter will be max_bundle_size when report is due.
	// https://github.com/KYVENetwork/kyvejs/blob/main/common/protocol/src/methods/main/runCache.ts#L147
	async nextKey(_: Validator, key: string): Promise<string> {
		let keyInt = parseInt(key, 10);

		if (!keyInt) {
			return (
				await this.managers.getBlock(
					await this.managers.node.getStartBlockNumber()
				)
			).timestamp.toString();
		}

		keyInt++;
		return keyInt.toString();
	}
}
