import { fetchPipelines } from '@/utils/fetchPipelines';
import { pipelineContractAddress } from '@/utils/constants';

import type { Node } from '../node';

export async function setupPipelines(this: Node): Promise<void> {
	// STEP 1: Fetch pipelines configuration from contracts
	const pipelines = await fetchPipelines(
		pipelineContractAddress[this.connections.polygon.chainId],
		this.connections.polygon.provider
	);
	for (let i = 0; i < pipelines.length; i += 1) {
		// STEP 2: load JS contracts referenced by pipelines
		// STEP 3: determine which pipelines are valid and should be included in ETL process
		// ...
	}

	this.pipelines = pipelines;
	await this.resetListener();
}
