import { ethers } from 'ethers';
import { Pipeline } from '../types';
import PipelineContract from '@etl-network/contracts/artifacts/contracts/PipelineContract.sol/PipelineContract.json';
import { DUMMY_PIPELINE_DATA } from '../utils/dummy';
import { parseStruct, range } from '@/utils/helpers';

/**
 * Gets the several pipeline configurations present in the smart contract which collects them
 *
 * @method fetchPipelines
 * @returns {Promise<Pipeline[]>}
 */
export async function fetchPipelines(): Promise<Pipeline[]> {
	console.log(this);
	const contract = _loadPipelineContract();
	const allPipelineIdentifiers = await _getAllPipelineIds(contract);

	// for each pipeline id, get the corresponding pipeline
	const allPipelines = await Promise.all(
		allPipelineIdentifiers.map(async (oneIdentifier) => {
			const pipelineDetails = await _fetchPipelineDetails(
				contract,
				oneIdentifier
			);
			return pipelineDetails;
		})
	);

	// return the data as gotten from the smart contract
	// return allPipelines
	return DUMMY_PIPELINE_DATA;
}

async function _fetchPipelineDetails(contract: any, pipelineIdentifier:string) {
	const pipelineDetails = await contract.functions.pipelines(
		pipelineIdentifier
	);
	const parsedPipelineDetails = parseStruct(pipelineDetails);
	// get sources count and use that to get all the sources details by index
	const { sourcesCount } = parsedPipelineDetails;
	const allSources = await Promise.all(
		range(+sourcesCount).map(async (sourceIndex) => {
			const oneSource = await _fetchPipelineSource(
				contract,
				pipelineIdentifier,
				sourceIndex
			);
			return oneSource;
		})
	);
	return { ...parsedPipelineDetails, sources: allSources };
}

async function _fetchPipelineSource(
	contract: any,
	pipelineIdentifier: string,
	sourceIndex: number
) {
	const sourceDetails = await contract.functions.getSingleSourceFromPipeline(
		pipelineIdentifier,
		sourceIndex
	);
	return sourceDetails;
}

/**
 * Each pipeline has a unique identifier of 32bytes, we need to get all the identifiers for the next stage
 * @dev this function might need refactoring later to get the id's one at a time rather than at once
 * @param contract {ethers.Contract} a contract object representing the pipeline contract deployed
 * @returns
 */
async function _getAllPipelineIds(contract) {
	const [allIds] = await contract.functions.getAllPipelineKeys();
	return allIds;
}

function _loadPipelineContract() {
	const chainId = process.env.PIPELINE_CONTRACT_NETWORK_CHAIN_ID;
	const contractAddress = process.env.PIPELINE_CONTRACT_ADDRESS;

	// TODO refactor use a global provider or provider details based on chain id rather than hardcoding RPC details
	const getProvider = () => {
		// return new ethers.providers.getDefaultProvider(matic);
		const provider = new ethers.providers.JsonRpcProvider(
			'https://rpc-mumbai.maticvigil.com'
		);

		return provider;
	};
	const provider = getProvider();
	// TODO refactor use a global provider or provider details based on chain id rather than hardcoding RPC details
	return new ethers.Contract(contractAddress, PipelineContract.abi, provider);
}
