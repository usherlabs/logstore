import { DUMMY_ETH_ABI } from './dummy';
import { SupporedSourcesChains } from '@/types';

/**
 * It recieves a url which points to the ABI of a contract
 * it then fetches the ABI and returns it
 *
 * @param url  {string} the url of the ABI of the contract
 * @returns {Object} the json representation of the abi
 */
export const fetchABIJSONFromURL = (url: string) => {
	// TODO: perform fetch operation to return an ABI
	return DUMMY_ETH_ABI;
};

/**
 * Parse an event block into a suitable format
 * @param eventLog an event log instance from ethers
 * @returns
 */
export const parseBlockEvent = (eventLog: any) => {
	let { blockNumber, event, args } = eventLog;
	// filter through the args to remove duplicates
	const parsedArgs = parseStruct(args)
	// filter through the args to remove duplicates
	return {
		parsedArgs,
		blockNumber,
		event,
	};
};

export const getChainName = (chainId: string | number) => {
	const res = Object.entries(SupporedSourcesChains).find(
		(entry) => entry[1] === chainId
	);
	return res[0] || '';
};

/**
 * A function used to return from 0 to count - 1
 * @param count {number} The uppoer limit of range we want to get
 * @returns {array} returns and array with ordered elements from 0 to count - 1
 */
export const range = (count: number | string) => [...new Array(+count).keys()];

/**
 * A function used to format a struct object gotten from the blockchain
 * @param struct {Array} a strut onject directly from the blockchain
 * @returns
 */
export const parseStruct = (struct: [] | {}) => {
	const initialArgs = { ...struct };
	const parsedArgs = Object.create({});
	Object.keys(initialArgs).forEach((key) => {
		if (+key || +key === 0) return; // if the index is a number, it means it is a duplicate key we dont need
		parsedArgs[key] = initialArgs[key].toString();
	});
	return parsedArgs;
};
