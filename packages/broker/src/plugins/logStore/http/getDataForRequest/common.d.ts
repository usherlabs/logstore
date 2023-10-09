import { QueryRequest } from '@logsn/protocol';

export type QueryRequestBag =
	| { queryRequest: QueryRequest }
	| { error: { message: string } };
