import { fetchPipelines } from '@/utils/fetchPipelines';
import { pipelineContractAddress } from '@/utils/constants';

import type { Node } from '../node';

export async function setupPipelines(this: Node): Promise<void> {
	// STEP 1: Fetch pipelines configuration from contracts
	this.pipelines = await fetchPipelines(
		pipelineContractAddress[this.connections.polygon.chainId],
		this.connections.polygon.provider
	);
	for (let i = 0; i < this.pipelines.length; i += 1) {
		// STEP 2: load JS contracts referenced by pipelines
		// STEP 3: determine which pipelines are valid and should be included in ETL process
		// ...
		// STEP 4: Modify listeners -- ie. add new Streamr Listeners, or modify the conditions/rules that yield events from the active Blockchain listeners
	}
}
