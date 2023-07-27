import axios from 'axios';

export interface KyvePoolData {
	id: string;
	config: string;
	currentKey: number;
	uploadInterval: number;
	maxBundleSize: number;
}

export class KyvePool {
	constructor(
		private readonly kyveUrl: string,
		private readonly poolId: string
	) {
		//
	}

	public async getData() {
		const { data: response } = await axios.get(
			`${this.kyveUrl}/kyve/query/v1beta1/pool/${this.poolId}`
		);

		return {
			id: response.pool.id,
			config: response.pool.data.config,
			currentKey: parseInt(response.pool.data.current_key, 10),
			uploadInterval: parseInt(response.pool.data.upload_interval, 10),
			maxBundleSize: parseInt(response.pool.data.max_bundle_size, 10),
		} as KyvePoolData;
	}
}
