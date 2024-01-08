/**
 * GQty AUTO-GENERATED CODE: PLEASE DO NOT MODIFY MANUALLY
 */

export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = {
	[K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
	[SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
	[SubKey in K]: Maybe<T[SubKey]>;
};
/** All built-in and custom scalars, mapped to their actual values */
export interface Scalars {
	ID: string;
	String: string;
	Boolean: boolean;
	Int: number;
	Float: number;
	BigDecimal: any;
	BigInt: any;
	Bytes: any;
}

export interface BlockChangedFilter {
	number_gte: Scalars['Int'];
}

export interface Block_height {
	hash?: InputMaybe<Scalars['Bytes']>;
	number?: InputMaybe<Scalars['Int']>;
	number_gte?: InputMaybe<Scalars['Int']>;
}

export interface Node_filter {
	/** Filter for the block changed event. */
	_change_block?: InputMaybe<BlockChangedFilter>;
	and?: InputMaybe<Array<InputMaybe<Node_filter>>>;
	createdAt?: InputMaybe<Scalars['BigInt']>;
	createdAt_gt?: InputMaybe<Scalars['BigInt']>;
	createdAt_gte?: InputMaybe<Scalars['BigInt']>;
	createdAt_in?: InputMaybe<Array<Scalars['BigInt']>>;
	createdAt_lt?: InputMaybe<Scalars['BigInt']>;
	createdAt_lte?: InputMaybe<Scalars['BigInt']>;
	createdAt_not?: InputMaybe<Scalars['BigInt']>;
	createdAt_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
	id?: InputMaybe<Scalars['ID']>;
	id_gt?: InputMaybe<Scalars['ID']>;
	id_gte?: InputMaybe<Scalars['ID']>;
	id_in?: InputMaybe<Array<Scalars['ID']>>;
	id_lt?: InputMaybe<Scalars['ID']>;
	id_lte?: InputMaybe<Scalars['ID']>;
	id_not?: InputMaybe<Scalars['ID']>;
	id_not_in?: InputMaybe<Array<Scalars['ID']>>;
	lastSeen?: InputMaybe<Scalars['BigInt']>;
	lastSeen_gt?: InputMaybe<Scalars['BigInt']>;
	lastSeen_gte?: InputMaybe<Scalars['BigInt']>;
	lastSeen_in?: InputMaybe<Array<Scalars['BigInt']>>;
	lastSeen_lt?: InputMaybe<Scalars['BigInt']>;
	lastSeen_lte?: InputMaybe<Scalars['BigInt']>;
	lastSeen_not?: InputMaybe<Scalars['BigInt']>;
	lastSeen_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
	metadata?: InputMaybe<Scalars['String']>;
	metadata_contains?: InputMaybe<Scalars['String']>;
	metadata_contains_nocase?: InputMaybe<Scalars['String']>;
	metadata_ends_with?: InputMaybe<Scalars['String']>;
	metadata_ends_with_nocase?: InputMaybe<Scalars['String']>;
	metadata_gt?: InputMaybe<Scalars['String']>;
	metadata_gte?: InputMaybe<Scalars['String']>;
	metadata_in?: InputMaybe<Array<Scalars['String']>>;
	metadata_lt?: InputMaybe<Scalars['String']>;
	metadata_lte?: InputMaybe<Scalars['String']>;
	metadata_not?: InputMaybe<Scalars['String']>;
	metadata_not_contains?: InputMaybe<Scalars['String']>;
	metadata_not_contains_nocase?: InputMaybe<Scalars['String']>;
	metadata_not_ends_with?: InputMaybe<Scalars['String']>;
	metadata_not_ends_with_nocase?: InputMaybe<Scalars['String']>;
	metadata_not_in?: InputMaybe<Array<Scalars['String']>>;
	metadata_not_starts_with?: InputMaybe<Scalars['String']>;
	metadata_not_starts_with_nocase?: InputMaybe<Scalars['String']>;
	metadata_starts_with?: InputMaybe<Scalars['String']>;
	metadata_starts_with_nocase?: InputMaybe<Scalars['String']>;
	or?: InputMaybe<Array<InputMaybe<Node_filter>>>;
	storedStreams?: InputMaybe<Array<Scalars['String']>>;
	storedStreams_?: InputMaybe<Stream_filter>;
	storedStreams_contains?: InputMaybe<Array<Scalars['String']>>;
	storedStreams_contains_nocase?: InputMaybe<Array<Scalars['String']>>;
	storedStreams_not?: InputMaybe<Array<Scalars['String']>>;
	storedStreams_not_contains?: InputMaybe<Array<Scalars['String']>>;
	storedStreams_not_contains_nocase?: InputMaybe<Array<Scalars['String']>>;
}

export enum Node_orderBy {
	createdAt = 'createdAt',
	id = 'id',
	lastSeen = 'lastSeen',
	metadata = 'metadata',
	storedStreams = 'storedStreams',
}

/** Defines the order direction, either ascending or descending */
export enum OrderDirection {
	asc = 'asc',
	desc = 'desc',
}

export interface Permission_filter {
	/** Filter for the block changed event. */
	_change_block?: InputMaybe<BlockChangedFilter>;
	and?: InputMaybe<Array<InputMaybe<Permission_filter>>>;
	canDelete?: InputMaybe<Scalars['Boolean']>;
	canDelete_in?: InputMaybe<Array<Scalars['Boolean']>>;
	canDelete_not?: InputMaybe<Scalars['Boolean']>;
	canDelete_not_in?: InputMaybe<Array<Scalars['Boolean']>>;
	canEdit?: InputMaybe<Scalars['Boolean']>;
	canEdit_in?: InputMaybe<Array<Scalars['Boolean']>>;
	canEdit_not?: InputMaybe<Scalars['Boolean']>;
	canEdit_not_in?: InputMaybe<Array<Scalars['Boolean']>>;
	canGrant?: InputMaybe<Scalars['Boolean']>;
	canGrant_in?: InputMaybe<Array<Scalars['Boolean']>>;
	canGrant_not?: InputMaybe<Scalars['Boolean']>;
	canGrant_not_in?: InputMaybe<Array<Scalars['Boolean']>>;
	id?: InputMaybe<Scalars['ID']>;
	id_gt?: InputMaybe<Scalars['ID']>;
	id_gte?: InputMaybe<Scalars['ID']>;
	id_in?: InputMaybe<Array<Scalars['ID']>>;
	id_lt?: InputMaybe<Scalars['ID']>;
	id_lte?: InputMaybe<Scalars['ID']>;
	id_not?: InputMaybe<Scalars['ID']>;
	id_not_in?: InputMaybe<Array<Scalars['ID']>>;
	or?: InputMaybe<Array<InputMaybe<Permission_filter>>>;
	publishExpiration?: InputMaybe<Scalars['BigInt']>;
	publishExpiration_gt?: InputMaybe<Scalars['BigInt']>;
	publishExpiration_gte?: InputMaybe<Scalars['BigInt']>;
	publishExpiration_in?: InputMaybe<Array<Scalars['BigInt']>>;
	publishExpiration_lt?: InputMaybe<Scalars['BigInt']>;
	publishExpiration_lte?: InputMaybe<Scalars['BigInt']>;
	publishExpiration_not?: InputMaybe<Scalars['BigInt']>;
	publishExpiration_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
	stream?: InputMaybe<Scalars['String']>;
	stream_?: InputMaybe<Stream_filter>;
	stream_contains?: InputMaybe<Scalars['String']>;
	stream_contains_nocase?: InputMaybe<Scalars['String']>;
	stream_ends_with?: InputMaybe<Scalars['String']>;
	stream_ends_with_nocase?: InputMaybe<Scalars['String']>;
	stream_gt?: InputMaybe<Scalars['String']>;
	stream_gte?: InputMaybe<Scalars['String']>;
	stream_in?: InputMaybe<Array<Scalars['String']>>;
	stream_lt?: InputMaybe<Scalars['String']>;
	stream_lte?: InputMaybe<Scalars['String']>;
	stream_not?: InputMaybe<Scalars['String']>;
	stream_not_contains?: InputMaybe<Scalars['String']>;
	stream_not_contains_nocase?: InputMaybe<Scalars['String']>;
	stream_not_ends_with?: InputMaybe<Scalars['String']>;
	stream_not_ends_with_nocase?: InputMaybe<Scalars['String']>;
	stream_not_in?: InputMaybe<Array<Scalars['String']>>;
	stream_not_starts_with?: InputMaybe<Scalars['String']>;
	stream_not_starts_with_nocase?: InputMaybe<Scalars['String']>;
	stream_starts_with?: InputMaybe<Scalars['String']>;
	stream_starts_with_nocase?: InputMaybe<Scalars['String']>;
	subscribeExpiration?: InputMaybe<Scalars['BigInt']>;
	subscribeExpiration_gt?: InputMaybe<Scalars['BigInt']>;
	subscribeExpiration_gte?: InputMaybe<Scalars['BigInt']>;
	subscribeExpiration_in?: InputMaybe<Array<Scalars['BigInt']>>;
	subscribeExpiration_lt?: InputMaybe<Scalars['BigInt']>;
	subscribeExpiration_lte?: InputMaybe<Scalars['BigInt']>;
	subscribeExpiration_not?: InputMaybe<Scalars['BigInt']>;
	subscribeExpiration_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
	userAddress?: InputMaybe<Scalars['Bytes']>;
	userAddress_contains?: InputMaybe<Scalars['Bytes']>;
	userAddress_gt?: InputMaybe<Scalars['Bytes']>;
	userAddress_gte?: InputMaybe<Scalars['Bytes']>;
	userAddress_in?: InputMaybe<Array<Scalars['Bytes']>>;
	userAddress_lt?: InputMaybe<Scalars['Bytes']>;
	userAddress_lte?: InputMaybe<Scalars['Bytes']>;
	userAddress_not?: InputMaybe<Scalars['Bytes']>;
	userAddress_not_contains?: InputMaybe<Scalars['Bytes']>;
	userAddress_not_in?: InputMaybe<Array<Scalars['Bytes']>>;
}

export enum Permission_orderBy {
	canDelete = 'canDelete',
	canEdit = 'canEdit',
	canGrant = 'canGrant',
	id = 'id',
	publishExpiration = 'publishExpiration',
	stream = 'stream',
	stream__createdAt = 'stream__createdAt',
	stream__id = 'stream__id',
	stream__metadata = 'stream__metadata',
	stream__updatedAt = 'stream__updatedAt',
	subscribeExpiration = 'subscribeExpiration',
	userAddress = 'userAddress',
}

export interface Stream_filter {
	/** Filter for the block changed event. */
	_change_block?: InputMaybe<BlockChangedFilter>;
	and?: InputMaybe<Array<InputMaybe<Stream_filter>>>;
	createdAt?: InputMaybe<Scalars['BigInt']>;
	createdAt_gt?: InputMaybe<Scalars['BigInt']>;
	createdAt_gte?: InputMaybe<Scalars['BigInt']>;
	createdAt_in?: InputMaybe<Array<Scalars['BigInt']>>;
	createdAt_lt?: InputMaybe<Scalars['BigInt']>;
	createdAt_lte?: InputMaybe<Scalars['BigInt']>;
	createdAt_not?: InputMaybe<Scalars['BigInt']>;
	createdAt_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
	id?: InputMaybe<Scalars['ID']>;
	id_gt?: InputMaybe<Scalars['ID']>;
	id_gte?: InputMaybe<Scalars['ID']>;
	id_in?: InputMaybe<Array<Scalars['ID']>>;
	id_lt?: InputMaybe<Scalars['ID']>;
	id_lte?: InputMaybe<Scalars['ID']>;
	id_not?: InputMaybe<Scalars['ID']>;
	id_not_in?: InputMaybe<Array<Scalars['ID']>>;
	metadata?: InputMaybe<Scalars['String']>;
	metadata_contains?: InputMaybe<Scalars['String']>;
	metadata_contains_nocase?: InputMaybe<Scalars['String']>;
	metadata_ends_with?: InputMaybe<Scalars['String']>;
	metadata_ends_with_nocase?: InputMaybe<Scalars['String']>;
	metadata_gt?: InputMaybe<Scalars['String']>;
	metadata_gte?: InputMaybe<Scalars['String']>;
	metadata_in?: InputMaybe<Array<Scalars['String']>>;
	metadata_lt?: InputMaybe<Scalars['String']>;
	metadata_lte?: InputMaybe<Scalars['String']>;
	metadata_not?: InputMaybe<Scalars['String']>;
	metadata_not_contains?: InputMaybe<Scalars['String']>;
	metadata_not_contains_nocase?: InputMaybe<Scalars['String']>;
	metadata_not_ends_with?: InputMaybe<Scalars['String']>;
	metadata_not_ends_with_nocase?: InputMaybe<Scalars['String']>;
	metadata_not_in?: InputMaybe<Array<Scalars['String']>>;
	metadata_not_starts_with?: InputMaybe<Scalars['String']>;
	metadata_not_starts_with_nocase?: InputMaybe<Scalars['String']>;
	metadata_starts_with?: InputMaybe<Scalars['String']>;
	metadata_starts_with_nocase?: InputMaybe<Scalars['String']>;
	or?: InputMaybe<Array<InputMaybe<Stream_filter>>>;
	permissions_?: InputMaybe<Permission_filter>;
	storageNodes_?: InputMaybe<Node_filter>;
	updatedAt?: InputMaybe<Scalars['BigInt']>;
	updatedAt_gt?: InputMaybe<Scalars['BigInt']>;
	updatedAt_gte?: InputMaybe<Scalars['BigInt']>;
	updatedAt_in?: InputMaybe<Array<Scalars['BigInt']>>;
	updatedAt_lt?: InputMaybe<Scalars['BigInt']>;
	updatedAt_lte?: InputMaybe<Scalars['BigInt']>;
	updatedAt_not?: InputMaybe<Scalars['BigInt']>;
	updatedAt_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
}

export enum Stream_orderBy {
	createdAt = 'createdAt',
	id = 'id',
	metadata = 'metadata',
	permissions = 'permissions',
	storageNodes = 'storageNodes',
	updatedAt = 'updatedAt',
}

export enum _SubgraphErrorPolicy_ {
	/** Data will be returned even if the subgraph has indexing errors */
	allow = 'allow',
	/** If the subgraph has indexing errors, data will be omitted. The default. */
	deny = 'deny',
}

export const scalarsEnumsHash: import('gqty').ScalarsEnumsHash = {
	BigDecimal: true,
	BigInt: true,
	Boolean: true,
	Bytes: true,
	ID: true,
	Int: true,
	Node_orderBy: true,
	OrderDirection: true,
	Permission_orderBy: true,
	Stream_orderBy: true,
	String: true,
	_SubgraphErrorPolicy_: true,
};
export const generatedSchema = {
	BlockChangedFilter: { number_gte: { __type: 'Int!' } },
	Block_height: {
		hash: { __type: 'Bytes' },
		number: { __type: 'Int' },
		number_gte: { __type: 'Int' },
	},
	Node: {
		__typename: { __type: 'String!' },
		createdAt: { __type: 'BigInt' },
		id: { __type: 'ID!' },
		lastSeen: { __type: 'BigInt!' },
		metadata: { __type: 'String!' },
		storedStreams: {
			__type: '[Stream!]',
			__args: {
				first: 'Int',
				orderBy: 'Stream_orderBy',
				orderDirection: 'OrderDirection',
				skip: 'Int',
				where: 'Stream_filter',
			},
		},
	},
	Node_filter: {
		_change_block: { __type: 'BlockChangedFilter' },
		and: { __type: '[Node_filter]' },
		createdAt: { __type: 'BigInt' },
		createdAt_gt: { __type: 'BigInt' },
		createdAt_gte: { __type: 'BigInt' },
		createdAt_in: { __type: '[BigInt!]' },
		createdAt_lt: { __type: 'BigInt' },
		createdAt_lte: { __type: 'BigInt' },
		createdAt_not: { __type: 'BigInt' },
		createdAt_not_in: { __type: '[BigInt!]' },
		id: { __type: 'ID' },
		id_gt: { __type: 'ID' },
		id_gte: { __type: 'ID' },
		id_in: { __type: '[ID!]' },
		id_lt: { __type: 'ID' },
		id_lte: { __type: 'ID' },
		id_not: { __type: 'ID' },
		id_not_in: { __type: '[ID!]' },
		lastSeen: { __type: 'BigInt' },
		lastSeen_gt: { __type: 'BigInt' },
		lastSeen_gte: { __type: 'BigInt' },
		lastSeen_in: { __type: '[BigInt!]' },
		lastSeen_lt: { __type: 'BigInt' },
		lastSeen_lte: { __type: 'BigInt' },
		lastSeen_not: { __type: 'BigInt' },
		lastSeen_not_in: { __type: '[BigInt!]' },
		metadata: { __type: 'String' },
		metadata_contains: { __type: 'String' },
		metadata_contains_nocase: { __type: 'String' },
		metadata_ends_with: { __type: 'String' },
		metadata_ends_with_nocase: { __type: 'String' },
		metadata_gt: { __type: 'String' },
		metadata_gte: { __type: 'String' },
		metadata_in: { __type: '[String!]' },
		metadata_lt: { __type: 'String' },
		metadata_lte: { __type: 'String' },
		metadata_not: { __type: 'String' },
		metadata_not_contains: { __type: 'String' },
		metadata_not_contains_nocase: { __type: 'String' },
		metadata_not_ends_with: { __type: 'String' },
		metadata_not_ends_with_nocase: { __type: 'String' },
		metadata_not_in: { __type: '[String!]' },
		metadata_not_starts_with: { __type: 'String' },
		metadata_not_starts_with_nocase: { __type: 'String' },
		metadata_starts_with: { __type: 'String' },
		metadata_starts_with_nocase: { __type: 'String' },
		or: { __type: '[Node_filter]' },
		storedStreams: { __type: '[String!]' },
		storedStreams_: { __type: 'Stream_filter' },
		storedStreams_contains: { __type: '[String!]' },
		storedStreams_contains_nocase: { __type: '[String!]' },
		storedStreams_not: { __type: '[String!]' },
		storedStreams_not_contains: { __type: '[String!]' },
		storedStreams_not_contains_nocase: { __type: '[String!]' },
	},
	Permission: {
		__typename: { __type: 'String!' },
		canDelete: { __type: 'Boolean' },
		canEdit: { __type: 'Boolean' },
		canGrant: { __type: 'Boolean' },
		id: { __type: 'ID!' },
		publishExpiration: { __type: 'BigInt' },
		stream: { __type: 'Stream' },
		subscribeExpiration: { __type: 'BigInt' },
		userAddress: { __type: 'Bytes!' },
	},
	Permission_filter: {
		_change_block: { __type: 'BlockChangedFilter' },
		and: { __type: '[Permission_filter]' },
		canDelete: { __type: 'Boolean' },
		canDelete_in: { __type: '[Boolean!]' },
		canDelete_not: { __type: 'Boolean' },
		canDelete_not_in: { __type: '[Boolean!]' },
		canEdit: { __type: 'Boolean' },
		canEdit_in: { __type: '[Boolean!]' },
		canEdit_not: { __type: 'Boolean' },
		canEdit_not_in: { __type: '[Boolean!]' },
		canGrant: { __type: 'Boolean' },
		canGrant_in: { __type: '[Boolean!]' },
		canGrant_not: { __type: 'Boolean' },
		canGrant_not_in: { __type: '[Boolean!]' },
		id: { __type: 'ID' },
		id_gt: { __type: 'ID' },
		id_gte: { __type: 'ID' },
		id_in: { __type: '[ID!]' },
		id_lt: { __type: 'ID' },
		id_lte: { __type: 'ID' },
		id_not: { __type: 'ID' },
		id_not_in: { __type: '[ID!]' },
		or: { __type: '[Permission_filter]' },
		publishExpiration: { __type: 'BigInt' },
		publishExpiration_gt: { __type: 'BigInt' },
		publishExpiration_gte: { __type: 'BigInt' },
		publishExpiration_in: { __type: '[BigInt!]' },
		publishExpiration_lt: { __type: 'BigInt' },
		publishExpiration_lte: { __type: 'BigInt' },
		publishExpiration_not: { __type: 'BigInt' },
		publishExpiration_not_in: { __type: '[BigInt!]' },
		stream: { __type: 'String' },
		stream_: { __type: 'Stream_filter' },
		stream_contains: { __type: 'String' },
		stream_contains_nocase: { __type: 'String' },
		stream_ends_with: { __type: 'String' },
		stream_ends_with_nocase: { __type: 'String' },
		stream_gt: { __type: 'String' },
		stream_gte: { __type: 'String' },
		stream_in: { __type: '[String!]' },
		stream_lt: { __type: 'String' },
		stream_lte: { __type: 'String' },
		stream_not: { __type: 'String' },
		stream_not_contains: { __type: 'String' },
		stream_not_contains_nocase: { __type: 'String' },
		stream_not_ends_with: { __type: 'String' },
		stream_not_ends_with_nocase: { __type: 'String' },
		stream_not_in: { __type: '[String!]' },
		stream_not_starts_with: { __type: 'String' },
		stream_not_starts_with_nocase: { __type: 'String' },
		stream_starts_with: { __type: 'String' },
		stream_starts_with_nocase: { __type: 'String' },
		subscribeExpiration: { __type: 'BigInt' },
		subscribeExpiration_gt: { __type: 'BigInt' },
		subscribeExpiration_gte: { __type: 'BigInt' },
		subscribeExpiration_in: { __type: '[BigInt!]' },
		subscribeExpiration_lt: { __type: 'BigInt' },
		subscribeExpiration_lte: { __type: 'BigInt' },
		subscribeExpiration_not: { __type: 'BigInt' },
		subscribeExpiration_not_in: { __type: '[BigInt!]' },
		userAddress: { __type: 'Bytes' },
		userAddress_contains: { __type: 'Bytes' },
		userAddress_gt: { __type: 'Bytes' },
		userAddress_gte: { __type: 'Bytes' },
		userAddress_in: { __type: '[Bytes!]' },
		userAddress_lt: { __type: 'Bytes' },
		userAddress_lte: { __type: 'Bytes' },
		userAddress_not: { __type: 'Bytes' },
		userAddress_not_contains: { __type: 'Bytes' },
		userAddress_not_in: { __type: '[Bytes!]' },
	},
	Stream: {
		__typename: { __type: 'String!' },
		createdAt: { __type: 'BigInt' },
		id: { __type: 'ID!' },
		metadata: { __type: 'String!' },
		permissions: {
			__type: '[Permission!]',
			__args: {
				first: 'Int',
				orderBy: 'Permission_orderBy',
				orderDirection: 'OrderDirection',
				skip: 'Int',
				where: 'Permission_filter',
			},
		},
		storageNodes: {
			__type: '[Node!]',
			__args: {
				first: 'Int',
				orderBy: 'Node_orderBy',
				orderDirection: 'OrderDirection',
				skip: 'Int',
				where: 'Node_filter',
			},
		},
		updatedAt: { __type: 'BigInt' },
	},
	Stream_filter: {
		_change_block: { __type: 'BlockChangedFilter' },
		and: { __type: '[Stream_filter]' },
		createdAt: { __type: 'BigInt' },
		createdAt_gt: { __type: 'BigInt' },
		createdAt_gte: { __type: 'BigInt' },
		createdAt_in: { __type: '[BigInt!]' },
		createdAt_lt: { __type: 'BigInt' },
		createdAt_lte: { __type: 'BigInt' },
		createdAt_not: { __type: 'BigInt' },
		createdAt_not_in: { __type: '[BigInt!]' },
		id: { __type: 'ID' },
		id_gt: { __type: 'ID' },
		id_gte: { __type: 'ID' },
		id_in: { __type: '[ID!]' },
		id_lt: { __type: 'ID' },
		id_lte: { __type: 'ID' },
		id_not: { __type: 'ID' },
		id_not_in: { __type: '[ID!]' },
		metadata: { __type: 'String' },
		metadata_contains: { __type: 'String' },
		metadata_contains_nocase: { __type: 'String' },
		metadata_ends_with: { __type: 'String' },
		metadata_ends_with_nocase: { __type: 'String' },
		metadata_gt: { __type: 'String' },
		metadata_gte: { __type: 'String' },
		metadata_in: { __type: '[String!]' },
		metadata_lt: { __type: 'String' },
		metadata_lte: { __type: 'String' },
		metadata_not: { __type: 'String' },
		metadata_not_contains: { __type: 'String' },
		metadata_not_contains_nocase: { __type: 'String' },
		metadata_not_ends_with: { __type: 'String' },
		metadata_not_ends_with_nocase: { __type: 'String' },
		metadata_not_in: { __type: '[String!]' },
		metadata_not_starts_with: { __type: 'String' },
		metadata_not_starts_with_nocase: { __type: 'String' },
		metadata_starts_with: { __type: 'String' },
		metadata_starts_with_nocase: { __type: 'String' },
		or: { __type: '[Stream_filter]' },
		permissions_: { __type: 'Permission_filter' },
		storageNodes_: { __type: 'Node_filter' },
		updatedAt: { __type: 'BigInt' },
		updatedAt_gt: { __type: 'BigInt' },
		updatedAt_gte: { __type: 'BigInt' },
		updatedAt_in: { __type: '[BigInt!]' },
		updatedAt_lt: { __type: 'BigInt' },
		updatedAt_lte: { __type: 'BigInt' },
		updatedAt_not: { __type: 'BigInt' },
		updatedAt_not_in: { __type: '[BigInt!]' },
	},
	_Block_: {
		__typename: { __type: 'String!' },
		hash: { __type: 'Bytes' },
		number: { __type: 'Int!' },
		timestamp: { __type: 'Int' },
	},
	_Meta_: {
		__typename: { __type: 'String!' },
		block: { __type: '_Block_!' },
		deployment: { __type: 'String!' },
		hasIndexingErrors: { __type: 'Boolean!' },
	},
	mutation: {},
	query: {
		__typename: { __type: 'String!' },
		_meta: { __type: '_Meta_', __args: { block: 'Block_height' } },
		node: {
			__type: 'Node',
			__args: {
				block: 'Block_height',
				id: 'ID!',
				subgraphError: '_SubgraphErrorPolicy_!',
			},
		},
		nodes: {
			__type: '[Node!]!',
			__args: {
				block: 'Block_height',
				first: 'Int',
				orderBy: 'Node_orderBy',
				orderDirection: 'OrderDirection',
				skip: 'Int',
				subgraphError: '_SubgraphErrorPolicy_!',
				where: 'Node_filter',
			},
		},
		permission: {
			__type: 'Permission',
			__args: {
				block: 'Block_height',
				id: 'ID!',
				subgraphError: '_SubgraphErrorPolicy_!',
			},
		},
		permissions: {
			__type: '[Permission!]!',
			__args: {
				block: 'Block_height',
				first: 'Int',
				orderBy: 'Permission_orderBy',
				orderDirection: 'OrderDirection',
				skip: 'Int',
				subgraphError: '_SubgraphErrorPolicy_!',
				where: 'Permission_filter',
			},
		},
		stream: {
			__type: 'Stream',
			__args: {
				block: 'Block_height',
				id: 'ID!',
				subgraphError: '_SubgraphErrorPolicy_!',
			},
		},
		streams: {
			__type: '[Stream!]!',
			__args: {
				block: 'Block_height',
				first: 'Int',
				orderBy: 'Stream_orderBy',
				orderDirection: 'OrderDirection',
				skip: 'Int',
				subgraphError: '_SubgraphErrorPolicy_!',
				where: 'Stream_filter',
			},
		},
	},
	subscription: {
		__typename: { __type: 'String!' },
		_meta: { __type: '_Meta_', __args: { block: 'Block_height' } },
		node: {
			__type: 'Node',
			__args: {
				block: 'Block_height',
				id: 'ID!',
				subgraphError: '_SubgraphErrorPolicy_!',
			},
		},
		nodes: {
			__type: '[Node!]!',
			__args: {
				block: 'Block_height',
				first: 'Int',
				orderBy: 'Node_orderBy',
				orderDirection: 'OrderDirection',
				skip: 'Int',
				subgraphError: '_SubgraphErrorPolicy_!',
				where: 'Node_filter',
			},
		},
		permission: {
			__type: 'Permission',
			__args: {
				block: 'Block_height',
				id: 'ID!',
				subgraphError: '_SubgraphErrorPolicy_!',
			},
		},
		permissions: {
			__type: '[Permission!]!',
			__args: {
				block: 'Block_height',
				first: 'Int',
				orderBy: 'Permission_orderBy',
				orderDirection: 'OrderDirection',
				skip: 'Int',
				subgraphError: '_SubgraphErrorPolicy_!',
				where: 'Permission_filter',
			},
		},
		stream: {
			__type: 'Stream',
			__args: {
				block: 'Block_height',
				id: 'ID!',
				subgraphError: '_SubgraphErrorPolicy_!',
			},
		},
		streams: {
			__type: '[Stream!]!',
			__args: {
				block: 'Block_height',
				first: 'Int',
				orderBy: 'Stream_orderBy',
				orderDirection: 'OrderDirection',
				skip: 'Int',
				subgraphError: '_SubgraphErrorPolicy_!',
				where: 'Stream_filter',
			},
		},
	},
} as const;

export interface Node {
	__typename?: 'Node';
	/**
	 * date created. This is a timestamp in seconds
	 */
	createdAt?: Maybe<ScalarsEnums['BigInt']>;
	/**
	 * node ID = address
	 */
	id: ScalarsEnums['ID'];
	/**
	 * Epoch timestamp of the last time the node metadata was updated
	 */
	lastSeen: ScalarsEnums['BigInt'];
	/**
	 * Connection metadata, e.g. URL of the node, e.g. http://mynode.com:3000
	 */
	metadata: ScalarsEnums['String'];
	/**
	 * Streams for which this node is registered as a storage node in the StreamStorageRegistry
	 */
	storedStreams: (args?: {
		/**
		 * @defaultValue `100`
		 */
		first?: Maybe<Scalars['Int']>;
		orderBy?: Maybe<Stream_orderBy>;
		orderDirection?: Maybe<OrderDirection>;
		/**
		 * @defaultValue `0`
		 */
		skip?: Maybe<Scalars['Int']>;
		where?: Maybe<Stream_filter>;
	}) => Maybe<Array<Stream>>;
}

export interface Permission {
	__typename?: 'Permission';
	/**
	 * canDelete permission allows deleting the stream from the StreamRegistry
	 */
	canDelete?: Maybe<ScalarsEnums['Boolean']>;
	/**
	 * Edit permission enables changing the stream's metadata
	 */
	canEdit?: Maybe<ScalarsEnums['Boolean']>;
	/**
	 * grant permission allows granting and revoking permissions to this stream
	 */
	canGrant?: Maybe<ScalarsEnums['Boolean']>;
	id: ScalarsEnums['ID'];
	/**
	 * publishExpiration timestamp tells until what time this address may publish data to the stream
	 */
	publishExpiration?: Maybe<ScalarsEnums['BigInt']>;
	/**
	 * Target stream this permission applies to
	 */
	stream?: Maybe<Stream>;
	/**
	 * subscribeExpires timestamp tells until what time this address may subscribe to the stream
	 */
	subscribeExpiration?: Maybe<ScalarsEnums['BigInt']>;
	/**
	 * Ethereum address, owner of this permission
	 */
	userAddress: ScalarsEnums['Bytes'];
}

export interface Stream {
	__typename?: 'Stream';
	/**
	 * date created. This is a timestamp in seconds
	 */
	createdAt?: Maybe<ScalarsEnums['BigInt']>;
	/**
	 * stream ID = 'creator address'/'path' where path can be any string
	 */
	id: ScalarsEnums['ID'];
	/**
	 * Stream metadata JSON
	 */
	metadata: ScalarsEnums['String'];
	/**
	 * Permissions that each Ethereum address owns to this stream
	 */
	permissions: (args?: {
		/**
		 * @defaultValue `100`
		 */
		first?: Maybe<Scalars['Int']>;
		orderBy?: Maybe<Permission_orderBy>;
		orderDirection?: Maybe<OrderDirection>;
		/**
		 * @defaultValue `0`
		 */
		skip?: Maybe<Scalars['Int']>;
		where?: Maybe<Permission_filter>;
	}) => Maybe<Array<Permission>>;
	/**
	 * Nodes the have been registered as storage nodes to this stream in the StreamStorageRegistry
	 */
	storageNodes: (args?: {
		/**
		 * @defaultValue `100`
		 */
		first?: Maybe<Scalars['Int']>;
		orderBy?: Maybe<Node_orderBy>;
		orderDirection?: Maybe<OrderDirection>;
		/**
		 * @defaultValue `0`
		 */
		skip?: Maybe<Scalars['Int']>;
		where?: Maybe<Node_filter>;
	}) => Maybe<Array<Node>>;
	/**
	 * date updated. This is a timestamp in seconds
	 */
	updatedAt?: Maybe<ScalarsEnums['BigInt']>;
}

export interface _Block_ {
	__typename?: '_Block_';
	/**
	 * The hash of the block
	 */
	hash?: Maybe<ScalarsEnums['Bytes']>;
	/**
	 * The block number
	 */
	number: ScalarsEnums['Int'];
	/**
	 * Integer representation of the timestamp stored in blocks for the chain
	 */
	timestamp?: Maybe<ScalarsEnums['Int']>;
}

/**
 * The type for the top-level _meta field
 */
export interface _Meta_ {
	__typename?: '_Meta_';
	/**
	 * Information about a specific subgraph block. The hash of the block
	 * will be null if the _meta field has a block constraint that asks for
	 * a block number. It will be filled if the _meta field has no block constraint
	 * and therefore asks for the latest  block
	 */
	block: _Block_;
	/**
	 * The deployment ID
	 */
	deployment: ScalarsEnums['String'];
	/**
	 * If `true`, the subgraph encountered indexing errors at some past block
	 */
	hasIndexingErrors: ScalarsEnums['Boolean'];
}

export interface Mutation {
	__typename?: 'Mutation';
}

export interface Query {
	__typename?: 'Query';
	/**
	 * Access to subgraph metadata
	 */
	_meta: (args?: { block?: Maybe<Block_height> }) => Maybe<_Meta_>;
	node: (args: {
		/**
		 * The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted.
		 */
		block?: Maybe<Block_height>;
		id: Scalars['ID'];
		/**
		 * Set to `allow` to receive data even if the subgraph has skipped over errors while syncing.
		 * @defaultValue `"deny"`
		 */
		subgraphError?: Maybe<_SubgraphErrorPolicy_>;
	}) => Maybe<Node>;
	nodes: (args: {
		/**
		 * The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted.
		 */
		block?: Maybe<Block_height>;
		/**
		 * @defaultValue `100`
		 */
		first?: Maybe<Scalars['Int']>;
		orderBy?: Maybe<Node_orderBy>;
		orderDirection?: Maybe<OrderDirection>;
		/**
		 * @defaultValue `0`
		 */
		skip?: Maybe<Scalars['Int']>;
		/**
		 * Set to `allow` to receive data even if the subgraph has skipped over errors while syncing.
		 * @defaultValue `"deny"`
		 */
		subgraphError?: Maybe<_SubgraphErrorPolicy_>;
		where?: Maybe<Node_filter>;
	}) => Array<Node>;
	permission: (args: {
		/**
		 * The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted.
		 */
		block?: Maybe<Block_height>;
		id: Scalars['ID'];
		/**
		 * Set to `allow` to receive data even if the subgraph has skipped over errors while syncing.
		 * @defaultValue `"deny"`
		 */
		subgraphError?: Maybe<_SubgraphErrorPolicy_>;
	}) => Maybe<Permission>;
	permissions: (args: {
		/**
		 * The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted.
		 */
		block?: Maybe<Block_height>;
		/**
		 * @defaultValue `100`
		 */
		first?: Maybe<Scalars['Int']>;
		orderBy?: Maybe<Permission_orderBy>;
		orderDirection?: Maybe<OrderDirection>;
		/**
		 * @defaultValue `0`
		 */
		skip?: Maybe<Scalars['Int']>;
		/**
		 * Set to `allow` to receive data even if the subgraph has skipped over errors while syncing.
		 * @defaultValue `"deny"`
		 */
		subgraphError?: Maybe<_SubgraphErrorPolicy_>;
		where?: Maybe<Permission_filter>;
	}) => Array<Permission>;
	stream: (args: {
		/**
		 * The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted.
		 */
		block?: Maybe<Block_height>;
		id: Scalars['ID'];
		/**
		 * Set to `allow` to receive data even if the subgraph has skipped over errors while syncing.
		 * @defaultValue `"deny"`
		 */
		subgraphError?: Maybe<_SubgraphErrorPolicy_>;
	}) => Maybe<Stream>;
	streams: (args: {
		/**
		 * The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted.
		 */
		block?: Maybe<Block_height>;
		/**
		 * @defaultValue `100`
		 */
		first?: Maybe<Scalars['Int']>;
		orderBy?: Maybe<Stream_orderBy>;
		orderDirection?: Maybe<OrderDirection>;
		/**
		 * @defaultValue `0`
		 */
		skip?: Maybe<Scalars['Int']>;
		/**
		 * Set to `allow` to receive data even if the subgraph has skipped over errors while syncing.
		 * @defaultValue `"deny"`
		 */
		subgraphError?: Maybe<_SubgraphErrorPolicy_>;
		where?: Maybe<Stream_filter>;
	}) => Array<Stream>;
}

export interface Subscription {
	__typename?: 'Subscription';
	/**
	 * Access to subgraph metadata
	 */
	_meta: (args?: { block?: Maybe<Block_height> }) => Maybe<_Meta_>;
	node: (args: {
		/**
		 * The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted.
		 */
		block?: Maybe<Block_height>;
		id: Scalars['ID'];
		/**
		 * Set to `allow` to receive data even if the subgraph has skipped over errors while syncing.
		 * @defaultValue `"deny"`
		 */
		subgraphError?: Maybe<_SubgraphErrorPolicy_>;
	}) => Maybe<Node>;
	nodes: (args: {
		/**
		 * The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted.
		 */
		block?: Maybe<Block_height>;
		/**
		 * @defaultValue `100`
		 */
		first?: Maybe<Scalars['Int']>;
		orderBy?: Maybe<Node_orderBy>;
		orderDirection?: Maybe<OrderDirection>;
		/**
		 * @defaultValue `0`
		 */
		skip?: Maybe<Scalars['Int']>;
		/**
		 * Set to `allow` to receive data even if the subgraph has skipped over errors while syncing.
		 * @defaultValue `"deny"`
		 */
		subgraphError?: Maybe<_SubgraphErrorPolicy_>;
		where?: Maybe<Node_filter>;
	}) => Array<Node>;
	permission: (args: {
		/**
		 * The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted.
		 */
		block?: Maybe<Block_height>;
		id: Scalars['ID'];
		/**
		 * Set to `allow` to receive data even if the subgraph has skipped over errors while syncing.
		 * @defaultValue `"deny"`
		 */
		subgraphError?: Maybe<_SubgraphErrorPolicy_>;
	}) => Maybe<Permission>;
	permissions: (args: {
		/**
		 * The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted.
		 */
		block?: Maybe<Block_height>;
		/**
		 * @defaultValue `100`
		 */
		first?: Maybe<Scalars['Int']>;
		orderBy?: Maybe<Permission_orderBy>;
		orderDirection?: Maybe<OrderDirection>;
		/**
		 * @defaultValue `0`
		 */
		skip?: Maybe<Scalars['Int']>;
		/**
		 * Set to `allow` to receive data even if the subgraph has skipped over errors while syncing.
		 * @defaultValue `"deny"`
		 */
		subgraphError?: Maybe<_SubgraphErrorPolicy_>;
		where?: Maybe<Permission_filter>;
	}) => Array<Permission>;
	stream: (args: {
		/**
		 * The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted.
		 */
		block?: Maybe<Block_height>;
		id: Scalars['ID'];
		/**
		 * Set to `allow` to receive data even if the subgraph has skipped over errors while syncing.
		 * @defaultValue `"deny"`
		 */
		subgraphError?: Maybe<_SubgraphErrorPolicy_>;
	}) => Maybe<Stream>;
	streams: (args: {
		/**
		 * The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted.
		 */
		block?: Maybe<Block_height>;
		/**
		 * @defaultValue `100`
		 */
		first?: Maybe<Scalars['Int']>;
		orderBy?: Maybe<Stream_orderBy>;
		orderDirection?: Maybe<OrderDirection>;
		/**
		 * @defaultValue `0`
		 */
		skip?: Maybe<Scalars['Int']>;
		/**
		 * Set to `allow` to receive data even if the subgraph has skipped over errors while syncing.
		 * @defaultValue `"deny"`
		 */
		subgraphError?: Maybe<_SubgraphErrorPolicy_>;
		where?: Maybe<Stream_filter>;
	}) => Array<Stream>;
}

export interface GeneratedSchema {
	query: Query;
	mutation: Mutation;
	subscription: Subscription;
}

export type MakeNullable<T> = {
	[K in keyof T]: T[K] | undefined;
};

export interface ScalarsEnums extends MakeNullable<Scalars> {
	Node_orderBy: Node_orderBy | undefined;
	OrderDirection: OrderDirection | undefined;
	Permission_orderBy: Permission_orderBy | undefined;
	Stream_orderBy: Stream_orderBy | undefined;
	_SubgraphErrorPolicy_: _SubgraphErrorPolicy_ | undefined;
}
