import { ethers } from 'ethers';
import StreamrClient from 'streamr-client';

import { PoolConfig, SupporedSourcesChains } from '@/types';
import {
	fetchABIJSONFromURL,
	getDefaultProvider,
	parseBlockEvent,
} from '@/utils/helpers';
import { logger } from '@/utils/logger';

const STREAM_TIMEOUT_DURATION = 3000; // if there are no new messages for the next 10 seconds then resolve
const MAINNET_CHAIN_ID = '1';
const POLYGON_CHAIN_ID = '137';

const fetchEVMEvents = async (
	config: any,
	key: string,
	contractAddress: string,
	contractABIURL: any,
	eventname: string,
	chainId: SupporedSourcesChains
) => {
	// TODO: remove hardcoded values
	const { startBlock: initialBlock, interval, rpc } = config;
	const startBlock = 15574440; // +key * interval + initialBlock;
	const endBlock = 15574540; // (+key + 1) * interval + initialBlock;

	// initialise contracct
	const contractABIJSON = await fetchABIJSONFromURL(contractABIURL);
	const provider = getDefaultProvider(chainId);
	const contract = new ethers.Contract(
		contractAddress,
		contractABIJSON,
		provider
	);

	// fetch events from contract
	const filter = contract.filters[eventname]();
	const events = await contract.queryFilter(filter, startBlock, endBlock);
	const parsedEvents = events.map(parseBlockEvent);
	return parsedEvents;
};

const fetchStreamrEvents = async (
	config: any,
	key: string,
	streamAddress: string
) => {
	const { startTimestamp: initialTimestamp, interval } = config;
	const startTime = +key * interval + initialTimestamp;
	const endTime = (+key + 1) * interval + initialTimestamp;
	const streamr = new StreamrClient();

	// ? Dev note: Returning an async function does not require a Promise() wrap
	return async (resolve, reject) => {
		let STREAM_TIMEOUT; // use variable for debouncing
		try {
			const streamResponse = [];
			await streamr.resend(
				streamAddress,
				{
					last: 10,
					// TODO disable hardcoding after proper testing
					// 	from: {
					// 		timestamp: startTime
					// 	},
					// 	to: {
					// 		timestamp: endTime
					// 	}
				},
				// use this callback to
				(singleMessage) => {
					// if there was a timeout, clear it.
					clearTimeout(STREAM_TIMEOUT);
					streamResponse.push(singleMessage);
					// use debouncing to return the array of there are no new items after a certain period
					// this would indicate that there are no new events
					STREAM_TIMEOUT = setTimeout(() => {
						resolve(streamResponse);
					}, STREAM_TIMEOUT_DURATION);
				}
			);

			// set a timeout to return an empty array if there are no streams
			// this gets canceled if the above callbacl is triggered
			STREAM_TIMEOUT = setTimeout(() => {
				console.log('There was no item in the stream, timing out...');
				resolve(streamResponse);
			}, STREAM_TIMEOUT_DURATION * 2);
		} catch (err) {
			reject(err);
			clearTimeout(STREAM_TIMEOUT);
		}
	};
};

/**
 * Fetches the onchain events from a data source passed in
 * @returns
 */
export async function fetchEventsFromSource(
	poolConfig: PoolConfig,
	sources: string[][],
	key: string
): Promise<any> {
	// loop through each source and get its corresponding data
	const responsePromise = sources.map(async (source: any[]) => {
		let sourceData;
		const [sourcename, sourceAddress, sourceABIURL, sourceEvent] = source;
		const sourceConfig = poolConfig.sources[sourcename];

		if (!sourceConfig) {
			logger.warn(`This event source:${sourcename} is not supported`);
			return sourceData;
		}

		switch (sourcename) {
			case 'ethereum':
				sourceData = fetchEVMEvents(
					sourceConfig,
					key,
					sourceAddress,
					sourceABIURL,
					sourceEvent,
					MAINNET_CHAIN_ID
				);
				break;

			case 'polygon':
				sourceData = fetchEVMEvents(
					sourceConfig,
					key,
					sourceAddress,
					sourceABIURL,
					sourceEvent,
					POLYGON_CHAIN_ID
				);
				break;

			case 'streamr':
				sourceData = fetchStreamrEvents(sourceConfig, key, sourceAddress);
				break;

			default:
				logger.warn(`Not sourcename defined`);
				break;
		}

		return sourceData;
	});
	const response = await Promise.all(responsePromise);

	// TODO return a response of format {datasource:data}
	logger.debug(response);
	return response;
}
