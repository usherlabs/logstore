import { ethers } from 'ethers';
import EventSource from 'eventsource';
import { Logger } from 'tslog';

const logger = new Logger();

// define default event handlers
const onopen = () => logger.info('======== query connection open =========');
const onerror = (err: MessageEvent<string>) => {
	throw new Error(JSON.stringify(err));
};
const onmessage = (payload: Record<string, string>) => logger.info(payload);
// define default event handlers


export const queryBroker = async (
	brokerQueryURL: string,
	signer: ethers.Wallet,
	{
		fromTimestamp = 0,
		toTimestamp = +new Date(),
		onMessage = onmessage,
		onOpen = onopen,
		onError = onerror,
	}
) => {
	// encode parameters and create header
	const username = signer.address;
	const password = await signer.signMessage(username);
	const stringToEncode = `${username}:${password}`;
	const headers = {
		headers: {
			Authorization: `Basic ${Buffer.from(stringToEncode).toString('base64')}`,
		},
	};

	const eventSource = new EventSource(
		`${brokerQueryURL}?from=${fromTimestamp}&to=${toTimestamp}`,
		headers
	);

	// define the event listeners
	eventSource.onmessage = (event) => {
		const parsedData = JSON.parse(event.data);
		onMessage(parsedData);
	};
	eventSource.onopen = onOpen;
	eventSource.onerror = onError;
	// define the event listeners
};
