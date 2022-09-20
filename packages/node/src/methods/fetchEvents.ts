import { ethers } from "ethers";
import { PoolConfig, SupporedSourcesChains } from "../types";
import { fetchABIJSONFromURL, getDefaultProvider, parseBlockEvent } from "../utils/helpers";


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
			console.log(`This event source:${sourcename} is not supported`);
			return;
		}

		switch (sourcename) {
			case "ethereum":
				sourceData = fetchEVMEvents(
					sourceConfig,
					key,
					sourceAddress,
					sourceABIURL,
					sourceEvent,
					"1"
				);
				break;
			
			case "polygon":
				sourceData = fetchEVMEvents(
					sourceConfig,
					key,
					sourceAddress,
					sourceABIURL,
					sourceEvent,
					"137"
				);
				break;
		}

		return sourceData;
	});
	const response = await Promise.all(responsePromise);
	console.log(response);
}

const fetchEVMEvents = async (
	config: any,
	key: string,
	contractAddress: string,
	contractABIURL: any,
	eventname: string,
	chainId: SupporedSourcesChains
) => {
	const { startBlock: initialBlock, interval, rpc } = config;
	const startBlock = 15574440; //+key * interval + initialBlock;
	const endBlock = 15574540; //(+key + 1) * interval + initialBlock;

	// initialise contracct
	const contractABIJSON = await fetchABIJSONFromURL(contractABIURL);
	const provider = getDefaultProvider(1);
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
	streamAddress: string,
	key: string
) => {
	const { startTimestamp: initialTimestamp, interval } = config;
	const startTime = +key * interval + initialTimestamp;
	const endTime = (+key + 1) * interval + initialTimestamp;
	// const streamr = new StreamrClient();
	// const sub3 = await streamr.resend(streamAddress, {
	// 	from: {
	// 		timestamp: startTime
	// 	},
	// 	to: {
	// 		timestamp: endTime
	// 	}
	// });

	// console.log(sub3);
};
