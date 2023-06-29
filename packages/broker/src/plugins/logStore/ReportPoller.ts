import { LogStoreClient, Stream } from '@logsn/client';
import { LogStoreNodeManager, LogStoreReportManager } from '@logsn/contracts';
import { ProofOfReport } from '@logsn/protocol';
import {
	getNodeManagerContract,
	getReportManagerContract,
	IReport,
} from '@logsn/shared';
import { Logger, scheduleAtInterval } from '@streamr/utils';
import axios from 'axios';
import { BigNumber, ethers, Signer, Wallet } from 'ethers';

import { StrictConfig } from '../../config/config';
import { decompressData } from '../../helpers/decompressFile';
import { ReportPoll } from './ReportPoll';

const logger = new Logger(module);
const REPORT_TRESHOLD_MULTIPLIER = 0.5;

export class ReportPoller {
	private readonly poolConfig: StrictConfig['pool'];
	private readonly logStoreClient: LogStoreClient;
	private readonly systemStream: Stream;
	private readonly signer: Signer;

	private reportManager!: LogStoreReportManager;
	private nodeManager!: LogStoreNodeManager;

	private polls: Record<string, ReportPoll> = {};

	private latestBundle: number;

	constructor(
		config: StrictConfig,
		logStoreClient: LogStoreClient,
		signer: Signer,
		systemStream: Stream
	) {
		this.poolConfig = config.pool;
		this.logStoreClient = logStoreClient;
		this.latestBundle = 0;
		this.signer = signer;
		this.systemStream = systemStream;
	}

	public async start(abortSignal: AbortSignal): Promise<void> {
		this.reportManager = await getReportManagerContract(this.signer as Wallet);
		this.nodeManager = await getNodeManagerContract(this.signer as Wallet);

		if (this.poolConfig.pollInterval > 0) {
			await scheduleAtInterval(
				() => this.tryPoll(),
				this.poolConfig.pollInterval,
				true,
				abortSignal
			);
		} else {
			await this.tryPoll();
		}
	}

	private async poll(): Promise<void> {
		// get the report manager contract
		const latestBundle = await this.fetchPoolLatestBundle();

		// ensure this poller has seen at least 1 bundles cycle before it can start processing
		// so nodes who join halfway through the process, wait for the next round before starting
		if (latestBundle > this.latestBundle && this.latestBundle > 0) {
			// theres a new bundle that should be processed
			const report = await this.fetchReportData(latestBundle);
			// do not process this report if it has been submitted
			const latestReport = await this.reportManager.getLastReport();
			if (latestReport.id === report.id) {
				return;
			}

			const hash = this.createReportHash(report);
			let poll = this.polls[hash];
			if (poll) {
				poll.assignReport(report);
			} else {
				poll = new ReportPoll({
					reportOrProof: report,
					hash: hash,
					onProcessCb: async (p) => await this.processPoll(p),
					onCompleteCb: () => delete this.polls[poll.hash],
				});
				this.polls[hash] = poll;
			}

			await this.publishProof(poll as ReportPoll & { report: IReport });
		}
		// set the latest bundle
		this.latestBundle = Math.max(latestBundle, this.latestBundle);
	}

	private async processPoll(
		poll: ReportPoll & { report: IReport }
	): Promise<ethers.ContractTransaction[] | undefined> {
		// get important variables from contract
		const allActiveNodes = await this.nodeManager.nodeAddresses();
		logger.info(`${allActiveNodes.length} active nodes:${allActiveNodes}`);
		const blockBuffer = (
			await this.reportManager.reportBlockBuffer()
		).toNumber();
		const orderedReporters = await this.reportManager.getReporters();
		logger.info(`nodes ordered:${orderedReporters}`);

		// check if this node can submit a report
		const nodeCanReport = await this.nodeCanSubmitReport(
			poll.report,
			orderedReporters,
			blockBuffer
		);
		logger.info(`Node ${nodeCanReport ? 'can' : 'cannot'} submit report`);
		// everytime we get a new signature
		// confirm if this node can submit a report
		// and more than half the nodes have submitted
		if (
			nodeCanReport &&
			poll.proofs.length >=
				Math.ceil(allActiveNodes.length * REPORT_TRESHOLD_MULTIPLIER)
		) {
			return await this.submitReport(poll);
		}
	}

	private async tryPoll(): Promise<void> {
		try {
			logger.info(`Polling for a new report at ${new Date()}`);
			await this.poll();
		} catch (err) {
			logger.warn(`error when trying to poll report: ${err}`);
		}
	}

	// poll kyve url for information on how many bundles have been finalized by tthis pool
	private async fetchPoolLatestBundle() {
		logger.info(`Fetching the pool information to get latest bundle`);
		const { data: response } = await axios.get(
			`${this.poolConfig.url}/kyve/query/v1beta1/pool/${this.poolConfig.id}`
		);
		const { total_bundles: totalBundles } = response.pool.data;
		return totalBundles - 1;
	}

	// using the bundle id, fetch information about this bundle
	private async fetchReportData(bundleId: number): Promise<IReport> {
		logger.info(`Fetching the bundle with id:${bundleId}`);
		// fetch information about the bundle parameter passed in
		const { data: response } = await axios.get(
			`${this.poolConfig.url}/kyve/query/v1beta1/finalized_bundle/${this.poolConfig.id}/${bundleId}`
		);
		const arweaveStorageId = response.finalized_bundle.storage_id;
		// using the storage id, we fetch the information from arweave
		// It should be noted that what is gotten is an array buffer since we expect the file to be zipped
		const { data: gzippedData } = await axios.get(
			`https://arweave.net/${arweaveStorageId}`,
			{
				responseType: 'arraybuffer',
			}
		);
		logger.info(`unzipping downloaded bundle to fetch report`);
		// unzip the data and get the report from it
		const unzippedJsonStringified = await decompressData(gzippedData);
		const unzippedJson = JSON.parse(unzippedJsonStringified as string);

		// get a report from the last item in the bundle
		const reportJson = unzippedJson.at(-1);
		if (!reportJson.value.r) {
			throw Error('Report not found in bundle');
		}

		return reportJson.value.r as IReport;
	}

	private async publishProof(poll: ReportPoll & { report: IReport }) {
		// put this call into a method to publish a report which handles all of these
		// hash the report
		logger.info(
			`Publishing proof of report ${poll.report.id} (hash: ${poll.hash})`
		);
		const brokerAddress = await this.signer.getAddress();
		// this.reportHash = this.hashReport(report);
		logger.info(`hashed report: ${poll.hash}`);
		// sign the hash
		const signature = await this.signer.signMessage(
			ethers.utils.arrayify(poll.hash)
		);
		logger.info(`signed report: ${signature}`);

		// publish the report to the system stream
		const proofOfReport = new ProofOfReport({
			address: brokerAddress,
			signature,
			hash: poll.hash,
		});
		await this.logStoreClient.publish(
			this.systemStream,
			proofOfReport.serialize()
		);
		logger.info(
			`Proof of report ${poll.report.id} published to system stream`,
			proofOfReport
		);
	}

	private async nodeCanSubmitReport(
		report: IReport,
		reportersList: Array<string>,
		blockBuffer: number
	) {
		const brokerAddress = await this.signer.getAddress();
		const nodeIndex = reportersList.findIndex(
			(address) => address.toLowerCase() === brokerAddress.toLowerCase()
		);
		const blockNumber = (await this.signer.provider?.getBlockNumber()) || 0;
		logger.info(
			`Blocknumber:${blockNumber}; ReportHeight: ${report.height}; NodeIndex:${nodeIndex}; blockBuffer:${blockBuffer}; reporters:${reportersList}; broker: ${brokerAddress}`
		);
		// use this condition to determine if a node is capable of submitting a report
		// same logic smart contract uses to determine who can or cannot submit
		const condition =
			blockNumber >
			nodeIndex * blockBuffer +
				(nodeIndex > 0 ? blockBuffer : 0) +
				report.height;

		return condition;
	}

	private async submitReport(poll: ReportPoll & { report: IReport }) {
		const formattedReport = await this.formatReportForContract(poll);
		const submitReportTx = await this.reportManager.report(
			formattedReport.id,
			formattedReport.blockHeight,
			formattedReport.streams,
			formattedReport.writeCaptureAmounts,
			formattedReport.writeBytes,
			formattedReport.readConsumerAddresses,
			formattedReport.readCaptureAmounts,
			formattedReport.readBytes,
			formattedReport.nodes,
			formattedReport.nodeChanges,
			formattedReport.delegates,
			formattedReport.delegateNodes,
			formattedReport.delegateNodeChanges,
			formattedReport.treasurySupplyChange,
			formattedReport.addresses,
			formattedReport.signatures
		);
		await submitReportTx.wait();
		logger.info(
			`Report ${poll.report.id} submitted on tx: ${submitReportTx.hash}; about to process report`
		);
		// process the newly submitted transactions
		// ? what happens if for any reason a report is submitted sucesfully
		// ? but encounters an error when processed i.e if a consumer/storer is not staked to a stream
		const processReportTx = await this.nodeManager.processReport(
			poll.report.id
		);
		await processReportTx.wait();
		logger.info(
			`Report ${poll.report.id} processed on tx: ${processReportTx.hash};`
		);

		return [submitReportTx, processReportTx];
	}

	public async processProofOfReport(proof: ProofOfReport) {
		logger.info(`processProofOfReport`);

		let poll = this.polls[proof.hash];
		if (poll) {
			poll.addProof(proof);
		} else {
			poll = new ReportPoll({
				reportOrProof: proof,
				hash: proof.hash,
				onProcessCb: async (p) => await this.processPoll(p),
				onCompleteCb: () => delete this.polls[poll.hash],
			});
			this.polls[proof.hash] = poll;
		}
	}

	private async formatReportForContract(poll: ReportPoll) {
		const report = poll.report!;
		const output = {
			id: report.id,
			blockHeight: report.height,
			// -- streams
			streams: report.streams.map(({ id }) => id.toLowerCase()),
			writeCaptureAmounts: report.streams.map(({ capture }) => capture),
			writeBytes: report.streams.map(({ bytes }) => bytes),
			// -- streams

			// -- consumers
			readConsumerAddresses: report.consumers.map(({ id }) => id),
			readCaptureAmounts: report.consumers.map(({ capture }) => capture),
			readBytes: report.consumers.map(({ bytes }) => bytes),
			// -- consumers

			// -- nodes
			nodes: Object.keys(report.nodes),
			nodeChanges: Object.values(report.nodes),
			// -- nodes

			// -- delegates
			delegates: Object.keys(report.delegates),
			delegateNodes: Object.keys(report.delegates).map((delegate) =>
				Object.keys(report.delegates[delegate])
			),
			delegateNodeChanges: Object.keys(report.delegates).map((delegate) =>
				Object.values(report.delegates[delegate])
			),
			// -- delegates
			treasurySupplyChange: report.treasury,
			// -- signature and broker validations
			addresses: poll.proofs.map((proof) => proof.address),
			signatures: poll.proofs.map((proof) => proof.signature),
			// -- signature and broker validations
		};
		return output;
	}

	private createReportHash(report: IReport) {
		// extract only the fields that need to be hashed from the report
		const extractedReport = {
			id: report.id,
			height: `${report.height}`,
			treasury: BigNumber.from(report.treasury).toHexString(),
			streams: [] as {
				id: string;
				capture: string;
				bytes: number;
			}[],
			consumers: [] as {
				id: string;
				capture: string;
				bytes: number;
			}[],
			nodes: {} as Record<string, string>,
			delegates: {} as Record<string, Record<string, string>>,
		};

		for (const stream of report.streams) {
			extractedReport.streams.push({
				id: stream.id,
				capture: BigNumber.from(stream.capture).toHexString(),
				bytes: stream.bytes,
			});
		}
		for (const consumer of report.consumers) {
			extractedReport.consumers.push({
				id: consumer.id,
				capture: BigNumber.from(consumer.capture).toHexString(),
				bytes: consumer.bytes,
			});
		}
		for (const node in report.nodes) {
			extractedReport.nodes[node] = BigNumber.from(
				report.nodes[node]
			).toHexString();
		}
		for (const delegate in report.delegates) {
			extractedReport.delegates[delegate] = {};
			for (const node in report.delegates[delegate]) {
				extractedReport.delegates[delegate][node] = BigNumber.from(
					report.delegates[delegate][node]
				).toHexString();
			}
		}

		const hashedReport = ethers.utils.solidityKeccak256(
			['string'],
			[JSON.stringify(extractedReport).toLowerCase()]
		);

		return hashedReport;
	}
}
