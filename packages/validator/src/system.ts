import ethers from 'ethers';
import StreamrClient from 'streamr-client';
import { MessageMetadata } from 'streamr-client';

// import abi from '@concertodao/logstore-contracts';
import {
	LogStoreNodeManagerContractAddress,
	SteamrStreamRegistryContractAddress,
	SystemStreamId,
} from './utils/constants';

enum SystemMessageType {
	MESSAGE = 1,
	BROADCAST = 2,
	QUERY = 3,
}

type SystemMessageContent = {
	id: string; // ID of the message
	type: SystemMessageType;
	hash: string;
	query?: string;
	payload?: {
		content: unknown;
		metadata: MessageMetadata;
	};
};

// type SystemMessage = {
// 	content: SystemMessageContent;
// 	metadata: MessageMetadata;
// };

type Report = {
	id: string; // Bundle id -- a report will submit for every bundle.
	// networks: {
	// 	broker: string;
	// 	validator: string;
	// };
	blockHeight: number;
	fees: {
		kyve: number; // in $KYVE
		ar: number; // in AR token (ARWEAVE)
	};
	nodes: {
		address: string;
		streams: string[]; // An array of streams being identified
		observations: number; // Successful observations
		missed: number; // Missed observations
		bytesObserved: number;
		bytesQueried: number;
	}[];
};

export default class SystemMesh {
	private streamr = new StreamrClient();
	private reports: Report[] = [];
	private streams: string[] = [];
	// private messages: SystemMessage[] = [];
	private activeBundleId = '';

	constructor(private sources = []) {}

	public async start() {
		// Start listening to system messages.
		this.streamr.subscribe(SystemStreamId, this.onMessage);

		// Produce a list of logstores -- and there associated streams
		// const contract = new ethers.Contract(address, abi, provider.getSigner(0));
		// let eventFilter = contract.filters.ContractEvent();
		// let events = await contract.queryFilter(eventFilter);
	}

	public onMessage(content: SystemMessageContent, metadata: MessageMetadata) {
		// Produce a report for every active bundle -- reports are produced over a series of messages.
		// this.messages.push({ content, metadata });

		const report = this.getActiveReport();
		const node = report.nodes.find((n) => n.address === metadata.publisherId);
		if (node) {
		} else {
			// report.nodes.push({
			// 	address: metadata.publisherId,
			// 	streams: [],
			// });
		}
	}

	public getReports(): Report[] {
		return this.reports;
	}

	public getLastReport(): Report {
		return this.reports.length > 0 ? this.reports[0] : null;
	}

	public getActiveReport() {
		if (this.reports.length > 0) {
			const reportIndex = this.reports.findIndex(
				(r) => r.id === this.activeBundleId
			);
			if (reportIndex >= 0) {
				return this.reports[reportIndex];
			}
		}

		return null;
	}

	public newReport(id: string) {
		if (id !== this.activeBundleId) {
			const report = {
				id,
				nodes: [],
			};
			this.reports.push(report);
		}
		this.setActiveBundle(id);
	}

	public setActiveBundle(id: string) {
		this.activeBundleId = id;
	}

	public setSources(sources: string[]) {
		this.sources = sources;
	}

	public pick(): Report {
		const report = this.reports.shift();
		return report;
	}
}
