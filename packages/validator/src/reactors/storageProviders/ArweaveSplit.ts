import {
	BundleTag,
	bundleToBytes,
	bytesToBundle,
	IStorageProvider,
} from '@kyvejs/protocol';
import ArweaveClient from '@logsn/arweave';
import { JWKInterface } from '@logsn/arweave/node/lib/wallet';
import axios from 'axios';
import { Base64 } from 'js-base64';

import { gzip } from '../../utils/gzip';
import { Slogger } from '../../utils/slogger';

export class ArweaveSplit implements IStorageProvider {
	public name = 'LogStoreArweaveSplit';
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
		const bundleData = bytesToBundle(bundle);

		const lastItem = bundleData.at(-1);
		const report = lastItem.value.r;
		const events = lastItem.value.e;
		delete bundleData[bundleData.length - 1].value.r;
		delete bundleData[bundleData.length - 1].value.e;
		const messagesUploadData = await gzip(bundleToBytes(bundleData));
		const reportUploadData = await gzip(Buffer.from(JSON.stringify(report)));

		// if (tag.name === 'Content-Type') {
		// 	value = 'application/gzip';
		// }
		// const txTags = tags.filter((t) => t.name !== 'Content-Type');
		const txTags = tags.map((t) => {
			if (t.name === 'Content-Type') {
				t.value = 'application/gzip';
			}
			return t;
		});

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
		if (events) {
			// Events
			const eventsUploadData = await gzip(Buffer.from(JSON.stringify(events)));
			eventsTx = this.arweaveClient.createTransaction({
				data: eventsUploadData,
			});
			txArr.push(eventsTx);
		}

		const transactions = await Promise.all(txArr);

		// ? The prefix is meant to provide context to the storageId.
		// ? ie. for Now, we're using this Version 0 of this storage identifier protocol
		const prefix = `v0:`;
		const storageId =
			prefix + Base64.encode(transactions.map((tx) => tx.id).join(','), true);

		for (const tag of txTags) {
			transactions.forEach((tx) => {
				tx.addTag(tag.name, tag.value);
			});
		}

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

		for (const tx of transactions) {
			await this.arweaveClient.transactions.post(tx);
			Slogger.instance.info(`Arweave Tx ${tx.id} submitted`);
		}

		return {
			storageId,
			storageData: Buffer.concat(
				transactions.map((tx) => Buffer.from(tx.data))
			),
		};
	}

	async retrieveBundle(storageId: string, timeout: number) {
		const ids = Base64.decode(storageId).split(',');
		const buffers: Buffer[] = [];
		for (const id of ids) {
			const { data } = await axios.get(`https://arweave.net/${id}`, {
				responseType: 'arraybuffer',
				timeout,
			});
			buffers.push(data);
		}
		const storageData = Buffer.concat(buffers);

		return { storageId, storageData };
	}
}
