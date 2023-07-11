import ArweaveClient from '@logsn/arweave';
import redstone from 'redstone-api';

export class Arweave {
	private static _arweaveClient;

	private static get arweaveClient(): ArweaveClient {
		if (!this._arweaveClient) {
			this._arweaveClient = new ArweaveClient({
				host: 'arweave.net',
				protocol: 'https',
			});
		}
		return this._arweaveClient;
	}

	public static async getPrice(
		byteSize: number,
		timestamp: number
	): Promise<number> {
		const atomicPriceInWinston = await this.arweaveClient.transactions.getPrice(
			byteSize
		);
		const priceInAr = this.arweaveClient.ar.winstonToAr(atomicPriceInWinston);
		const arPrice = await redstone.getHistoricalPrice('AR', {
			date: timestamp,
		});
		return parseFloat(priceInAr) * arPrice.value;
	}
}
