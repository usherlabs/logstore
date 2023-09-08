import { QueryResponse } from '@logsn/protocol';
import { EthereumAddress, Logger } from '@streamr/utils';

const CONSENSUS_TIMEOUT = 30 * 1000; // 30 seconds

const logger = new Logger(module);

export type ConsensusResponse = {
	hash: string;
	signer: EthereumAddress;
	signature: string;
};

export class Consensus {
	private responses: Record<string, ConsensusResponse[]> = {};
	private promise: Promise<ConsensusResponse[]>;
	private resolve!: (value: ConsensusResponse[]) => void;
	private reject!: (reason: any) => void;
	private readonly threshold: number;

	constructor(
		private readonly requestId: string,
		private awaitingResponses: number
	) {
		this.threshold = Math.ceil(awaitingResponses / 2);

		this.promise = new Promise<ConsensusResponse[]>((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;
		});
	}

	public update(queryResponse: QueryResponse, publisherId: EthereumAddress) {
		if (!this.responses[queryResponse.hash]) {
			this.responses[queryResponse.hash] = [];
		}

		this.awaitingResponses--;
		this.responses[queryResponse.hash].push({
			hash: queryResponse.hash,
			signer: publisherId,
			signature: queryResponse.signature,
		});

		// check if consensus reached
		if (this.responses[queryResponse.hash].length >= this.threshold) {
			logger.trace(
				'Consensus reached: %s',
				JSON.stringify({ requestId: this.requestId })
			);
			this.resolve(this.responses[queryResponse.hash]);
			return;
		}

		// check if consensus cannot be reached
		const leadingResponses = Object.keys(this.responses)
			.map((key) => this.responses[key].length)
			.reduce((max, length) => Math.max(max, length), 0);

		if (leadingResponses + this.awaitingResponses < this.threshold) {
			logger.trace(
				'No consensus: %s',
				JSON.stringify({
					requestId: this.requestId,
					responses: this.responses,
				})
			);
			this.reject('No consensus');
			return;
		}
	}

	public async wait() {
		const timeout = setTimeout(() => {
			this.reject('Consensus timeout');
		}, CONSENSUS_TIMEOUT);

		try {
			return await this.promise;
		} finally {
			clearTimeout(timeout);
		}
	}
}
