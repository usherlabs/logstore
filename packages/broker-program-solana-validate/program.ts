import { BrokerProgram } from '@logsn/broker-program';
import web3 from '@solana/web3.js';

interface Event {
	logStoreChannelId: string;
	blockNumber: number;
	signature: string;
}

export class Program extends BrokerProgram {
	private connection: web3.Connection;

	constructor(rpcUrl: string) {
		super(rpcUrl);

		this.connection = new web3.Connection(this.rpcUrl, 'confirmed');
	}

	public override async process(args: unknown): Promise<unknown> {
		const { blockNumber, signature } = args as Event;
		if (!blockNumber) {
			throw new Error(
				'Mandatory property "blockNumber" not found in the content'
			);
		}

		if (!signature) {
			throw new Error(
				'Mandatory property "signature" not found in the content'
			);
		}

		const block = await this.connection.getBlock(blockNumber, {
			maxSupportedTransactionVersion: 0,
		});
		if (!block) {
			throw new Error('Block not found');
		}

		if (
			!block.transactions.find((tx) =>
				tx.transaction.signatures.includes(signature)
			)
		) {
			throw new Error('Transaction not found');
		}

		return args;
	}
}
