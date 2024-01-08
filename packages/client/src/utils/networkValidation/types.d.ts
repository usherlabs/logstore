import { HttpApiQueryDict, QueryType } from '../../Queries';

export type QueryInputPayload = {
	queryType: QueryType;
	query: HttpApiQueryDict;
	streamPartId: StreamPartID;
};
