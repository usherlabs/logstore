import 'dotenv/config';

import { ethers } from 'ethers';
import PipelineContract from '@etl-network/contracts/artifacts/contracts/PipelineContract.sol/PipelineContract.json';

const provider = new ethers.providers.JsonRpcProvider(
	'https://polygontestapi.terminet.io/rpc',
	80001
);
const signer = new ethers.Wallet(process.env.EVM_PRIVATE_KEY, provider);

(async () => {
	const contract = new ethers.Contract(
		`0xDA50a7A41e5ac1d9d49A56A2647123Ed65F3e4B7`,
		PipelineContract.abi,
		signer
	);

	const pipelineId =
		'0xcae106a3ab4e98745795594cf3cdf4e1a211114df6b06775742289693f4950ed';

	await contract.functions.addSourceToPipeline(
		pipelineId,
		0,
		'0x46bC3bbD03431fE5E76fdc733a301Bc173B8E591',
		'Increment(address, uint256, uint256)',
		''
	);
	console.log('ethereum source created..');
	await contract.functions.addSourceToPipeline(
		pipelineId,
		2,
		'ryanwould.eth/usher',
		'',
		''
	);
	console.log('streamr source created..');
})();
