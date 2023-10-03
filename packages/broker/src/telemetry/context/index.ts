import { QueryType } from '@logsn/protocol';
import { AsyncLocalStorage } from 'async_hooks';

type OperationType =
	| 'query_request'
	| 'consensus'
	| 'user_request'
	| 'recovery'
	| 'proof_of_message_stored';

export const ctx = {
	operation: new AsyncLocalStorage<OperationType>(),
	nodeInfo: new AsyncLocalStorage<{ id: string }>(),
	queryType: new AsyncLocalStorage<QueryType>(),
};

export type StoreType<T> = T extends AsyncLocalStorage<infer U> ? U : never;
