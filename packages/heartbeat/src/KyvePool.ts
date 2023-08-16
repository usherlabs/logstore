export class KyvePool {
	constructor(
		private readonly apiUrl: string,
		private readonly poolId: string
	) {
		//
	}

	public async getTotalBundles() {
		const response = await fetch(
			`${this.apiUrl}/kyve/query/v1beta1/pool/${this.poolId}`
		);
		const pool = (await response.json()).pool;
		return parseInt(pool.data.total_bundles);
	}
}
