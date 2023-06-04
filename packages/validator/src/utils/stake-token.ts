import { LSAN__factory } from '@concertotech/logstore-contracts';
import { getTokenPrice } from '@concertotech/logstore-shared';
import { Contract, ethers, Signer } from 'ethers';

export class StakeToken {
	public price: number;
	public tokenContract: Contract;
	constructor(
		public address: string,
		public symbol: string,
		public decimals: number,
		public minRequirement: number,
		public signer: Signer
	) {}

	public async init() {
		this.tokenContract = LSAN__factory.connect(this.address, this.signer);
		this.price = await this.getPrice();
	}

	public async getPrice() {
		const tokenPrice = getTokenPrice(this.address, this.signer);
		return tokenPrice;
	}

	public fromUSD(usdValue: number) {
		if (!this.price) {
			throw new Error('Price has not been initiated');
		}
		return Math.floor(
			parseInt(
				ethers.utils
					.parseUnits(
						// reduce precision to max allowed to prevent errors
						`${(usdValue / this.price).toPrecision(15)}`,
						this.decimals
					)
					.toString(),
				10
			)
		);
	}
}
