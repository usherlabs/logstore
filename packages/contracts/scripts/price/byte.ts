import { ethers } from 'ethers';

import { getMaticPerByte } from '../../utils/functions';

async function main() {
	console.log('Prints price of byte stored to Log Store\n');

	const maticPerByte = await getMaticPerByte();
	console.log(`MATIC: ${maticPerByte.toFixed(18)}`);
	console.log(
		`MATIC (GWEI): ${ethers.utils.parseEther(maticPerByte.toFixed(18))}`
	);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
