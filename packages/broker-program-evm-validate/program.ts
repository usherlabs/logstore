import { BrokerProgram } from '@logsn/broker-program';
import { ethers } from 'ethers';

export class Program extends BrokerProgram {
	private provider: ethers.JsonRpcProvider;

	constructor(rpcUrl: string) {
		super(rpcUrl);

		this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
	}

	public override async process(args: unknown): Promise<unknown> {
		const eventLog = this.validateArgs(args);

		const lookup = await this.lookupFromBlockchain(eventLog);

		if (!this.compare(eventLog, lookup)) {
			throw new Error('EventLogs do not match');
		}

		// Put transformation logic here if required

		return eventLog;
	}

	private validateArgs(args: unknown): ethers.Log {
		const eventLog = args as ethers.Log;

		if (!eventLog.blockHash) {
			throw new Error(
				'Mandatory property "blockHash" not found in the content'
			);
		}

		if (!eventLog.transactionHash) {
			throw new Error(
				'Mandatory property "transactionHash" not found in the content'
			);
		}

		return eventLog;
	}

	private async lookupFromBlockchain(
		eventLog: ethers.Log
	): Promise<ethers.Log> {
		const block = await this.provider.getBlock(eventLog.blockHash);
		if (!block) {
			throw new Error('Block not found');
		}

		const transaction = await block.getTransaction(eventLog.transactionHash);
		if (!transaction) {
			throw new Error('Transaction not found');
		}

		if (transaction.blockHash !== eventLog.blockHash) {
			throw new Error(
				'Transaction "blockHash" does not match provided "blockHash"'
			);
		}

		const eventLogs = (
			await this.provider.getLogs({
				blockHash: eventLog.blockHash,
				topics: [...eventLog.topics],
			})
		).filter((l) => l.index === eventLog.index);

		if (eventLogs.length === 0) {
			throw new Error('EventLog not found');
		}

		if (eventLogs.length !== 1) {
			throw new Error('Ambigous EventLogs found');
		}

		return eventLogs[0];
	}

	private compare(a: ethers.Log, b: ethers.Log) {
		return a.data === b.data;
	}
}
