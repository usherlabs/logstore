import { task } from 'hardhat/config';

import { getTaskConfig } from './utils';

task('admin:price', 'Admin: Get price of LSAN per byte')
	.addPositionalParam('bytes', 'Number in Bytes (default), KB, MB, GB, TB')
	.addOptionalPositionalParam(
		'group',
		'ie. Bytes (leave empty), KB, MB, GB, TB'
	)
	.setAction(async (taskArgs: { bytes: string; group: string }, hre) => {
		const { tokenContract } = await getTaskConfig(hre);

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
			const lsanPerByte = await tokenContract.price();
			console.log();
			console.log(`LSAN per byte: ${lsanPerByte}`);
			console.log(
				`LSAN for ${b} ${group || 'bytes'}: ${lsanPerByte.mul(b).toString()}`
			);
		} catch (e) {
			console.error(e);
		}
	});
