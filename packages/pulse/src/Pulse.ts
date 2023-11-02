import { LogStoreClient, Stream, StreamPermission } from '@logsn/client';

const PULSE_STREAM_ID = '/pulse';
const PULSE_INTERVAL_MS = 1 * 1000;

export class Pulse {
	private _stream: Stream | undefined;
	private _interval: NodeJS.Timer | undefined;

	private get stream(): Stream {
		if (!this._stream) {
			throw new Error('Pulse stream is not initialized');
		}

		return this._stream;
	}

	constructor(private readonly client: LogStoreClient) {
		//
	}

	async init() {
		this._stream = await this.client.getStream(PULSE_STREAM_ID);
	}

	async createStream(stakeAmount: bigint) {
		this._stream = await this.client.getOrCreateStream({
			id: PULSE_STREAM_ID,
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
		}, PULSE_INTERVAL_MS);
	}

	stop() {
		clearInterval(this._interval);
	}

	async beat() {
		const content = {
			timestamp: Date.now(),
		};

		await this.client.publish(this.stream, content);
		console.debug('Published Pulse message', content);
	}
}
