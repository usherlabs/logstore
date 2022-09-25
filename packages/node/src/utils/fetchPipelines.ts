import { ethers } from 'ethers';
import PipelineContract from '@etl-network/contracts/artifacts/contracts/PipelineContract.sol/PipelineContract.json';
import { parseStruct, range } from '@/utils/helpers';
import { Pipeline } from '@/types';
// import { DUMMY_PIPELINE_DATA } from '../utils/dummy';

export async function fetchPipelineSource(
	contract: ethers.Contract,
	pipelineIdentifier: string,
	sourceIndex: number
) {
	const sourceDetails = await contract.functions.getSingleSourceFromPipeline(
		pipelineIdentifier,
		sourceIndex
	);
	return sourceDetails;
}

export async function fetchPipelineDetails(
	contract: ethers.Contract,
	pipelineIdentifier: string
) {
	const pipelineDetails = await contract.functions.pipelines(
		pipelineIdentifier
	);
	const parsedPipelineDetails = parseStruct(pipelineDetails);
	// get sources count and use that to get all the sources details by index
	const { sourcesCount } = parsedPipelineDetails;
	const allSources = await Promise.all(
		range(+sourcesCount).map(async (sourceIndex) => {
			const oneSource = await fetchPipelineSource(
				contract,
				pipelineIdentifier,
				sourceIndex
			);
			return oneSource;
		})
	);
	return { ...parsedPipelineDetails, sources: allSources };
}

/**
 * Each pipeline has a unique identifier of 32bytes, we need to get all the identifiers for the next stage
 * @dev this function might need refactoring later to get the id's one at a time rather than at once
 * @param contract {ethers.Contract} a contract object representing the pipeline contract deployed
 * @returns
 */
export async function getAllPipelineIds(contract) {
	const [allIds] = await contract.functions.getAllPipelineKeys();
	return allIds;
}

/**
 * Gets the several pipeline configurations present in the smart contract which collects them
 *
 * @method fetchPipelines
 * @returns {Promise<Pipeline[]>}
 */
export async function fetchPipelines(
	contractAddress: string,
	provider: ethers.providers.JsonRpcProvider
): Promise<Pipeline[]> {
	const contract = new ethers.Contract(
		contractAddress,
		PipelineContract.abi,
		provider
	);
	const allPipelineIdentifiers = await getAllPipelineIds(contract);

	// for each pipeline id, get the corresponding pipeline
	const allPipelines = await Promise.all(
		allPipelineIdentifiers.map(async (oneIdentifier) => {
			const pipelineDetails = await fetchPipelineDetails(
				contract,
				oneIdentifier
			);
			return pipelineDetails;
		})
	);

	// return the data as gotten from the smart contract
	return allPipelines;
	// return DUMMY_PIPELINE_DATA;
}
