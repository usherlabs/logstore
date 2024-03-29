import { BundleTag, IStorageProvider } from '@kyvejs/protocol';
import ArweaveClient from '@logsn/arweave';
import { JWKInterface } from '@logsn/arweave/node/lib/wallet';
import axios from 'axios';

export class Arweave implements IStorageProvider {
	public name = 'Arweave';
	public decimals = 12;

	private readonly storagePriv: string;

	constructor(storagePriv: string) {
		this.storagePriv = storagePriv;
	}

	private get arweaveKeyfile(): JWKInterface {
		return JSON.parse(this.storagePriv);
	}

	private get arweaveClient(): ArweaveClient {
		return new ArweaveClient({
			host: 'arweave.net',
			protocol: 'https',
			defaultResponseTypes: {
				postTransaction: 'arraybuffer',
			},
		});
	}

	async getAddress() {
		return await this.arweaveClient.wallets.getAddress(this.arweaveKeyfile);
	}

	async getBalance() {
		const account = await this.getAddress();
		return await this.arweaveClient.wallets.getBalance(account);
	}

	async saveBundle(bundle: Buffer, tags: BundleTag[]) {
		const transaction = await this.arweaveClient.createTransaction({
			data: bundle,
		});

		for (const tag of tags) {
			transaction.addTag(tag.name, tag.value);
		}

		await this.arweaveClient.transactions.sign(
			transaction,
			this.arweaveKeyfile
		);

		const balance = await this.getBalance();

		if (parseInt(transaction.reward) > parseInt(balance)) {
			throw Error(
				`Not enough funds in Arweave wallet. Found = ${balance} required = ${transaction.reward}`
			);
		}

		await this.arweaveClient.transactions.post(transaction);

		return {
			storageId: transaction.id,
			storageData: Buffer.from(transaction.data),
		};
	}

	async retrieveBundle(storageId: string, timeout: number) {
		const { data: storageData } = await axios.get(
			`https://arweave.net/${storageId}`,
			{ responseType: 'arraybuffer', timeout }
		);

		return { storageId, storageData };
	}
}
