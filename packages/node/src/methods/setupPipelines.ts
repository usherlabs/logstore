import axios from 'axios';
import { NodeVM } from 'vm2';

import { fetchPipelines } from '@/utils/fetchPipelines';
import { pipelineContractAddress } from '@/utils/constants';
import { ICacheIsolate, Pipeline } from '@/types';

import type { Node } from '../node';

const vm = new NodeVM({
	console: 'off',
	sandbox: {},
	require: false,
});

export async function setupPipelines(this: Node): Promise<void> {
	// STEP 1: Fetch pipelines configuration from contracts
	const pipelines = await fetchPipelines(
		pipelineContractAddress[this.connections.polygon.chainId],
		this.connections.polygon.provider
	);
	this.logger.debug('pipelines fetched', pipelines);

	const usedPipelines: Pipeline[] = [];
	for (let i = 0; i < pipelines.length; i += 1) {
		const pipeline = pipelines[i];
		let contractData;
		// STEP 2: load JS contracts referenced by pipelines
		if (pipeline.contract.startsWith('ipfs://')) {
			const path = pipeline.contract.substring('ipfs://'.length);
			// TODO: Replace request from http public gateway with an in-process IPFS node for better decentralisation... or allow for HTTP gateway to be provided.
			const { data } = await axios.get(`https://ipfs.io/ipfs/${path}`, {
				responseType: 'arraybuffer',
			});
			this.logger.debug(`JS Contract fetch Body: `, data);
			contractData = data;
		}

		// STEP 3: determine which pipelines are valid and should be included in ETL process
		if (contractData) {
			const fn = vm.run(contractData);
			const transformer = async (events: ICacheIsolate) => {
				try {
					this.logger.info(`Running transformer for pipeline ${pipeline.id}`);
					const out = await fn(events);
					// TODO: Do some checks on output, and secure the vm further -- https://github.com/patriksimek/vm2#nodevm
					this.logger.info(`Completed transformer for pipeline ${pipeline.id}`);
					this.logger.debug(`Transformer output: `, out);
					if (typeof out === 'object') {
						return {
							response: out.response,
							submit: out.submit,
						};
					}
				} catch (e) {
					this.logger.warn(
						`An error occured for executing transformer for pipeline ${pipeline.id}`
					);
				}
				return {};
			};
			usedPipelines.push({ ...pipeline, transformer });
		}
	}

	this.logger.debug('pipelines used', pipelines);

	this.pipelines = usedPipelines;
	await this.resetListener();
}
