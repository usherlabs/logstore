import {
	Bundle,
	sleep,
	sha256,
	ERROR_IDLE_TIME,
	bundleToBytes,
} from '@kyve/core';
import { getBundleInstructions } from '@/utils/bundleInstructions';
import type { Node } from '../node';

export async function proposeBundle(
	this: Node,
	createdAt: number
): Promise<void> {
	const fromHeight =
		+this.pool.bundle_proposal!.to_height || +this.pool.data!.current_height;
	const toHeight = +this.pool.data!.max_bundle_size + fromHeight;
	const fromKey =
		this.pool.bundle_proposal!.to_key || this.pool.data!.current_key;

	let storageId: string;
	let bundleProposal: Bundle;
	let bundleHash: string = '';
	let bundleCompressed: Buffer;
	let txHashes: string[];

	while (true) {
		await this.syncPoolState();

		if (+this.pool.bundle_proposal!.created_at > createdAt) {
			// check if new proposal is available in the meantime
			return;
		}
		if (this.shouldIdle()) {
			// check if pool got paused in the meantime
			return;
		}

		this.logger.debug(`Loading bundle from cache to create bundle proposal`);

		bundleProposal = await this.loadBundle(fromHeight, toHeight);

		if (!bundleProposal.bundle.length) {
			break;
		}

		const txSubmitInstructions = getBundleInstructions(bundleProposal);
		txHashes = await this.createTransactions(txSubmitInstructions);

		try {
			// upload bundle to Arweave
			this.logger.info(
				`Created bundle of length ${bundleProposal.bundle.length}`
			);
			this.logger.debug(
				`Compressing bundle with compression type ${this.compression.name}`
			);

			const bundleBytes = bundleToBytes(bundleProposal.bundle);

			bundleHash = sha256(bundleBytes);
			bundleCompressed = await this.compression.compress(bundleBytes);

			const tags: [string, string][] = [
				['Application', 'KYVE'],
				['Network', this.network],
				['Pool', this.poolId.toString()],
				['@kyve/core', this.coreVersion],
				[this.runtime.name, this.runtime.version],
				['Uploader', this.client.account.address],
				['FromHeight', fromHeight.toString()],
				['ToHeight', (fromHeight + bundleProposal.bundle.length).toString()],
				['Size', bundleProposal.bundle.length.toString()],
				['FromKey', fromKey],
				['ToKey', bundleProposal.toKey],
				['Value', bundleProposal.toValue],
			];
			txHashes.forEach((txHash, i) => {
				tags.push([`ETL-Network-Tx-${i}`, txHash]);
			});

			this.logger.debug(`Attempting to save bundle on storage provider`);

			storageId = await this.storageProvider.saveBundle(bundleCompressed, tags);
			this.prom.storage_provider_save_successful.inc();

			this.logger.info(
				`Saved bundle on ${this.storageProvider.name} with Storage Id "${storageId}"\n`
			);

			break;
		} catch (error) {
			this.logger.warn(
				` Failed to save bundle on ${this.storageProvider.name}. Retrying in 10s ...`
			);
			this.logger.debug(error);
			this.prom.storage_provider_save_failed.inc();

			await sleep(ERROR_IDLE_TIME);
		}
	}

	await this.syncPoolState();

	if (+this.pool.bundle_proposal!.created_at > createdAt) {
		// check if new proposal is available in the meantime
		return;
	}
	if (this.shouldIdle()) {
		// check if pool got paused in the meantime
		return;
	}

	if (storageId!) {
		await this.submitBundleProposal(
			storageId,
			bundleCompressed!.byteLength,
			fromHeight,
			fromHeight + bundleProposal.bundle.length,
			fromKey,
			bundleProposal.toKey,
			bundleProposal.toValue,
			bundleHash
		);
		await this.approveTransactions(txHashes);
	} else {
		this.logger.info(`Skipping uploader role because no data was found`);

		await this.skipUploaderRole(fromHeight);
	}
}
