import { Logger } from '@streamr/utils';
import axios from 'axios';

const logger = new Logger(module);

export interface PoolData {
	id: string;
	config: string;
	currentKey: number;
	uploadInterval: number;
	maxBundleSize: number;
	totalBundles: number;
}

export interface FinalizedBundle {
	id: number;
	storageId: string;
}

export class KyvePool {
	constructor(
		private readonly kyveUrl: string,
		private readonly poolId: string
	) {
		//
	}

	public async fetchPoolData() {
		logger.info(`Fetching the pool data`);

		const { data: response } = await axios.get(
			`${this.kyveUrl}/kyve/query/v1beta1/pool/${this.poolId}`
		);

		return {
			id: response.pool.id,
			config: response.pool.data.config,
			currentKey: parseInt(response.pool.data.current_key, 10),
			uploadInterval: parseInt(response.pool.data.upload_interval, 10),
			maxBundleSize: parseInt(response.pool.data.max_bundle_size, 10),
			totalBundles: parseInt(response.pool.data.total_bundles, 10),
		} as PoolData;
	}

	public async fetchFinalizedBundle(
		bundleId: number
	): Promise<FinalizedBundle> {
		logger.info(`Fetching the bundle with id:${bundleId}`);
		// fetch information about the bundle parameter passed in
		const { data: response } = await axios.get(
			`${this.kyveUrl}/kyve/query/v1beta1/finalized_bundle/${this.poolId}/${bundleId}`
		);

		return {
			id: parseInt(response.finalized_bundle.id, 10),
			storageId: response.finalized_bundle.storage_id,
		} as FinalizedBundle;
	}
}
