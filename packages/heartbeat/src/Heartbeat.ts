import { LogStoreClient, Stream, StreamPermission } from '@logsn/client';

const HEARTBEAT_STREAM_ID = '/heartbeat';
const HEARTBEAT_INTERVAL_MS = 1 * 1000;

export class Heartbeat {
	private _stream: Stream | undefined;
	private _interval: NodeJS.Timer | undefined;

	private get stream(): Stream {
		if (!this._stream) {
			throw new Error('Heartbeat stream is not initialized');
		}

		return this._stream;
	}

	constructor(private readonly client: LogStoreClient) {
		//
	}

	async init() {
		this._stream = await this.client.getStream(HEARTBEAT_STREAM_ID);
	}

	async createStream(stakeAmount: bigint) {
		this._stream = await this.client.getOrCreateStream({
			id: HEARTBEAT_STREAM_ID,
		});

		await this._stream.grantPermissions({
			public: true,
			permissions: [StreamPermission.SUBSCRIBE],
		});

		await this.client.stakeOrCreateStore(this._stream.id, stakeAmount);
	}

	start() {
		process.on('SIGTERM', async () => {
			console.info('SIGTERM signal received.');
			await this.stop();
		});

		this._interval = setInterval(async () => {
			await this.beat();
		}, HEARTBEAT_INTERVAL_MS);
	}

	stop() {
		clearInterval(this._interval);
	}

	async beat() {
		const content = {
			timestamp: Date.now(),
		};

		await this.client.publish(this.stream, content);
		console.debug('Published Heartbeat message', content);
	}
}
