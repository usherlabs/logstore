import { TypedEvent } from '@logsn/contracts/dist/common';
import type { StakeDelegateUpdatedEvent } from '@logsn/contracts/dist/src/NodeManager.sol/LogStoreNodeManager';
import type {
	DataStoredEvent,
	StoreUpdatedEvent,
} from '@logsn/contracts/dist/src/StoreManager.sol/LogStoreManager';
import type { BaseContract } from 'ethers';
import { O } from 'ts-toolbelt';

import type { IChainSource } from '../sources';

export type ChainSourceContracts = IChainSource['contracts'];
type ResolvedManagerTypes =
	ChainSourceContracts[keyof ChainSourceContracts] extends () => Promise<
		infer C extends BaseContract
	>
		? C
		: never;
type ExtractFilterKeysFrom<T> = T extends { filters: infer Filters }
	? keyof Filters
	: never;
export type UnionOfFilterKeys = ExtractFilterKeysFrom<ResolvedManagerTypes>;
type AnyFunction = (...args: any[]) => any;

// we remove the args and the functions from the event, to make it a plain object
export type SerializedEvent<E extends TypedEvent<any, any>> = Omit<
	E,
	'args' | O.SelectKeys<E, AnyFunction>
> & {
	// we only want the part that is an array from the args
	args: E['args'] extends Array<infer U> ? U[] : never;
};
export type Events = {
	StoreUpdated?: SerializedEvent<StoreUpdatedEvent>[];
	StakeDelegateUpdated?: SerializedEvent<StakeDelegateUpdatedEvent>[];
	DataStored?: SerializedEvent<DataStoredEvent>[];
	// ? We can add more here later... however, we'll need to handle data migrations within the validator node for upgrades
	// ? ie. An upgrade where the next bundle collects all events since start block - we can split the txs up too
};
