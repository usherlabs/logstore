import { exec } from 'child_process';



import { joinNetwork } from './joinNetwork';


// Utility function to execute shell command and return as promise
const execAsync = (cmd: string): Promise<string> => {
	return new Promise((resolve, reject) => {
		exec(cmd, (error, stdout) => {
			if (error) {
				reject(error);
			} else {
				resolve(stdout);
			}
		});
	});
};

const stake = async () => {
	const cmd = `logstore --host http://localhost:8546 --wallet "${process.env.EVM_PRIVATE_KEY}" query stake -y 1000000000000000000000000000000`;
	await execAsync(cmd);
};

const extractBalance = async (): Promise<number> => {
	const cmd = `logstore --host http://localhost:8546 --wallet "${process.env.EVM_PRIVATE_KEY}" query balance`;
	const balanceOutput = await execAsync(cmd);
	// escape ascii color codes
	const balanceOutputClean = balanceOutput.replace(/\u001b\[.*?m/g, '');
	const matches = balanceOutputClean.match(
		/balance of account (.*?) is (.*?)(\s)/
	);
	if (!matches || matches.length < 3) {
		throw new Error('Failed to extract balance.');
	}
	return parseFloat(matches[2]);
};

const main = async () => {
	console.log('Starting the validator node');
	try {
		const balance = await extractBalance();
		if (balance === 0) {
			console.log('-- No balance found. Staking 1000 KYVE --');
			await stake();
		} else {
			console.log('-- Balance found. Nothing to do. --');
		}
		await joinNetwork();
	} catch (error) {
		console.error('An error occurred:', error);
	}
};

main().then(() => {
	process.exit(0);
});
