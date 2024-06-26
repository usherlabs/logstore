/**
 * The Log Store Network Contracts Hardhat!
 */
import '@nomicfoundation/hardhat-toolbox';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import '@openzeppelin/hardhat-upgrades';
import '@typechain/hardhat';
import { config as dotenvConfig } from 'dotenv';
import 'hardhat-contract-sizer';
// import type { HardhatUserConfig } from 'hardhat/config';
import type {
	// MultiSolcUserConfig,
	NetworkUserConfig,
} from 'hardhat/types';
import snakeCase from 'lodash.snakecase';
import { resolve } from 'path';

// import 'solidity-coverage';
import './tasks';

const { STREAMR_DOCKER_DEV_HOST = 'localhost' } = process.env;
const dotenvConfigPath: string = process.env.DOTENV_CONFIG_PATH || './.env';
dotenvConfig({ path: resolve(__dirname, dotenvConfigPath) });

// Ensure that we have all the environment variables we need.
const mnemonic: string | undefined = process.env.MNEMONIC;
const ownerPrivateKey: string = process.env.OWNER_PRIVATE_KEY || '';
if (!mnemonic && !ownerPrivateKey) {
	throw new Error(
		'Please set your MNEMONIC or OWNER_PRIVATE_KEY in a .env file'
	);
}

const chainIds = {
	'arbitrum-mainnet': 42161,
	avalanche: 43114,
	bsc: 56,
	hardhat: 31337,
	'eth-mainnet': 1,
	'eth-goerli': 5,
	'optimism-mainnet': 10,
	'polygon-mainnet': 137,
	'polygon-mumbai': 80001,
	sepolia: 11155111,
	'streamr-dev': 31337,
};

function getChainConfig(chain: keyof typeof chainIds): NetworkUserConfig {
	let jsonRpcUrl: string;
	switch (chain) {
		case 'avalanche':
			jsonRpcUrl = 'https://api.avax.network/ext/bc/C/rpc';
			break;
		case 'bsc':
			jsonRpcUrl = 'https://bsc-dataseed1.binance.org';
			break;
		case 'streamr-dev':
			jsonRpcUrl = 'http://10.200.10.1:8547';
			break;
		default:
			jsonRpcUrl = process.env[snakeCase(chain).toUpperCase()] || '';
	}
	return {
		accounts: ownerPrivateKey ? [ownerPrivateKey] : [],
		allowUnlimitedContractSize: true,
		chainId: chainIds[chain],
		url: jsonRpcUrl,
	};
}

const config = {
	defaultNetwork: 'hardhat',
	// namedAccounts: {
	// 	deployer: {
	// 		default: 0,
	// 	},
	// },
	mocha: {
		timeout: process.env.MOCHA_TIMEOUT || 300000,
	},
	etherscan: {
		apiKey: {
			arbitrumOne: process.env.ARBISCAN_API_KEY || '',
			avalanche: process.env.SNOWTRACE_API_KEY || '',
			bsc: process.env.BSCSCAN_API_KEY || '',
			mainnet: process.env.ETHERSCAN_API_KEY || '',
			optimisticEthereum: process.env.OPTIMISM_API_KEY || '',
			polygon: process.env.POLYGONSCAN_API_KEY || '',
			polygonMumbai: process.env.POLYGONSCAN_API_KEY || '',
			sepolia: process.env.ETHERSCAN_API_KEY || '',
		},
	},
	gasReporter: {
		currency: 'USD',
		enabled: !!process.env.REPORT_GAS,
		coinmarketcap: process.env.COINMARKETCAP_API_KEY,
		maxMethodDiff: 10,
	},
	networks: {
		hardhat: {
			accounts: {
				mnemonic,
			},
			chainId: chainIds['eth-goerli'],
			forking: {
				url: String(process.env.FORK_URL),
				blockNumber: 8800522,
			},
		},
		development: {
			url: 'http://localhost:8545', // Connect to hardhat dev
		},
		// avalanche: getChainConfig('avalanche'),
		// bsc: getChainConfig('bsc'),
		// mainnet: getChainConfig('eth-mainnet'),
		// goerli: getChainConfig('eth-goerli'),
		// optimism: getChainConfig('optimism-mainnet'),
		'polygon-mainnet': getChainConfig('polygon-mainnet'),
		'polygon-mumbai': getChainConfig('polygon-mumbai'),
		'streamr-dev': getChainConfig('streamr-dev'),
		// sepolia: getChainConfig('sepolia'),
	},
	paths: {
		artifacts: './artifacts',
		cache: './cache',
		sources: './src',
		tests: './test',
	},
	solidity: {
		version: '0.8.17',
		settings: {
			// metadata: {
			// 	// Not including the metadata hash
			// 	// https://github.com/paulrberg/hardhat-template/issues/31
			// 	bytecodeHash: 'none',
			// },
			// Disable the optimizer when debugging
			// https://hardhat.org/hardhat-network/#solidity-optimizer-support
			optimizer: {
				enabled: true,
				runs: 800,
			},
			viaIR: true,
		},
	},
	typechain: {
		outDir: 'types',
		target: 'ethers-v5',
	},
	outputSelection: process.env.TESTING
		? {
				'*': {
					'*': ['storageLayout'],
				},
		  }
		: {},
};

export default config;
