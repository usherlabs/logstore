import { getTokenPrice } from '@logsn/shared';
import { BigNumber, ethers } from 'ethers';

import { ChainSources } from '../sources';

export class StakeToken {
	// public price: number;
	constructor(
		public address: string,
		public symbol: string,
		public decimals: number,
		public minRequirement: BigNumber,
		public chain: ChainSources
	) {}

	public async getPrice(
		timestamp: number,
		provider?: ethers.providers.Provider
	) {
		if (provider) {
			return getTokenPrice(this.address, timestamp, provider);
		}
		const tokenPrice = await this.chain.use((source) => {
			return getTokenPrice(this.address, timestamp, source.provider);
		});
		return tokenPrice;
	}

	public async fromUSD(
		usdValue: number,
		timestamp: number
	): Promise<BigNumber> {
		// Price is of stake token in USD
		const price = await this.chain.use((source) => {
			return this.getPrice(timestamp, source.provider);
		});

		return ethers.utils.parseUnits(
			// reduce precision to max allowed to prevent errors
			`${(usdValue / price).toPrecision(15)}`,
			this.decimals
		);
	}
}
