import { LogStoreNodeManager } from '@concertotech/logstore-contracts';
import {
	getNodeManagerContract,
	getQueryManagerContract,
	getReportManagerContract,
	getStoreManagerContract,
	prepareStakeForNodeManager,
	prepareStakeForQueryManager,
	prepareStakeForStoreManager,
} from '@concertotech/logstore-shared';
import { Wallet } from '@ethersproject/wallet';
import LogStoreClient, {
	CONFIG_TEST,
	NodeMetadata,
	StreamPermission,
} from '@logsn/client';
import { Tracker } from '@streamr/network-tracker';
import { fetchPrivateKeyWithGas } from '@streamr/test-utils';
import { providers } from 'ethers';
import { range } from 'lodash';

import { StrictConfig } from '../../../../src/config/config';
import { ReportPoller } from '../../../../src/plugins/logStore/Report';
import {
	createLogStoreClient,
	createTestStream,
	startTestTracker,
} from '../../../utils';

jest.setTimeout(6000000);

const TRACKER_PORT = 17711;
const STAKE_AMOUNT = BigInt('2000000000000000000');
const NUM_NODES = 3;

describe(ReportPoller, () => {
	let tracker: Tracker;
	let client1: LogStoreClient;
	let brokerWallet: Wallet;
	let testStream: any;
	let provider: providers.JsonRpcProvider;
	let logStoreBrokerWallets: Wallet[] = [];
	let publisherClients: LogStoreClient[] = [];
	let localReport: any;
	const nodeManagers: LogStoreNodeManager[] = [];

	beforeEach(async () => {
		tracker = await startTestTracker(TRACKER_PORT);
		provider = new providers.JsonRpcProvider(
			CONFIG_TEST.contracts?.streamRegistryChainRPCs?.rpcs[0].url,
			CONFIG_TEST.contracts?.streamRegistryChainRPCs?.chainId
		);
		console.log('initialising provider');
		logStoreBrokerWallets = await Promise.all(
			range(NUM_NODES).map(async () => {
				const newKey = await fetchPrivateKeyWithGas();
				const wallet = new Wallet(newKey, provider);
				return wallet;
			})
		);
		console.log('initialising logstorebroker wallets');
		publisherClients = await Promise.all(
			range(NUM_NODES).map(async (_, index) => {
				const newPK = logStoreBrokerWallets[index].privateKey;
				const client = await createLogStoreClient(tracker, newPK);
				return client;
			})
		);
		brokerWallet = logStoreBrokerWallets[0];
		client1 = publisherClients[0];
		testStream = await createTestStream(client1, module);

		console.log('Initialising node managers');
		// stake and grant permission to all node

		for await (const [index, logstoreWallet] of Object.entries(
			logStoreBrokerWallets
		)) {
			const queryManager = await getQueryManagerContract(logstoreWallet);
			const storeManager = await getStoreManagerContract(logstoreWallet);
			try {
				await new Promise((r) => setTimeout(r, +index * 500));

				const nodeManagerContract = await getNodeManagerContract(
					logstoreWallet
				);
				nodeManagers[+index] = nodeManagerContract;
				const nodeMetadata: NodeMetadata = {
					http: `http://127.0.0.1:717${index}`,
				};
				await prepareStakeForNodeManager(logstoreWallet, STAKE_AMOUNT);
				(
					await nodeManagerContract.join(
						STAKE_AMOUNT,
						JSON.stringify(nodeMetadata)
					)
				).wait();
				// stake in query manager contract
				await prepareStakeForQueryManager(logstoreWallet, STAKE_AMOUNT);
				(await queryManager.stake(STAKE_AMOUNT)).wait();

				// stake in store manager contract
				await prepareStakeForStoreManager(logstoreWallet, STAKE_AMOUNT);
				(await storeManager.stake(testStream.id, STAKE_AMOUNT)).wait();

				await testStream.grantPermissions({
					permissions: [StreamPermission.PUBLISH],
					user: logstoreWallet.address,
				});
				console.log(
					'permission granted to:',
					logstoreWallet.address,
					'on stream',
					testStream.id
				);
			} catch (err) {
				console.log(err.message);
			}
		}

		localReport = {
			id: `report_${+new Date()}`,
			height: (await provider.getBlockNumber()) - 100,
			treasury: 115000000000000,
			streams: [
				{
					id: testStream.id,
					capture: 0,
					bytes: 230,
				},
			],
			consumers: [
				{
					id: brokerWallet.address,
					capture: 230000000000000,
					bytes: 230,
				},
			],
			nodes: { [brokerWallet.address]: 115000000000000 },
			delegates: {
				[brokerWallet.address]: {
					[brokerWallet.address]: 115000000000000,
				},
			},
		};
	});

	afterEach(async () => {
		await Promise.all([tracker.stop(), client1.destroy()]);
		for await (const index of range(NUM_NODES)) {
			(await nodeManagers[index].leave()).wait();
			await publisherClients[index].destroy();
		}
	});

	// test('Report Can be submitted by one node in the network', async () => {
	// 	const reportPoller = new ReportPoller(
	// 		CONFIG_TEST as StrictConfig,
	// 		client1 as LogStoreClient,
	// 		brokerWallet,
	// 		testStream
	// 	);
	// 	// generate a report with the address of a broker node that has been staked in query and store manager contracts
	// 	const [submitReportTX] = (await reportPoller.processNewReport(
	// 		localReport
	// 	)) as ethers.ContractTransaction[];
	// 	const reportManager = await getReportManagerContract(
	// 		logStoreBrokerWallets[0]
	// 	);

	// 	const latestReport = await reportManager.getLastReport();
	// 	const latestReportId = latestReport.id;

	// 	expect(submitReportTX.chainId).toBe(
	// 		CONFIG_TEST.contracts?.streamRegistryChainRPCs?.chainId
	// 	);
	// 	expect(latestReportId).toBe(localReport.id);

	// 	const latestReportPostProcess = await reportManager.getLastReport();
	// 	expect(latestReportPostProcess._processed).toBe(true);
	// });

	test('Report Can only be submitted when more than half the nodes submit one', async () => {
		// check how many nodes are joined
		const testReport = { ...localReport };
		const reportManager = await getReportManagerContract(
			logStoreBrokerWallets[0]
		);
		const nodeManager = await getNodeManagerContract(logStoreBrokerWallets[0]);
		const nodes = await nodeManager.nodeAddresses();
		const reporters = await reportManager.getReporters();
		console.log({ activeNodes: nodes, reporters });
		// start report listener
		const reportPoller = new ReportPoller(
			CONFIG_TEST as StrictConfig,
			client1 as LogStoreClient,
			brokerWallet,
			testStream
		);
		const reportPollerPromise = reportPoller.processNewReport(testReport);
		// publish to stream with more than enough positives
		for await (const i of range(0, NUM_NODES).slice(1)) {
			const poller = new ReportPoller(
				CONFIG_TEST as StrictConfig,
				publisherClients[i] as LogStoreClient,
				logStoreBrokerWallets[i],
				testStream
			);
			await poller.publishReport(testReport);
		}
		const [submitReportTX] = (await reportPollerPromise) as [any, any];
		// wait until report listener resolves with transactions
		// veryfy success

		const latestReport = await reportManager.getLastReport();
		const latestReportId = latestReport.id;

		expect(submitReportTX.chainId).toBe(
			CONFIG_TEST.contracts?.streamRegistryChainRPCs?.chainId
		);
		expect(latestReportId).toBe(localReport.id);

		const latestReportPostProcess = await reportManager.getLastReport();
		expect(latestReportPostProcess._processed).toBe(true);
	});
});
