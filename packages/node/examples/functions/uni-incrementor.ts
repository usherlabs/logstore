type Events = {
	get: (key: string | number) => Promise<string>;
	iterator: () => AsyncGenerator<any, void, unknown>;
};

export default async (events: Events) => {
	let swapKeys = [];
	let streamrKeys = [];
	const prevResponses = [];
	for await (const [key, value] of events.iterator()) {
		if (
			value.source === 'ethereum' &&
			value.event.address === '0x5777d92f208679DB4b9778590Fa3CAB3aC9e2168'
		) {
			swapKeys.push(key);
		}
		if (value.source === 'streamr') {
			streamrKeys.push(key);
		}
		if (value.type === 'transform') {
			prevResponses.push(value);
		}
	}
	// Filter out already used keys
	swapKeys = swapKeys.filter(
		(key) => !prevResponses.find((resp) => resp.out.swap === key)
	);
	streamrKeys = streamrKeys.filter(
		(key) => !prevResponses.find((resp) => resp.out.streamr === key)
	);
	if (swapKeys.length > 0 && streamrKeys.length > 0) {
		return {
			response: {
				swap: swapKeys[0],
				steamr: streamrKeys[0],
			},
			submit: {
				// Increment simple storage for each pairing events
				ethereum: [
					{
						contract: '',
						method: '',
						params: [1],
					},
				],
			},
		};
	}

	return {};
};
