import { getNodeManagerContract } from '@concertodao/logstore-shared';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import 'dotenv/config';

const BROKER_NODE_PRIVATE_KEY =
	'0xb1abdb742d3924a45b0a54f780f0f21b9d9283b231a0a0b35ce5e455fa5375e7' as const;

const { STREAMR_DOCKER_DEV_HOST = 'localhost' } = process.env;

(async () => {
	const provider = new JsonRpcProvider(
		`http://${STREAMR_DOCKER_DEV_HOST}:8546`
	);
	const signer = new Wallet(BROKER_NODE_PRIVATE_KEY, provider);
	const contract = await getNodeManagerContract(signer);
	const node = await contract.nodes(signer.address);
	console.log('NODE:', node);
})();
