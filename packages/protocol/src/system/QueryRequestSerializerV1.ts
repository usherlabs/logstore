import { MessageRef } from '@streamr/protocol';
import { Serializer } from '../abstracts/Serializer';
import {
	QueryFromOptions,
	QueryLastOptions,
	QueryOptions,
	QueryRangeOptions,
	QueryRequest,
	QueryType,
} from './QueryRequest';
import { SystemMessage, SystemMessageType } from './SystemMessage';

const VERSION = 1;

export default class QueryRequestSerializerV1 extends Serializer<QueryRequest> {
	toArray(message: QueryRequest): any[] {
		const result: any[] = [
			VERSION,
			SystemMessageType.QueryRequest,
			message.seqNum,
			message.requestId,
			message.consumerId,
			message.streamId,
			message.partition,
			message.queryOptions.queryType,
		];

		switch (message.queryOptions.queryType) {
			case QueryType.Last:
				// eslint-disable-next-line no-case-declarations
				const lastOptions = message.queryOptions as QueryLastOptions;
				result.push(lastOptions.last);
				break;
			case QueryType.From:
				// eslint-disable-next-line no-case-declarations
				const fromOptions = message.queryOptions as QueryFromOptions;
				result.push(fromOptions.from.timestamp);
				result.push(fromOptions.from.sequenceNumber);
				result.push(fromOptions.publisherId);
				break;
			case QueryType.Range:
				// eslint-disable-next-line no-case-declarations
				const rangeOptions = message.queryOptions as QueryRangeOptions;
				result.push(rangeOptions.from.timestamp);
				result.push(rangeOptions.from.sequenceNumber);
				result.push(rangeOptions.to.timestamp);
				result.push(rangeOptions.to.sequenceNumber);
				result.push(rangeOptions.msgChainId);
				result.push(rangeOptions.publisherId);
				break;
		}

		return result;
	}

	fromArray(arr: any[]): QueryRequest {
		const [
			version,
			_messageType,
			seqNum,
			requestId,
			consumerId,
			streamId,
			partition,
			queryType,
			...queryOptionsArr
		] = arr;

		let queryOptions: QueryOptions;
		switch (queryType as QueryType) {
			case QueryType.Last:
				queryOptions = {
					queryType,
					last: queryOptionsArr[0]
				};
				break;
			case QueryType.From:
				queryOptions = {
					queryType,
					from: new MessageRef(queryOptionsArr[0], queryOptionsArr[1]),
					publisherId: queryOptionsArr[2],
				};
				break;
			case QueryType.Range:
				queryOptions = {
					queryType,
					from: new MessageRef(queryOptionsArr[0], queryOptionsArr[1],),
					to: new MessageRef(queryOptionsArr[2], queryOptionsArr[3]),
					msgChainId: queryOptionsArr[4],
					publisherId: queryOptionsArr[5],
				};
				break;
		}

		return new QueryRequest({
			version,
			seqNum,
			requestId,
			consumerId,
			streamId,
			partition,
			queryOptions,
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.QueryRequest,
	new QueryRequestSerializerV1()
);
