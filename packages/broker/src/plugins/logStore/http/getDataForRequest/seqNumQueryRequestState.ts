const createSeqNum = () => {
	let seqNum = 0;
	return {
		getAndIncrement: () => seqNum++,
		get: () => seqNum,
		reset: () => {
			seqNum = 0;
		},
	};
};
export const seqNumQueryRequest = createSeqNum();
