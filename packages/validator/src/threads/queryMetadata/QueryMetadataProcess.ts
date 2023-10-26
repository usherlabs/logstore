import { QueryMetadataRequest, QueryMetadataResponse, SystemMessage } from '@logsn/protocol';
import { MessageMetadata } from '@logsn/protocol/src/interfaces/MessageMetadata';
import { BrandedString, EthereumAddress, toEthereumAddress } from '@streamr/utils';
import { randomUUID } from 'crypto';
import { BehaviorSubject, distinctUntilChanged, filter } from 'rxjs';



import { IRuntimeExtended } from '../../types';
import { ActivityTimeout } from '../ActivityTimeout';


// ====================== TYPES ======================

type State = 'active' | 'ready' | 'flushed' | 'error';
type SeqNum = number;
type RequestId = BrandedString<'requestId'>;

type MetadataRequestProgress = {
	responses: Map<SeqNum, QueryMetadataResponse>;
	// when we receive a message that is marked as 'isLast', we register the length as well
	seqLength?: number;
};

/**
 * Multiple processes might be initiated for the same 'from' and 'to' keys if multiple requests are simultaneously conducted.
 * However, this is not problematic as the processes are reusable.
 * Therefore, only the first completed process for a node is of significance.
 *
 * The only problematic part is mixing seqNum from different processes.
 * That's why we keep track of the requestId as well.
 */
type MetadataRequestProgressById = Map<RequestId, MetadataRequestProgress>;
type MetadataRequestsProgressByNode = Map<
	EthereumAddress,
	MetadataRequestProgressById
>;

// ====================== CONSTANTS ======================

// ====================== CLASS ======================
export class QueryMetadataProcess {
	private requestId: string;
	private state = new BehaviorSubject<State>('active');
	private activityTimeout: ActivityTimeout;
	private minimumRequestStartTime: number;

	private nodeProgressMap: MetadataRequestsProgressByNode = new Map();
	// marks if this process is ongoing, so we don´t need to start a fresh process, only if the ongoing one isn´t good for us
	private ongoingProcess = false;

	constructor(
		private readonly core: IRuntimeExtended,
		public readonly fromKey: number,
		public readonly toKey: number
	) {
		this.minimumRequestStartTime = core.listener.startTimestamp;
		this.setupTimeout();
	}

	// ====================== PUBLIC METHODS ======================
	public fromState(state: State | State[]) {
		return this.state.pipe(
			filter((s) => {
				if (Array.isArray(state)) {
					return state.includes(s);
				}
				return s === state;
			}),
			// emit only initial state or when state changes
			distinctUntilChanged()
		);
	}

	/**
	 * Why we need this method and not start immediately on constructor?
	 *
	 *  it's not necessary to start new process if another validator already started it
	 *  we may detect this if we receive a request or response message before calling the endpoint
	 */
	public async startNewProcessIfNeeded() {
		if (this.ongoingProcess) {
			return;
		}
		await this.callStartRequestEndpoint();
	}

	public handleResponseMessage(
		message: QueryMetadataResponse,
		metadata: MessageMetadata
	) {
		// should stop if not on active state
		const state = this.state.getValue();
		if (state !== 'active') {
			return undefined;
		}
		// we received a message, so this process is ongoing
		this.ongoingProcess = true;
		this.activityTimeout.update();
		this.registerQueryProgress(
			message,
			toEthereumAddress(metadata.publisherId)
		);
	}

	public async handleRequestMessage(
		_message: QueryMetadataRequest,
		metadata: MessageMetadata
	) {
		// should stop if not on active state
		const state = this.state.getValue();
		if (state !== 'active') {
			return undefined;
		}
		// we received a message, so this process is ongoing
		this.ongoingProcess = true;
		this.activityTimeout.update();
		await this.validateParticipation({ requestTimestamp: metadata.timestamp });
	}

	/**
	 * We flush instead of returning the payloads directly because we need to make sure
	 * that we don't overload the memory.
	 *
	 * Metadata should be used from QueryMetadataManager's cache
	 */
	public flushMetadataPayloads(): Map<
		EthereumAddress,
		[SystemMessage, MessageMetadata][]
	> {
		// if this process isn't complete, it should fail
		const state = this.state.getValue();
		if (state !== 'ready') {
			throw new Error(
				`Cannot get metadata from ${state} process, only from ready`
			);
		}

		const payloads = new Map<
			EthereumAddress,
			[SystemMessage, MessageMetadata][]
		>();

		for (const nodeAddress of this.nodeProgressMap.keys()) {
			const progressByRequestId = this.nodeProgressMap.get(nodeAddress);
			const completeRequest = Array.from(progressByRequestId.values()).find(
				isRequestComplete
			);

			if (!completeRequest) {
				// here we don't mind about these brokers being online or not.
				// if they were able to fulfill a whole request, that's what we want
				// so let's just continue if we don't find a complete on this node, probably it wasn't complete
				continue;
			}

			const payload = [];

			const orderedResponses = Array.from(
				completeRequest.responses.values()
			).sort((a, b) => a.seqNum - b.seqNum);

			for (const response of orderedResponses) {
				payload.push(...response.payload);
			}

			payloads.set(nodeAddress, payload);
		}

		const flushedPayloads = new Map(payloads);
		payloads.clear();

		this.state.next('flushed');

		return flushedPayloads;
	}

	// ====================== PRIVATE ======================

	private async callStartRequestEndpoint() {
		this.requestId = randomUUID();
		const from = this.fromKey;
		const to = this.toKey;

		const response = await this.core.managers.node.callEndpoint.proveQueries({
			requestId: this.requestId,
			from,
			to,
		});

		// todo handle response
		// - register the request
		// - if I got a cooldown, let's setup a retry
	}

	private registerQueryProgress(
		message: QueryMetadataResponse,
		nodeAddress: EthereumAddress
	): void {
		const requestId = message.requestId;

		const getOrCreateNodeProgress = () => {
			if (!this.nodeProgressMap.has(nodeAddress)) {
				this.nodeProgressMap.set(nodeAddress, new Map());
			}
			return this.nodeProgressMap.get(nodeAddress);
		};

		const progressByRequestId = getOrCreateNodeProgress();

		const getOrCreateRequestProgress = () => {
			if (!progressByRequestId.has(requestId as RequestId)) {
				progressByRequestId.set(requestId as RequestId, {
					responses: new Map(),
				});
			}
			return progressByRequestId.get(requestId as RequestId);
		};

		const progress = getOrCreateRequestProgress();

		if (progress.responses.has(message.seqNum)) {
			throw new Error(
				`Progress for requestId ${requestId} on node ${nodeAddress} already has a response for seqNum ${message.seqNum}`
			);
		}

		progress.responses.set(message.seqNum, message);
		if (message.isLast) {
			progress.seqLength = message.seqNum + 1;
		}

		if (
			// we will compare to the online brokers when we receive new responses.
			// TODO there are edge cases here to be addressed
			isAllOnlineNodesProgressComplete(
				this.nodeProgressMap,
				this.core.heartbeat.onlineBrokers
			)
		) {
			this.state.next('ready');
		}
	}

	/**
	 * requirements:
	 * - timestamp of a request is greater than the timestamp this validator joined the pool
	 *
	 * we're aware that any request can trigger this, but we're not concerned about it
	 */
	private async validateParticipation({ requestTimestamp }): Promise<void> {
		const listenerStartedAt = this.core.listener.startTimestamp;
		if (requestTimestamp < listenerStartedAt) {
			// invoking new process, as this won't be able to participate the actual
			await this.retry();
		}
	}

	private async retry() {
		this.minimumRequestStartTime = Date.now();
		this.setupTimeout();
		await this.callStartRequestEndpoint();
	}

	private setupTimeout() {
		this.activityTimeout = new ActivityTimeout(async () => {
			await this.retry();
		}, 1000 * 60);
		this.activityTimeout.start();
	}
}

// ====================== UTILITIES ======================

const isRequestComplete = (progress: MetadataRequestProgress): boolean => {
	if (!progress.seqLength) {
		return false;
	}
	return progress.responses.size === progress.seqLength;
};

const isAnyRequestProgressOnNodeComplete = (
	progressByRequestId: MetadataRequestProgressById
): boolean => {
	// let's be explicit about empty values
	if (progressByRequestId.size === 0) {
		return false;
	}
	return Array.from(progressByRequestId.values()).some(isRequestComplete);
};

const isAllOnlineNodesProgressComplete = (
	nodeResponseProgressMap: MetadataRequestsProgressByNode,
	aliveNodes: EthereumAddress[]
): boolean => {
	// do we have all the alive nodes on the map?
	const everyAliveNodesArePresentOnMap = aliveNodes.every((nodeAddress) =>
		nodeResponseProgressMap.has(nodeAddress)
	);

	if (!everyAliveNodesArePresentOnMap) {
		return false;
	}

	// let extract just the alive ones from the map
	const aliveNodesList = Array.from(nodeResponseProgressMap.entries())
		.filter(([nodeAddress]) => aliveNodes.includes(nodeAddress))
		.map(([_nodeAddress, node]) => node);

	return aliveNodesList.every(isAnyRequestProgressOnNodeComplete);
};
