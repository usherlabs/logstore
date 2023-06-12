import { ethers } from 'ethers';

import { getWeiPerByte } from '../../utils/functions';

async function main() {
	console.log('Prints price of byte stored to Log Store\n');

	const weiPerByte = await getWeiPerByte();
	console.log(`MATIC: ${ethers.utils.formatEther(weiPerByte)}`);
	console.log(`MATIC (GWEI): ${weiPerByte}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
