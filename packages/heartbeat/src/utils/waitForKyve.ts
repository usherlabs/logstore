import { KyvePool } from '../KyvePool';

const SLEEP = 5; // seconds

export const waitForKyve = async (apiUrl: string, poolId: string) => {
	const kyvePool = new KyvePool(apiUrl, poolId);
	let totalBundles = await kyvePool.getTotalBundles();

	while (!totalBundles) {
		console.log(
			`Pool TotalBundles is ${totalBundles}. Waiting for ${SLEEP}s to retry...`
		);
		await new Promise((resolve) => setTimeout(resolve, SLEEP * 1000));
		totalBundles = await kyvePool.getTotalBundles();
	}
};
