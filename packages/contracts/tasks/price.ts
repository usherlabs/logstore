import ArweaveClient from 'arweave';
import axios from 'axios';
import { task } from 'hardhat/config';
import redstone from 'redstone-api';

import ContractAddresses from '../address.json';

task('admin:price', 'Admin: Get price of LSAN per byte')
	.addPositionalParam('bytes', 'Number in Bytes (default), KB, MB, GB, TB')
	.addOptionalPositionalParam(
		'group',
		'ie. Bytes (leave empty), KB, MB, GB, TB'
	)
	.setAction(async (taskArgs: { bytes: string; group: string }, hre) => {
		const chainId = hre.network.config.chainId;
		console.log('Chain Id:', chainId);

		const { bytes = '1', group } = taskArgs;
		const b = parseInt(bytes, 10);

		let realBytes = b;
		switch (group) {
			case 'KB':
			case 'kb':
				realBytes = b * 1000;
				console.log(`${b} = ${realBytes} kilobytes`);
				break;
			case 'MB':
			case 'mb':
				realBytes = b * 1000 * 1000;
				console.log(`${b} = ${realBytes} megabytes`);
				break;
			case 'GB':
			case 'gb':
				realBytes = b * 1000 * 1000 * 1000;
				console.log(`${b} = ${realBytes} gigabytes`);
				break;
			case 'TB':
			case 'tb':
				realBytes = b * 1000 * 1000 * 1000 * 1000;
				console.log(`${b} = ${realBytes} terabytes`);
				break;
			default:
				break;
		}

		try {
			// const [signer] = await hre.ethers.getSigners();
			const chainIdIndex = `${chainId}` as keyof typeof ContractAddresses;
			const { tokenManagerAddress: lsanTokenAddress } = ContractAddresses[
				chainIdIndex
			] as any;
			console.log('LSAN Token Address:', lsanTokenAddress);

			console.log(`Fetching price of ${realBytes} bytes`);

			const mb = 1000000;
			// ? Arweave's fetch is experimental and causes a bug when used inside of DevNetwork
			const { data: winston } = await axios.get(
				`https://arweave.net/price/1000`
			);
			const arweave = new ArweaveClient({
				host: 'arweave.net',
				protocol: 'https',
			});
			// Get price from Arweave
			const priceInAr = arweave.ar.winstonToAr(winston);
			// Get AR and Matic price
			const arPrice = await redstone.getPrice('AR');
			const maticPrice = await redstone.getPrice('MATIC');
			// Get AR / Matic
			const priceOfArInMatic = arPrice.value / maticPrice.value;
			const maticPerByte = (priceOfArInMatic * +priceInAr) / mb;
			const weiPerByte = hre.ethers.utils.parseUnits(maticPerByte.toFixed(18));
			console.log(
				`MATIC: ${hre.ethers.utils.formatEther(weiPerByte)} per byte`
			);
			console.log(`MATIC (WEI): ${weiPerByte.toString()} per byte`);
			console.log(
				`MATIC (WEI): ${weiPerByte
					.mul(realBytes)
					.toString()} for ${realBytes} bytes`
			);
		} catch (e) {
			console.error(e);
		}
	});
