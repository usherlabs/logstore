import { LSAN__factory } from '@concertotech/logstore-contracts';
import ContractAddresses from '@concertotech/logstore-contracts/address.json';
import { Provider } from '@ethersproject/providers';
import { Contract, ethers } from 'ethers';
import redstone from 'redstone-api';

export class StakeToken {
	public price: number;
	public tokenContract: Contract;
	constructor(
		public address: string,
		public symbol: string,
		public decimals: number,
		public minRequirement: number,
		public provider: Provider
	) {}

	public async init() {
		this.tokenContract = LSAN__factory.connect(this.address, this.provider);
		this.price = await this.getPrice();
	}

	public async getPrice() {
		// check if the address is that of LSAN
		const { chainId } = await this.provider.getNetwork();
		const lsanTokenAddress = ContractAddresses[chainId].tokenManagerAddress;

		if (this.address === lsanTokenAddress) {
			const lsanPricePerMatic =
				await this.tokenContract.functions.getTokenPrice();
			const { value: maticPrice } = await redstone.getPrice('MATIC', {
				verifySignature: true,
			});
			const response = +lsanPricePerMatic * maticPrice;
			return response;
		} else {
			const resp = await redstone.getPrice(this.symbol, {
				verifySignature: true,
			});
			return resp.value;
		}
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
