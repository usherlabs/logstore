import LogStoreClient, {
	CONFIG_TEST,
	LogStoreClientConfig,
	Stream,
	StreamPermission,
} from '@logsn/client';

import { getEvmPrivateKey } from './env-config';

const HEARTBEAT_STREAM_ID = '/heartbeat';
const HEARTBEAT_INTERVAL = 1 * 1000;
const HEARTBEAT_STORE_STAKE: bigint =
	BigInt(1_000_000_000_000_000_000_000_000_000_000);

export class Heartbeat {
	private client: LogStoreClient;
	private _stream: Stream | undefined;
	private interval: NodeJS.Timer | undefined;

	private get stream(): Stream {
		if (!this._stream) {
			throw new Error('Heartbeat stream is not initialized');
		}

		return this._stream;
	}

	constructor() {
		const config: LogStoreClientConfig = {
			...CONFIG_TEST,
			auth: {
				privateKey: getEvmPrivateKey(),
			},
		};

		this.client = new LogStoreClient(config);
	}

	async init() {
		this._stream = await this.client.getOrCreateStream({
			id: HEARTBEAT_STREAM_ID,
		});

		const hasPublicSubscribePermission = await this._stream.hasPermission({
			public: true,
			permission: StreamPermission.SUBSCRIBE,
		});

		if (!hasPublicSubscribePermission) {
			await this._stream.grantPermissions({
				public: true,
				permissions: [StreamPermission.SUBSCRIBE],
			});

			await this.client.stakeOrCreateStore(
				this.stream.id,
				HEARTBEAT_STORE_STAKE
			);
		}
	}

	start() {
		this.interval = setInterval(() => {
			void this.beat().then();
		}, HEARTBEAT_INTERVAL);
	}

	stop() {
		clearInterval(this.interval);
	}

	async beat() {
		const content = {
			timestamp: Date.now(),
		};

		await this.client.publish(this.stream, JSON.stringify(content));
		console.debug('Published Heartbeat message', content);
	}
}
