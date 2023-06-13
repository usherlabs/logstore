import { CONFIG_TEST } from '@logsn/client';
import { toEthereumAddress } from '@streamr/utils';
import chalk from 'chalk';
import { Wallet } from 'ethers';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import inquirer, { Answers } from 'inquirer';
import path from 'path';

import { generateMnemonicFromAddress } from '../helpers/generateMnemonicFromAddress';
import { getDefaultFile } from './config';

export interface PrivateKeyAnswers extends Answers {
	generateOrImportPrivateKey: 'Import' | 'Generate';
	importPrivateKey?: string;
}

export interface StorageAnswers extends Answers {
	storagePath: string;
}

const createLogger = () => {
	return {
		info: (...args: any[]) => {
			console.info(chalk.bgWhite.black(':'), ...args);
		},
		error: (...args: any[]) => {
			console.error(chalk.bgRed.black('!'), ...args);
		},
	};
};

const PRIVATE_KEY_SOURCE_GENERATE = 'Generate';
const PRIVATE_KEY_SOURCE_IMPORT = 'Import';

export const CONFIG_TEMPLATE: any = {
	// TODO: config schema URI
	// $schema: formSchemaUrl(CURRENT_CONFIGURATION_VERSION),
	client: {
		auth: {},
	},
	// TODO: configure LogStore plugin by the ConfigWizard
	plugins: {
		logStore: {
			cassandra: {
				hosts: ['127.0.0.1'],
				username: '',
				password: '',
				keyspace: 'logstore_dev',
				datacenter: 'datacenter1',
			},
			logStoreConfig: {
				refreshInterval: 10000,
			},
		},
	},
};

const PRIVATE_KEY_PROMPTS: Array<
	inquirer.Question | inquirer.ListQuestion | inquirer.CheckboxQuestion
> = [
	{
		type: 'list',
		name: 'generateOrImportPrivateKey',
		message:
			'Do you want to generate a new Ethereum private key or import an existing one?',
		choices: [PRIVATE_KEY_SOURCE_GENERATE, PRIVATE_KEY_SOURCE_IMPORT],
	},
	{
		type: 'password',
		name: 'importPrivateKey',
		message: 'Please provide the private key to import',
		when: (answers: inquirer.Answers): boolean => {
			return answers.generateOrImportPrivateKey === PRIVATE_KEY_SOURCE_IMPORT;
		},
		validate: (input: string): string | boolean => {
			try {
				new Wallet(input);
				return true;
			} catch (e: any) {
				return 'Invalid private key provided.';
			}
		},
	},
	{
		type: 'confirm',
		name: 'revealGeneratedPrivateKey',
		// eslint-disable-next-line max-len
		message:
			'We strongly recommend backing up your private key. It will be written into the config file, but would you also like to see this sensitive information on screen now?',
		default: false,
		when: (answers: inquirer.Answers): boolean => {
			return answers.generateOrImportPrivateKey === PRIVATE_KEY_SOURCE_GENERATE;
		},
	},
];

export const PROMPTS = {
	privateKey: PRIVATE_KEY_PROMPTS,
};

export const storagePathPrompts = [
	{
		type: 'input',
		name: 'storagePath',
		message: 'Select a path to store the generated config in',
		default: getDefaultFile(),
	},
	{
		type: 'confirm',
		name: 'overwrite',
		message: (answers: inquirer.Answers): string =>
			`The selected destination ${answers.storagePath} already exists, do you want to overwrite it?`,
		default: false,
		when: (answers: inquirer.Answers): boolean =>
			existsSync(answers.storagePath),
	},
];

export const getConfig = (privateKey: string): any => {
	const config = {
		...CONFIG_TEMPLATE,
		plugins: { ...CONFIG_TEMPLATE.plugins },
	};

	// TODO: For development purpose we use CONFIG_TEST. Have to be removed when go to prod.
	config.client = {
		...CONFIG_TEST,
		auth: {},
	};

	config.client.auth.privateKey = privateKey;

	return config;
};

const selectStoragePath = async (): Promise<StorageAnswers> => {
	let answers;
	do {
		answers = await inquirer.prompt(storagePathPrompts);
	} while (answers.overwrite === false);
	return answers as any;
};

export const createStorageFile = async (
	config: any,
	answers: StorageAnswers
): Promise<string> => {
	const dirPath = path.dirname(answers.storagePath);
	const dirExists = existsSync(dirPath);
	if (!dirExists) {
		mkdirSync(dirPath, {
			recursive: true,
		});
	}
	writeFileSync(answers.storagePath, JSON.stringify(config, null, 4));
	chmodSync(answers.storagePath, '600');
	return answers.storagePath;
};

export const getPrivateKey = (answers: PrivateKeyAnswers): string => {
	return answers.generateOrImportPrivateKey === PRIVATE_KEY_SOURCE_IMPORT
		? answers.importPrivateKey!
		: Wallet.createRandom().privateKey;
};

export const getNodeIdentity = (
	privateKey: string
): {
	mnemonic: string;
	networkExplorerUrl: string;
} => {
	const nodeAddress = new Wallet(privateKey).address;
	const mnemonic = generateMnemonicFromAddress(toEthereumAddress(nodeAddress));
	// TODO: Network Explorer link
	const networkExplorerUrl = `https://streamr.network/network-explorer/nodes/${nodeAddress}`;
	return {
		mnemonic,
		networkExplorerUrl,
	};
};

export const startConfigWizard = async (
	getPrivateKeyAnswers = (): Promise<PrivateKeyAnswers> =>
		inquirer.prompt(PRIVATE_KEY_PROMPTS) as any,
	getStorageAnswers = selectStoragePath,
	logger = createLogger()
): Promise<void> => {
	try {
		const privateKeyAnswers = await getPrivateKeyAnswers();
		const privateKey = getPrivateKey(privateKeyAnswers);
		if (privateKeyAnswers.revealGeneratedPrivateKey) {
			logger.info(`This is your node's private key: ${privateKey}`);
		}
		const config = getConfig(privateKey);
		const storageAnswers = await getStorageAnswers();
		const storagePath = await createStorageFile(config, storageAnswers);
		logger.info('Welcome to the LogStore Network');
		const { mnemonic, networkExplorerUrl } = getNodeIdentity(privateKey);
		logger.info(`Your node's generated name is ${mnemonic}.`);
		logger.info('View your node in the Network Explorer:');
		logger.info(networkExplorerUrl);
		logger.info('You can start the broker now with');
		logger.info(`logstore-broker ${storagePath}`);
	} catch (e: any) {
		logger.error('Broker Config Wizard encountered an error:\n' + e.message);
	}
};
