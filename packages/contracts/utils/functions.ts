import { BigNumber } from 'ethers';
import fs from 'fs';
import hre from 'hardhat';
import path from 'path';

import { STAKE_TOKEN_CONTRACTS, STREAMR_REGISTRY_ADDRESS } from './addresses';

export const getChainId = async () =>
	await hre.ethers.provider
		.getNetwork()
		.then((n: { chainId: number }) => n.chainId);

export const getAccounts = async () => hre.ethers.getSigners();

export const toBigDecimal = (amount: number, exponent = 18) => {
	if (amount < 0) throw 'amount < 0';
	return BigNumber.from(`${amount}${'0'.repeat(exponent)}`);
};

export async function getNodeManagerInputParameters() {
	// define important params
	const chainId = await getChainId();
	const [adminAccount] = await getAccounts();
	// validations of variable parameters
	if (!STAKE_TOKEN_CONTRACTS[chainId]) throw `No token address for ${chainId}`;
	// define the common parameters
	const initialParameters = [
		adminAccount.address,
		false,
		STAKE_TOKEN_CONTRACTS[chainId],
		toBigDecimal(1, 18),
		[],
		[],
	];

	return initialParameters;
}

export async function getStoreManagerInputParameters(
	nodeManagerAddress: string
) {
	// define important params
	const chainId = await getChainId();
	// define actual parameters
	const initialParameters = {
		owner: nodeManagerAddress,
		stakeToken: STAKE_TOKEN_CONTRACTS[chainId],
		streamrRegistryAddress: STREAMR_REGISTRY_ADDRESS[chainId],
	};
	// validations of variable parameters
	if (!initialParameters.stakeToken) throw `No token address for ${chainId}`;
	if (!initialParameters.streamrRegistryAddress)
		throw `No streamr address for ${chainId}`;
	// validations of variable parameters

	return Object.values(initialParameters);
}

export async function getQueryManagerInputParameters(
	nodeManagerAddress: string
) {
	// define important params
	const chainId = await getChainId();
	// define actual parameters
	const initialParameters = {
		owner: nodeManagerAddress,
		stakeToken: STAKE_TOKEN_CONTRACTS[chainId],
	};
	// validations of variable parameters
	if (!initialParameters.stakeToken) throw `No token address for ${chainId}`;
	// validations of variable parameters

	return Object.values(initialParameters);
}

export async function writeJSONToFileOutside(
	inputJsonData: Record<string, string>,
	filename: string
) {
	// Specify the absolute path of the directory outside the current directory where you want to write the file.
	const targetDirectory = path.join(__dirname, '..');

	// Combine the target directory and the filename to get the full file path.
	const filePath = path.join(targetDirectory, filename);
	// attach the chainId
	const chainId = await getChainId();
	const jsonData = { [chainId]: inputJsonData };
	// Check if the file exists.
	fs.access(filePath, fs.constants.F_OK, (err) => {
		if (err) {
			// If the file does not exist, create it.
			fs.writeFile(filePath, JSON.stringify(jsonData), (err) => {
				if (err) {
					console.error(err);
					return;
				}
				console.log(`JSON addresses data written to ${filePath}`);
			});
		} else {
			// If the file already exists, append the JSON data to it.
			fs.readFile(filePath, (err, data) => {
				if (err) {
					console.error(err);
					return;
				}
				const existingData = JSON.parse(data.toString());
				const newData = Object.assign(existingData, jsonData);
				fs.writeFile(filePath, JSON.stringify(newData, null, 2), (err) => {
					if (err) {
						console.error(err);
						return;
					}
					console.log(`JSON addresses data appended to ${filePath}`);
				});
			});
		}
	});
}
