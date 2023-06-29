import { ProofOfReport, SystemReport } from '@logsn/protocol';
import { Logger } from '@streamr/utils';
import { ethers } from 'ethers';

const logger = new Logger(module);

const POLL_TIME = 60 * 1000;

interface ReportPollOptions {
	reportOrProof: SystemReport | ProofOfReport;
	hash: string;
	onProcessCb: (
		poll: ReportPoll & { report: SystemReport }
	) => Promise<ethers.ContractTransaction[] | undefined>;
	onCompleteCb: () => void;
}

export class ReportPoll {
	public report: SystemReport | undefined;
	public readonly hash: string;
	private readonly onProcessCb: (
		poll: ReportPoll & { report: SystemReport }
	) => Promise<ethers.ContractTransaction[] | undefined>;
	private readonly onCompleteCb: () => void;
	private timeout: NodeJS.Timeout;
	public proofs: ProofOfReport[] = [];
	private isProcessing: boolean = false;

	constructor(options: ReportPollOptions) {
		if (options.reportOrProof instanceof ProofOfReport) {
			logger.info(
				`Starting new poll for unknown report by its hash ${options.hash}`
			);
			this.proofs.push(options.reportOrProof);
		} else {
			logger.info(`Starting new poll for report ${options.reportOrProof.id}`);
			this.report = options.reportOrProof;
		}

		this.hash = options.hash;
		this.onProcessCb = options.onProcessCb;
		this.onCompleteCb = options.onCompleteCb;

		this.timeout = setTimeout(() => {
			this.runProcess(true);
		}, POLL_TIME);
	}

	public assignReport(report: SystemReport) {
		logger.info(`Assigning report ${report.id} to poll {hash: ${this.hash})`);
		this.report = report;
	}

	public addProof(proof: ProofOfReport) {
		if (this.report) {
			logger.info(
				`Adding new proof of report ${this.report.id} {hash: ${proof.hash})`
			);
		} else {
			logger.info(`Adding new proof of unknown report (hash: ${proof.hash})`);
		}

		this.proofs.push(proof);
		this.runProcess();
	}

	// Called on each proof reception
	private runProcess(isFinal: boolean = false) {
		if (!this.report) {
			if (isFinal) {
				logger.warn(
					`Timeout reached for polling of unknown report (hash: ${this.hash})`
				);
			}
			return;
		}

		logger.info(`Processing poll for report ${this.report.id} `);
		if (!this.isProcessing) {
			this.isProcessing = true;
			this.onProcessCb(this as ReportPoll & { report: SystemReport })
				.then((result) => {
					if (result || isFinal) {
						logger.info(`Completed poll for report ${this.report!.id}`);

						clearTimeout(this.timeout);
						this.onCompleteCb();
					}
				})
				.catch((err) => {
					logger.error(err);
					logger.error(`Failed to process poll for report ${this.report!.id}`);
				})
				.finally(() => {
					this.isProcessing = false;
				});
		}
	}
}
