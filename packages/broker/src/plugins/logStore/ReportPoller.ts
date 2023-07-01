import { LogStoreClient, Stream } from '@logsn/client';
import { LogStoreNodeManager, LogStoreReportManager } from '@logsn/contracts';
import { ProofOfReport, SystemReport } from '@logsn/protocol';
import {
	getNodeManagerContract,
	getReportManagerContract,
} from '@logsn/shared';
import { Logger, scheduleAtInterval } from '@streamr/utils';
import axios from 'axios';
import { ethers, Signer, Wallet } from 'ethers';

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
			const systemReport = await this.fetchReportData(latestBundle);
			// do not process this report if it has been submitted
			const latestReport = await this.reportManager.getLastReport();
			if (latestReport.id === systemReport.id) {
				return;
			}

			const hash = systemReport.toHash();
			let poll = this.polls[hash];
			if (poll) {
				poll.assignReport(systemReport);
			} else {
				poll = new ReportPoll({
					reportOrProof: systemReport,
					hash: hash,
					onProcessCb: async (p) => await this.processPoll(p),
					onCompleteCb: () => delete this.polls[poll.hash],
				});
				this.polls[hash] = poll;
			}

			await this.publishProof(poll as ReportPoll & { report: SystemReport });
		}
		// set the latest bundle
		this.latestBundle = Math.max(latestBundle, this.latestBundle);
	}

	// Called when all Proofs are received for a particular ReportPoll
	private async processPoll(
		poll: ReportPoll & { report: SystemReport }
	): Promise<ethers.ContractTransaction[] | undefined> {
		// get important variables from contract
		const allActiveNodes = await this.nodeManager.nodeAddresses();
		logger.info(`${allActiveNodes.length} active nodes:${allActiveNodes}`);
		// everytime we get a new signature
		// confirm if this node can submit a report
		// and more than half the nodes have submitted
		if (
			poll.proofs.length >=
			Math.ceil(allActiveNodes.length * REPORT_TRESHOLD_MULTIPLIER)
		) {
			const nodeCanReport = await this.reportManager.canReport(
				poll.proofs.map((p) => p.timestamp)
			);
			logger.info(`Node ${nodeCanReport ? 'can' : 'cannot'} submit report`);
			if (nodeCanReport) {
				return await this.submitReport(poll);
			}
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
	private async fetchPoolLatestBundle(): Promise<number> {
		logger.info(`Fetching the pool information to get latest bundle`);
		const { data: response } = await axios.get(
			`${this.poolConfig.url}/kyve/query/v1beta1/pool/${this.poolConfig.id}`
		);
		const { total_bundles: totalBundles } = response.pool.data;
		return totalBundles - 1;
	}

	// using the bundle id, fetch information about this bundle
	private async fetchReportData(bundleId: number): Promise<SystemReport> {
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
		const lastItem = unzippedJson.at(-1);
		if (!lastItem.value.r) {
			logger.error('Report not found in bundle');
			throw Error('Report not found in bundle');
		}
		const { r: reportJson } = lastItem.value;
		let systemReport: SystemReport;
		try {
			systemReport = new SystemReport(reportJson, reportJson.v);
		} catch (e) {
			logger.error('Report in bundle is invalid', { reportJson });
			throw e;
		}
		return systemReport;
	}

	private async publishProof(poll: ReportPoll & { report: SystemReport }) {
		// put this call into a method to publish a report which handles all of these
		// hash the report
		logger.info(
			`Publishing proof of report ${poll.report.id} (hash: ${poll.hash})`
		);

		const proofOfReport = await poll.report.toProof(this.signer);
		await this.logStoreClient.publish(
			this.systemStream,
			proofOfReport.serialize()
		);
		logger.info(
			`Proof of report ${poll.report.id} published to system stream`,
			proofOfReport
		);
	}

	private async submitReport(poll: ReportPoll & { report: SystemReport }) {
		const contractParams = poll.report.toContract();
		logger.info(
			`reportManagerContract.report params: ${JSON.stringify(contractParams)}`
		);

		const addressesParam = poll.proofs.map((proof) => proof.address);
		const signaturesParam = poll.proofs.map((proof) => proof.signature);
		const timestampsParam = poll.proofs.map((proof) => proof.timestamp);

		const submitReportTx = await this.reportManager.report(
			contractParams[0],
			contractParams[1],
			contractParams[2],
			contractParams[3],
			contractParams[4],
			contractParams[5],
			contractParams[6],
			contractParams[7],
			contractParams[8],
			contractParams[9],
			contractParams[10],
			contractParams[11],
			contractParams[12],
			contractParams[13],
			addressesParam,
			timestampsParam,
			signaturesParam
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
}
