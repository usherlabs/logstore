export type LogStoreClientErrorCode =
	| 'MISSING_PERMISSION'
	| 'NO_STORAGE_NODES'
	| 'INVALID_ARGUMENT'
	| 'CLIENT_DESTROYED'
	| 'PIPELINE_ERROR'
	| 'UNSUPPORTED_OPERATION'
	| 'UNKNOWN_ERROR';

export class LogStoreClientError extends Error {
	public readonly code: LogStoreClientErrorCode;

	constructor(message: string, code: LogStoreClientErrorCode) {
		super(message);
		this.code = code;
		this.name = this.constructor.name;
	}
}
