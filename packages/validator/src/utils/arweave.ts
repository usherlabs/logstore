import ArweaveClient from 'arweave';
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

	public static async getFee(storageId: string) {
		const tx = await this.arweaveClient.transactions.get(storageId);
		const arPrice = await redstone.getPrice('AR');
		const arFee = this.arweaveClient.ar.winstonToAr(tx.reward);
		return parseFloat(arFee) * arPrice.value;
	}
}
