import { Node as KyveNode } from '@kyve/core';
import { ethers } from 'ethers';
import { IRuntime, ICache, Pipeline } from '@/types';
import {
	polygonRpc,
	ethereumRpc,
	polygonChainId,
	ethereumChainId,
} from './env-config';
import { cmd } from './cmd';
import { runCache } from './methods/runCache';
import { runListener } from './methods/runListener';
import { proposeBundle } from './methods/proposeBundle';
import { validateBundleProposal } from './methods/validateBundleProposal';
import { voteTransactions } from './methods/voteTransactions';
import { submitTransactions } from './methods/submitTransactions';

export class Node extends KyveNode {
	protected runtime!: IRuntime;

	protected cache!: ICache;

	protected evmPrivateKey: string = '';

	protected connections: {
		signer: ethers.Wallet;
		ethProvider: ethers.providers.JsonRpcProvider;
		polygonProvider: ethers.providers.JsonRpcProvider;
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
			ethProvider: null,
			polygonProvider: null,
		};
		if (ethereumChainId && ethereumRpc) {
			connections.ethProvider = new ethers.providers.JsonRpcProvider(
				ethereumRpc,
				+ethereumChainId
			);
		}
		if (polygonChainId && polygonRpc) {
			connections.polygonProvider = new ethers.providers.JsonRpcProvider(
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

	protected submitTransactions = submitTransactions;

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
