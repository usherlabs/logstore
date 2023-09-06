import { EthereumAddress, Logger } from '@streamr/utils';

const logger = new Logger(module);

export class MessageMetrics {
	private readonly seqNums: Map<EthereumAddress | '', number>;
	private bytes: number = 0;
	private count: number = 0;
	private lost: number = 0;

	constructor(private readonly subject: string) {
		this.seqNums = new Map<EthereumAddress, number>();
	}

	public update(
		publisherId: EthereumAddress | '',
		seqNum: number,
		bytes: number
	) {
		this.bytes += bytes;
		this.count++;
		const prevSeqNum = this.seqNums.get(publisherId);
		if (prevSeqNum) {
			const diff = seqNum - prevSeqNum;
			if (diff > 1) {
				this.lost += diff - 1;

				logger.error(
					`Unexpected ${this.subject} seqNum ${JSON.stringify({
						publisherId,
						prev: prevSeqNum,
						curr: seqNum,
						lost: diff,
					})}`
				);
			}
		}

		this.seqNums.set(publisherId, seqNum);
	}

	public get summary() {
		return {
			subject: this.subject,
			bytes: this.bytes,
			count: this.count,
			lost: this.lost,
		};
	}
}
