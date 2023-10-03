import { QueryType } from '@logsn/protocol';

import { ctx, StoreType } from '../context';
import { generalCounters } from './generalNodeCounters';

type WithoutContext<T> = Omit<T, 'context'>;

type NewMessageEvent = {
	type: 'read' | 'write';
	qty: number;
	context: {
		operation: StoreType<typeof ctx.operation>;
		queryType?: StoreType<typeof ctx.queryType>;
	};
};

type NewBytesEvent = {
	type: 'read' | 'write';
	qty: number;
	context: {
		operation: StoreType<typeof ctx.operation>;
		queryType?: StoreType<typeof ctx.queryType>;
	};
};

type NewQueryEvent = {
	qty: number;
	statusCode: string;
	context: {
		type: QueryType;
		operation: StoreType<typeof ctx.operation>;
	};
};

type NewMessagesReturnedFromQueryEvent = {
	qty: number;
	context: {
		operation: StoreType<typeof ctx.operation>;
		queryType?: StoreType<typeof ctx.queryType>;
	};
};

export const addNewMessageEvent = (event: WithoutContext<NewMessageEvent>) => {
	const operation = ctx.operation.getStore();
	const nodeInfo = ctx.nodeInfo.getStore();
	const queryType = ctx.queryType.getStore();

	return generalCounters[`${event.type}Messages`].add(event.qty, {
		operation,
		nodeId: nodeInfo?.id,
		queryType,
	});
};

export const addNewBytesEvent = (event: WithoutContext<NewBytesEvent>) => {
	const operation = ctx.operation.getStore();
	const nodeInfo = ctx.nodeInfo.getStore();
	const queryType = ctx.queryType.getStore();

	return generalCounters[`${event.type}Bytes`].add(event.qty, {
		operation,
		nodeId: nodeInfo?.id,
		queryType,
	});
};

export const addNewQueryEvent = (event: WithoutContext<NewQueryEvent>) => {
	const operation = ctx.operation.getStore();
	const nodeInfo = ctx.nodeInfo.getStore();
	const queryType = ctx.queryType.getStore();

	return generalCounters.httpQueries.add(event.qty, {
		nodeId: nodeInfo?.id,
		queryType: queryType,
		operation,
		statusCode: event.statusCode,
	});
};

export const addNewMessagesReturnedFromQueryEvent = (
	event: WithoutContext<NewMessagesReturnedFromQueryEvent>
) => {
	const operation = ctx.operation.getStore();
	const nodeInfo = ctx.nodeInfo.getStore();
	const queryType = ctx.queryType.getStore();

	return generalCounters.httpQueryMessages.add(event.qty, {
		operation,
		nodeId: nodeInfo?.id,
		queryType,
	});
};
