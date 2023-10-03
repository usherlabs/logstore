import { LogStoreNodeManager, LogStoreReportManager } from '@logsn/contracts';
import {
	ProofOfReport,
	SystemMessage,
	SystemMessageType,
	SystemReport,
} from '@logsn/protocol';
import {
	getNodeManagerContract,
	getReportManagerContract,
} from '@logsn/shared';
import { Logger, scheduleAtInterval } from '@streamr/utils';
import axios from 'axios';
import { ethers, Signer, Wallet } from 'ethers';

import { StrictConfig } from '../../config/config';
import { decompressData } from '../../helpers/decompressFile';
import { BroadbandPublisher } from '../../shared/BroadbandPublisher';
import { BroadbandSubscriber } from '../../shared/BroadbandSubscriber';
import { KyvePool } from './KyvePool';
import { ReportPoll } from './ReportPoll';

const logger = new Logger(module);
const REPORT_TRESHOLD_MULTIPLIER = 0.5;

export class ReportPoller {
	protected readonly kyvePool: KyvePool;
	private readonly poolConfig: StrictConfig['pool'];
	private readonly signer: Signer;
	private readonly publisher: BroadbandPublisher;
	private readonly subscriber: BroadbandSubscriber;

	private reportManager!: LogStoreReportManager;
	private nodeManager!: LogStoreNodeManager;

	private polls: Record<string, ReportPoll> = {};

	private latestBundle: number;

	private seqNum: number = 0;

	constructor(
		kyvePool: KyvePool,
		config: Pick<StrictConfig, 'pool'>,
		signer: Signer,
		publisher: BroadbandPublisher,
		subscriber: BroadbandSubscriber
	) {
		this.kyvePool = kyvePool;
		this.poolConfig = config.pool;
		this.latestBundle = 0;
		this.signer = signer;
		this.publisher = publisher;
		this.subscriber = subscriber;
	}

	public async start(abortSignal: AbortSignal): Promise<void> {
		this.reportManager = await getReportManagerContract(this.signer as Wallet);
		this.nodeManager = await getNodeManagerContract(this.signer as Wallet);

		await this.subscriber.subscribe(this.onMessage.bind(this));

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
		const { totalBundles } = await this.kyvePool.fetchPoolData();
		const latestBundle = totalBundles - 1;

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

	// using the bundle id, fetch information about this bundle
	public async fetchReportData(bundleId: number): Promise<SystemReport> {
		const finalizedBundle = await this.kyvePool.fetchFinalizedBundle(bundleId);
		const arweaveStorageId = finalizedBundle.storageId;
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

		const proofOfReport = await poll.report.toProof(this.seqNum++, this.signer);
		await this.publisher.publish(proofOfReport.serialize());
		logger.info(
			`Proof of report ${poll.report.id} published to system stream`,
			proofOfReport
		);
	}

	private async onMessage(content: unknown) {
		const systemMessage = SystemMessage.deserialize(content);

		if (systemMessage.messageType !== SystemMessageType.ProofOfReport) {
			return;
		}

		const proofOfReport = systemMessage as ProofOfReport;
		await this.processProofOfReport(proofOfReport);
	}

	private async submitReport(poll: ReportPoll & { report: SystemReport }) {
		const contractParams = poll.report.toContract();

		const addressesParam = poll.proofs.map((proof) => proof.address);
		const signaturesParam = poll.proofs.map((proof) => proof.signature);
		const timestampsParam = poll.proofs.map((proof) => proof.timestamp);

		// ! Do not use JSON.stringify with BigInt
		const { events: _, ...serializedReport } = poll.report.serialize();
		logger.info(
			`Submitting ReportManager.sol.report - Serialized Report (no events) = ${JSON.stringify(
				serializedReport
			)}`
		);
		logger.info(
			`Submitting ReportManager.sol.report - Contract Params = ${JSON.stringify(
				[
					contractParams[0],
					contractParams[1],
					contractParams[2],
					contractParams[3].map((v) => Number(v)),
					contractParams[4],
					contractParams[5],
					contractParams[6].map((v) => Number(v)),
					contractParams[7],
					contractParams[8],
					contractParams[9].map((v) => Number(v)),
					contractParams[10],
					contractParams[11],
					contractParams[12].map((v) => v.map((v2) => Number(v2))),
					Number(contractParams[13]),
				]
			)}, Addresses = ${addressesParam}, Signatures = ${signaturesParam}, Timestamps = ${timestampsParam}`
		);

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

	private async processProofOfReport(proof: ProofOfReport) {
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
