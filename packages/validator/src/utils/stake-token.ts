import { ethers } from 'ethers';
import redstone from 'redstone-api';

export class StakeToken {
	public price: number;

	constructor(
		public address: string,
		public symbol: string,
		public decimals: number,
		public minRequirement: number
	) {}

	public async init() {
		this.price = await this.getPrice();
	}

	public async getPrice() {
		const resp = await redstone.getPrice(this.symbol, {
			verifySignature: true,
		});
		return resp.value;
	}

	public fromUSD(usdValue: number) {
		if (!this.price) {
			throw new Error('Price has not been initiated');
		}
		return Math.floor(
			parseInt(
				ethers
					.parseUnits(
						// reduce precision to max allowed to prevent errors
						`${(usdValue / this.price).toPrecision(15)}`,
						this.decimals
					)
					.toString(10), // radix 10
				10
			)
		);
	}
}
