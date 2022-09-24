import { Node as KyveNode } from '@kyve/core';
import { ethers } from 'ethers';
import { IRuntime, ICache, Pipeline, IStorageProvider } from '@/types';
import {
	polygonRpc,
	ethereumRpc,
	polygonChainId,
	ethereumChainId,
	polygonMumbaiChainId,
	polygonMumbaiRpc
} from './env-config';
import { cmd } from './cmd';
import { runCache } from './methods/runCache';
import { runListener } from './methods/runListener';
import { proposeBundle } from './methods/proposeBundle';
import { validateBundleProposal } from './methods/validateBundleProposal';
import { voteTransactions } from './methods/voteTransactions';
import { createTransactions } from './methods/createTransactions';
import { approveTransactions } from './methods/approveTransactions';

type EVMConnection = {
	chainId: string;
	rpc: string;
	provider: ethers.providers.JsonRpcProvider;
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

	/**
	 * Defines node options for CLI and initializes those inputs
	 * Node name is generated here depending on inputs
	 *
	 * @method constructor
	 */
	constructor() {
		super();

		// define extended program
		const options = cmd.parse().opts();
		this.evmPrivateKey = options.evmPrivateKey;

		const connections = {
			signer: new ethers.Wallet(this.evmPrivateKey),
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
			mumbai: {
				chainId: polygonMumbaiChainId,
				rpc: polygonMumbaiRpc,
				provider: null
			}
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
		if (polygonMumbaiChainId && polygonMumbaiRpc) {
			connections.mumbai.provider = new ethers.providers.JsonRpcProvider(
				polygonRpc,
				+polygonChainId
			);
		}

		this.connections = connections;
	}

	/**
	 * Process to run the Cache and handle Storage
	 */
	protected runCache = runCache;

	/**
	 * Process to run the Listener
	 */
	protected runListener = runListener;

	/**
	 * Extending Validate Bundle Proposal -- to include Transactions Validation
	 *
	 * @var {[type]}
	 */
	protected validateBundleProposal = validateBundleProposal;

	/**
	 * Extending Propose Bundle -- to include Transactions Submission/Proposal
	 *
	 * @var {[type]}
	 */
	protected proposeBundle = proposeBundle;

	protected voteTransactions = voteTransactions;

	protected createTransactions = createTransactions;

	protected approveTransactions = approveTransactions;

	/**
	 * Main method of ETL Node.
	 *
	 * This method will run indefinetely and only exits on specific exit conditions like running
	 * an incorrect runtime or version.
	 *
	 * @method start
	 * @return {Promise<void>}
	 */
	public async start(): Promise<void> {
		try {
			this.runListener();
		} catch (error) {
			this.logger.error(`Unexpected runtime error. Exiting ...`);
			this.logger.debug(error);

			process.exit(1);
		}

		this.start();
	}
}
