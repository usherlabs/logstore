import { ethers } from 'ethers';

// const provider = new ethers.providers.JsonRpcProvider(
// 	'https://eth-mainnet.g.alchemy.com/v2/Vr62QipjNeuLST97u1AKQAeDWxUJ2zKl',
// 	1
// );

console.log('Listen to swap events on Uniswap DAI/USDC Pool');
const sel = `Swap(address, address, int256, int256, uint160, uint128, int24)`
	.split(' ')
	.join('');
// provider.on(
// 	{
// 		address: '0x5777d92f208679db4b9778590fa3cab3ac9e2168', // DAI / USDC on Uniswap
// 		topics: [ethers.utils.id(sel)],
// 	},
// 	(event) => {
// 		console.log(event);
// 	}
// );

const event = {
	blockNumber: 15608630,
	blockHash:
		'0x908bd82d698eebde7fe1f5a4425d12cfd79d3e89f493743e828f87eb24932eea',
	transactionIndex: 38,
	removed: false,
	address: '0x5777d92f208679DB4b9778590Fa3CAB3aC9e2168',
	data: '0x00000000000000000000000000000000000000000000003206340873544e526cffffffffffffffffffffffffffffffffffffffffffffffffffffffffc9009cd10000000000000000000000000000000000000000000010c70074f4ec594496dc00000000000000000000000000000000000000000003660013631e7835def7cdfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffbc89c',
	topics: [
		'0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67',
		'0x00000000000000000000000068b3465833fb72a70ecdf485e0e4c7bd8665fc45',
		'0x00000000000000000000000068b3465833fb72a70ecdf485e0e4c7bd8665fc45',
	],
	transactionHash:
		'0xbfff03c8a4ce6ad7efd0ae96984f8a871c6422909ad4bc363413f12fe97a0229',
	logIndex: 70,
};

const paramtypes = sel
	.substring(sel.indexOf('(') + 1, sel.lastIndexOf(')'))
	.split(',');
console.log(paramtypes);

const abiCoder = ethers.utils.defaultAbiCoder;
const decoded = abiCoder.decode(
	['address', 'address', 'int256', 'int256', 'uint160'],
	event.data
);
console.log(require('util').inspect(decoded, false, null, true));
