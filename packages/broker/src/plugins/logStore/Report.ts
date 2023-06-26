import {
	LogStoreClient,
	MessageMetadata,
	Stream,
	Subscription,
} from '@logsn/client';
import {
	ProofOfReport,
	SystemMessage,
	SystemMessageType,
} from '@logsn/protocol';
import {
	getNodeManagerContract,
	getReportManagerContract,
} from '@logsn/shared';
import { Logger, scheduleAtInterval } from '@streamr/utils';
import axios from 'axios';
import { BigNumber, ethers, Signer, Wallet } from 'ethers';

import { StrictConfig } from '../../config/config';
import { decompressData } from '../../helpers/decompressFile';

const logger = new Logger(module);
const WAIT_TIME = 10 * 1000;
const REPORT_TRESHOLD_MULTIPLIER = 0.5;

export class ReportPoller {
	private readonly poolConfig: StrictConfig['pool'];
	private readonly logStoreClient: LogStoreClient;
	private readonly systemStream: Stream;
	private readonly signer: Signer;

	private reportTimeout: NodeJS.Timeout | undefined;
	private latestBundle: number;
	private reportsBuffer: Array<ProofOfReport>;
	private subscription: Subscription | undefined;

	// define contracts

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
		this.reportsBuffer = [];
	}

	async start(abortSignal: AbortSignal): Promise<void> {
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

	async poll(): Promise<void> {
		// get the report manager contract
		const reportManager = await getReportManagerContract(this.signer as Wallet);
		const latestBundle = await this.fetchPoolLatestBundle();

		// ensure this poller has seen at least 1 bundles cycle before it can start processing
		// so nodes who join halfway through the process, wait for the next round before starting
		if (latestBundle > this.latestBundle && this.latestBundle > 0) {
			// theres a new bundle that should be processed
			const reportInformation = await this.fetchReportData(latestBundle);
			// do not process this report if it has been submitted
			const latestReport = await reportManager.getLastReport();
			if (latestReport.id === reportInformation.id) return;
			// clear buffer/timeout/subscription and process the report information gotten
			this.cleanUpPoller();
			// process a new report
			await this.processNewReport(reportInformation);
		}
		// set the latest bundle
		this.latestBundle = Math.max(latestBundle, this.latestBundle);
	}

	private async tryPoll(): Promise<void> {
		try {
			logger.info(`Polling for a new report at ${new Date()}`);
			await this.poll();
		} catch (err) {
			logger.warn(`error when trying to poll report: ${err}`);
		}
	}

	private async cleanUpPoller() {
		clearTimeout(this.reportTimeout!);
		this.reportsBuffer = [];
		this.subscription?.unsubscribe();
	}

	// poll kyve url for information on how many bundles have been finalized by tthis pool
	async fetchPoolLatestBundle() {
		logger.info(`Fetching the pool information to get latest bundle`);
		const { data: response } = await axios.get(
			`${this.poolConfig.url}/kyve/query/v1beta1/pool/${this.poolConfig.id}`
		);
		const { total_bundles: totalBundles } = response.pool.data;
		return totalBundles - 1;
	}

	// using the bundle id, fetch information about this bundle
	async fetchReportData(bundleId: number) {
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
		if (!reportJson.value.r) throw Error('Report not found in bundle');
		return reportJson.value.r;
	}

	// process the new report json provided
	async processNewReport(report: Record<string, any>) {
		logger.info(`Processing New report ${report.id}`);
		// define contracts
		const signer = this.signer as Wallet;
		const nodeManagerContract = await getNodeManagerContract(signer);
		const reportManagercontract = await getReportManagerContract(signer);
		// define contracts

		// get important variables from contract
		const allActiveNodes = await nodeManagerContract.nodeAddresses();
		logger.info(`${allActiveNodes.length} active nodes:${allActiveNodes}`);
		const blockBuffer = (
			await reportManagercontract.reportBlockBuffer()
		).toNumber();
		const orderedReporters = await reportManagercontract.getReporters();
		logger.info(`nodes ordered:${orderedReporters}`);
		let isProcessing = false;

		// wrap it in a promise to resolve the listne
		const response = await new Promise((resolve, reject) => {
			this.logStoreClient
				.subscribe(
					this.systemStream,
					async (content: any, metadata: MessageMetadata) => {
						logger.info(`message recieved from ${metadata.publisherId}`);
						// do not process your message, but make an exception if theres only one node in the network
						const rawContent = SystemMessage.deserialize(
							content
						) as ProofOfReport;
						// validate its only reports we want to process in this listener
						if (rawContent.messageType !== SystemMessageType.ProofOfReport)
							return;
						// for each gotten, cache
						this.reportsBuffer.push(rawContent);
						logger.info(
							`Recieved ${this.reportsBuffer.length} of ${Math.ceil(
								allActiveNodes.length * REPORT_TRESHOLD_MULTIPLIER
							)} required submissions`
						);

						const waitTillTurnOrReport = async () => {
							// check if this node can submit a report
							const nodeCanReport = await this.nodeCanSubmitReport(
								report,
								orderedReporters,
								blockBuffer
							);
							logger.info(
								`Node ${nodeCanReport ? 'can' : 'cannot'} submit report`
							);
							// everytime we get a new signature
							// confirm if this node can submit a report
							// and more than half the nodes have submitted
							if (
								nodeCanReport &&
								!isProcessing &&
								this.reportsBuffer.length >=
									Math.ceil(allActiveNodes.length * REPORT_TRESHOLD_MULTIPLIER)
							) {
								isProcessing = true;
								logger.info('Processing report to send as transaction');
								// submit the actual report
								const formattedReport = await this.formatReportForContract(
									report
								);
								try {
									const submitReportTx = await reportManagercontract.report(
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
										`Report submitted to the contract on tx:${submitReportTx.hash}; about to process report`
									);
									// process the newly submitted transactions
									// ? what happens if for any reason a report is submitted sucesfully
									// ? but encounters an error when processed i.e if a consumer/storer is not staked to a stream
									const processReportTx =
										await nodeManagerContract.processReport(report.id);
									await processReportTx.wait();
									logger.info(
										`Report:${report.id} processed on tx:${submitReportTx.hash};`
									);
									resolve([submitReportTx, processReportTx]);
								} catch (err) {
									logger.error(err);
									logger.warn(
										`There was an error submitting the report, trying again in ${WAIT_TIME}ms`
									);
									// ? to try again or stop on error in submitting
									// this.reportTimeout = setTimeout(
									// 	waitTillTurnOrReport,
									// 	WAIT_TIME
									// );
									reject(err);
								} finally {
									isProcessing = false;
								}
							} else if (
								!nodeCanReport &&
								!isProcessing &&
								this.reportsBuffer.length === allActiveNodes.length
							) {
								// if we have all the signatures then keep trying until node can submit or a new report is available and time timeout is cleared
								// ? there should be no need for this timeout as this block is only called once per node per report, just to be safe?
								// clearTimeout(this.reportTimeout!);
								this.reportTimeout = setTimeout(
									waitTillTurnOrReport,
									WAIT_TIME
								);
								logger.info(`Waiting for ${WAIT_TIME}ms to try again`);
							}
						};
						waitTillTurnOrReport();
					}
				)
				.then(async (subscription: Subscription) => {
					this.subscription = subscription;
					await this.publishReport(report);
				})
				.catch((err: Error) => {
					reject(err);
				});
		});
		// close up the subscriber event after this round of reports are over
		this.subscription?.unsubscribe();
		return response;
	}

	async publishReport(report: Record<string, any>) {
		// put this call into a method to publish a report which handles all of these
		// hash the report
		logger.info('Publishing a report to the network');
		const brokerAddress = await this.signer.getAddress();
		const reportHash = this.hashReport(report);
		logger.info(`hashed report:${reportHash}`);
		// sign the hash
		const signature = await this.signer.signMessage(
			ethers.utils.arrayify(reportHash)
		);
		logger.info(`signed report:${signature}`);

		// publish the report to the system stream
		const proofOfReport = new ProofOfReport({
			address: brokerAddress,
			signature,
			hash: reportHash,
		});
		await this.logStoreClient.publish(
			this.systemStream,
			proofOfReport.serialize()
		);
		logger.info(`${proofOfReport} published to system stream`);
	}

	async nodeCanSubmitReport(
		report: Record<string, any>,
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

	hashReport(report: Record<string, any>) {
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
		for (const nodeKey of Object.keys(report.nodes)) {
			extractedReport.nodes[nodeKey] = BigNumber.from(
				report.nodes[nodeKey]
			).toHexString();
		}
		for (const delegateKey of Object.keys(report.delegates)) {
			extractedReport.delegates[delegateKey] = {};
			for (const nodeKey of Object.keys(report.delegates[delegateKey])) {
				extractedReport.delegates[delegateKey][nodeKey] = BigNumber.from(
					report.delegates[delegateKey][nodeKey]
				).toHexString();
			}
		}

		const hashedReport = ethers.utils.solidityKeccak256(
			['string'],
			[JSON.stringify(extractedReport).toLowerCase()]
		);

		return hashedReport;
	}

	async formatReportForContract(report: Record<string, any>) {
		const output = {
			id: report.id,
			blockHeight: report.height,
			// -- streams
			streams: report.streams.map(({ id }: { id: string }) => id.toLowerCase()),
			writeCaptureAmounts: report.streams.map(
				({ capture }: { capture: BigNumber }) => capture
			),
			writeBytes: report.streams.map(({ bytes }: { bytes: number }) => bytes),
			// -- streams

			// -- consumers
			readConsumerAddresses: report.consumers.map(
				({ id }: { id: number }) => id
			),
			readCaptureAmounts: report.consumers.map(
				({ capture }: { capture: BigNumber }) => capture
			),
			readBytes: report.consumers.map(({ bytes }: { bytes: number }) => bytes),
			// -- consumers

			// -- nodes
			nodes: Object.keys(report.nodes),
			nodeChanges: Object.values(report.nodes) as number[],
			// -- nodes

			// -- delegates
			delegates: Object.keys(report.delegates),
			delegateNodes: Object.keys(report.delegates).map((delegate) =>
				Object.keys(report.delegates[delegate])
			),
			delegateNodeChanges: Object.keys(report.delegates).map((delegate) =>
				Object.values(report.delegates[delegate])
			) as number[][],
			// -- delegates
			treasurySupplyChange: report.treasury,
			// -- signature and broker validations
			addresses: this.reportsBuffer.map((buffer) => buffer.address),
			signatures: this.reportsBuffer.map((buffer) => buffer.signature),
			// -- signature and broker validations
		};
		return output;
	}
}
