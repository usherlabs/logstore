import { BundleTag, IStorageProvider } from '@kyvejs/protocol';
import ArweaveClient from '@logsn/arweave';
import { JWKInterface } from '@logsn/arweave/node/lib/wallet';
import axios from 'axios';
import { Base64 } from 'js-base64';

import { Slogger } from '../../utils/slogger';
import { GzipSplit } from '../compression/GzipSplit';

export class ArweaveSplit implements IStorageProvider {
	public name = 'ArweaveSplit';
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

	async saveBundle(compressedBundle: Buffer, tags: BundleTag[]) {
		const zips = GzipSplit.split(compressedBundle);

		const messagesUploadData = zips[0];
		const reportUploadData = zips[1];

		// Messages
		const msgTx = this.arweaveClient.createTransaction({
			data: messagesUploadData,
		});
		// Report
		const reportTx = this.arweaveClient.createTransaction({
			data: reportUploadData,
		});

		const txArr = [msgTx, reportTx];

		let eventsTx: typeof reportTx;
		if (zips.length > 2) {
			// Events
			const eventsUploadData = zips[2];
			eventsTx = this.arweaveClient.createTransaction({
				data: eventsUploadData,
			});
			txArr.push(eventsTx);
		}

		const transactions = await Promise.all(txArr);

		// Add tags to transaction before signing
		for (const tag of tags) {
			transactions.forEach((tx) => {
				tx.addTag(tag.name, tag.value);
			});
		}

		// Sign transaction
		await Promise.all(
			transactions.map((tx) => {
				return this.arweaveClient.transactions.sign(tx, this.arweaveKeyfile);
			})
		);

		const balance = await this.getBalance();
		let totalReward = 0;
		transactions.forEach((tx) => {
			totalReward += parseInt(tx.reward, 10);
		});

		if (totalReward > parseInt(balance)) {
			throw Error(
				`Not enough funds in Arweave wallet. Found = ${balance} required = ${totalReward}`
			);
		}

		// Transaction Ids are empty until they're signed.
		const transactionIds = transactions.map((tx) => tx.id);

		// ? The prefix is meant to provide context to the storageId.
		// ? ie. for Now, we're using this Version 0 of this storage identifier protocol
		// TODO: Move this storage id protocol into `protocol` package to standardise.
		const prefix = `v0_`;
		const storageId = prefix + Base64.encode(transactionIds.join(','), true);

		for (const tx of transactions) {
			await this.arweaveClient.transactions.post(tx);
			Slogger.instance.info(`Arweave Tx ${tx.id} submitted`);
		}

		return {
			storageId,
			storageData: GzipSplit.join(
				transactions.map((tx) => Buffer.from(tx.data))
			),
		};
	}

	async retrieveBundle(storageId: string, timeout: number) {
		const isTxSplit = storageId.startsWith('v0_');
		if (isTxSplit) {
			const encodedId = storageId.substring(3, storageId.length);
			const ids = Base64.decode(encodedId).split(',');
			const buffers: Buffer[] = [];
			for (const id of ids) {
				const { data } = await axios.get(`https://arweave.net/${id}`, {
					responseType: 'arraybuffer',
					timeout,
				});
				buffers.push(data);
			}
			const storageData = GzipSplit.join(buffers);
			return { storageId, storageData };
		}

		const { data: storageData } = await axios.get(
			`https://arweave.net/${storageId}`,
			{
				responseType: 'arraybuffer',
				timeout,
			}
		);

		return { storageId, storageData };
	}
}
