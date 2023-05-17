import ArweaveClient from 'arweave';
import redstone from 'redstone-api';

export class Arweave {
	private static _arweaveClient;
	// private static _arweaveClientBackup;

	private static get arweaveClient(): ArweaveClient {
		if (!this._arweaveClient) {
			this._arweaveClient = new ArweaveClient({
				host: 'arweave.net',
				protocol: 'https',
			});
		}
		return this._arweaveClient;
	}

	public static async getPrice(byteSize: number) {
		const atomicPriceInWinston = await this.arweaveClient.transactions.getPrice(
			byteSize
		);
		const priceInAr = this.arweaveClient.ar.winstonToAr(atomicPriceInWinston);
		const arPrice = await redstone.getPrice('AR');
		return parseFloat(priceInAr) * arPrice.value;
	}
}
