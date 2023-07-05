import type { StreamrClient } from '@logsn/streamr-client';

export class StreamrClientSingleton {
	private static _client: typeof StreamrClient | null = null;

	static setClass(client: typeof StreamrClient) {
		this._client = client;
	}

	static getClass(): typeof StreamrClient {
		if (this._client) {
			return this._client;
		}
		throw new Error('StreamrClient is not set.');
	}
}
