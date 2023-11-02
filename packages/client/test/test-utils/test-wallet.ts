/*
 * These private keys are for wallets that contains arbitrary amount of ETH and arbitrary amount of LSAN.
 */

export const getRandomTestPrivateKey = () => {
	const n = Math.floor(Math.random() * 100) + 1;
	return getTestPrivateKey(n);
};

const getTestPrivateKey = (n: number): string => {
	if (n < 1 || n > 100) {
		throw new Error('n must be between 1 and 100');
	}

	// 0000000000000000000000000000000000000000000000000000000000000033
	const len = 64 - n.toString().length;
	const padding = '0'.repeat(len);

	return padding + n.toString();
};
