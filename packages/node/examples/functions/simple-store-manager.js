module.exports = async (events) => {
	let ethKeys = [];
	let streamrKeys = [];
	const prevResponses = [];
	for await (const [key, value] of events.iterator()) {
		if (value.source === 'ethereum') {
			ethKeys.push(key);
		}
		if (value.source === 'streamr') {
			streamrKeys.push(key);
		}
		if (value.type === 'transform') {
			prevResponses.push(value);
		}
	}
	// Filter out already used keys
	ethKeys = ethKeys.filter(
		(key) => !prevResponses.find((resp) => resp.out.eth === key)
	);
	streamrKeys = streamrKeys.filter(
		(key) => !prevResponses.find((resp) => resp.out.streamr === key)
	);
	if (ethKeys.length > 0 && streamrKeys.length > 0) {
		return {
			response: {
				eth: ethKeys[0],
				steamr: streamrKeys[0],
			},
			submit: {
				// Increment simple storage for each pairing events
				ethereum: [
					{
						contract: '0x19dd63f6c853e987CcAB794152b74b11905275F4',
						method: 'store(uint256)',
						params: [1],
					},
				],
			},
		};
	}

	return {};
};
