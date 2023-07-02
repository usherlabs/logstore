import { LSAN__factory } from '@logsn/contracts';
import { getTokenPrice } from '@logsn/shared';
import { BigNumber, Contract, ethers, Signer } from 'ethers';

export class StakeToken {
	// public price: number;
	public tokenContract: Contract;
	constructor(
		public address: string,
		public symbol: string,
		public decimals: number,
		public minRequirement: BigNumber,
		public signer: Signer
	) {}

	public async init() {
		this.tokenContract = LSAN__factory.connect(this.address, this.signer);
	}

	public async getPrice(timestamp: number) {
		const tokenPrice = await getTokenPrice(
			this.address,
			timestamp,
			this.signer
		);
		return tokenPrice;
	}

	public async fromUSD(
		usdValue: number,
		timestamp: number
	): Promise<BigNumber> {
		// Price is of stake token in USD
		const price = await this.getPrice(timestamp);

		return ethers.utils.parseUnits(
			// reduce precision to max allowed to prevent errors
			`${(usdValue / price).toPrecision(15)}`,
			this.decimals
		);
	}
}
