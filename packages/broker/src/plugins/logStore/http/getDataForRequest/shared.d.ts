import { QueryRequest } from '@logsn/protocol';

export type DataForRequest =
	| { queryRequest: QueryRequest }
	| { error: { message: string } };
