import { Node as KyveNode } from '@kyve/core';
import { ethers } from 'ethers';
import {
	IRuntime,
	ICache,
	Pipeline,
	IStorageProvider,
	SupportedSources,
	SourceCache,
} from '@/types';
import {
	polygonRpc,
	ethereumRpc,
	polygonChainId,
	ethereumChainId,
	evmPrivateKey,
} from './env-config';
// import { cmd } from './cmd';
import { runCache } from './methods/runCache';
import { runListener } from './methods/runListener';
import { proposeBundle } from './methods/proposeBundle';
import { setupPipelines } from './methods/setupPipelines';

type EVMConnection = {
	chainId: string;
	rpc: string;
	provider: ethers.providers.JsonRpcProvider | null;
};

export class Node extends KyveNode {
	protected runtime!: IRuntime;

	protected cache!: ICache;

	protected storageProvider!: IStorageProvider;

	protected evmPrivateKey: string = '';

	protected connections: {
		signer: ethers.Wallet;
		eth: EVMConnection;
		polygon: EVMConnection;
	};

	protected pipelines: Pipeline[];

	protected sourceCache: SourceCache;

	protected resetListener: () => Promise<void>;

	/**
	 * Process to run the Cache and handle Storage
	 */
	protected runCache = runCache;

	/**
	 * Process to run the Listener
	 */
	protected runListener = runListener;

	/**
	 * Extending Propose Bundle -- to include Transactions Submission/Proposal
	 *
	 * @var {[type]}
	 */
	protected proposeBundle = proposeBundle;

	protected setupPipelines = setupPipelines;

	protected setupSourceCache = async () => {
		this.sourceCache = {
			polygon: await this.cache.source(SupportedSources.polygon),
			ethereum: await this.cache.source(SupportedSources.ethereum),
			streamr: await this.cache.source(SupportedSources.streamr),
		};
	};

	public getSourceCache(source: SupportedSources) {
		return this.sourceCache[source];
	}

	/**
	 * Main method of ETL Node.
	 *
	 * This method will run indefinetely and only exits on specific exit conditions like running
	 * an incorrect runtime or version.
	 *
	 * @method start
	 * @return {Promise<void>}
	 */
	public async listen(): Promise<void> {
		const connections = {
			// TODO: Find a way to manage evmPrivateKey via CLI
			signer: new ethers.Wallet(evmPrivateKey),
			eth: {
				chainId: ethereumChainId,
				rpc: ethereumRpc,
				provider: null,
			},
			polygon: {
				chainId: polygonChainId,
				rpc: polygonRpc,
				provider: null,
			},
		};
		if (ethereumChainId && ethereumRpc) {
			connections.eth.provider = new ethers.providers.JsonRpcProvider(
				ethereumRpc,
				+ethereumChainId
			);
		}
		if (polygonChainId && polygonRpc) {
			connections.polygon.provider = new ethers.providers.JsonRpcProvider(
				polygonRpc,
				+polygonChainId
			);
		}

		this.connections = connections;

		try {
			await this.setupSourceCache();

			this.resetListener = await this.runListener();
		} catch (error) {
			this.logger.error(`Unexpected runtime error. Exiting ...`);
			this.logger.debug(error);

			process.exit(1);
		}
	}
}
