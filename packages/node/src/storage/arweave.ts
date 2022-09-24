import ArweaveClient from 'arweave';
import { Arweave as KyveArweave } from '@kyve/core';

export class Arweave extends KyveArweave {
	protected _arweaveClient = new ArweaveClient({
		host: 'arweave.net',
		protocol: 'https',
	});

	async retrieveBundleMetadata(storageId: string) {
		const { status } = await this._arweaveClient.transactions.getStatus(
			storageId
		);

		if (status !== 200 && status !== 202) {
			throw Error(
				`Could not download bundle from Arweave. Status code = ${status}`
			);
		}

		const { tags } = await this._arweaveClient.transactions.get(storageId);

		return tags.map((tag) => [tag.name, tag.value]);
	}
}
