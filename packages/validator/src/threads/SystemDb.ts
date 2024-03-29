import { SystemMessageType } from '@logsn/protocol';
import { RootDatabase } from 'lmdb';

import {
	QueryPropagateMessage,
	QueryRequestMessage,
	QueryResponseMessage,
} from '../types';
import { Database } from '../utils/database';

type QueryRequestDatabase = RootDatabase<
	Array<{
		message: QueryRequestMessage;
		hash: string;
	}>,
	number
>;

type QueryResponseDatabase = RootDatabase<
	Array<{
		message: QueryResponseMessage;
		hash: string;
	}>,
	string
>;

type QueryPropagateDatabase = RootDatabase<
	Array<{
		message: QueryPropagateMessage;
		hash: string;
	}>,
	string
>;

type DB = {
	[SystemMessageType.QueryRequest]: QueryRequestDatabase;
	[SystemMessageType.QueryResponse]: QueryResponseDatabase;
	[SystemMessageType.QueryPropagate]: QueryPropagateDatabase;
};

export class SystemDb {
	private _db!: DB;

	public open(path: string) {
		this._db = {
			[SystemMessageType.QueryRequest]: Database.create('QueryRequest', path),
			[SystemMessageType.QueryResponse]: Database.create('QueryResponse', path),
			[SystemMessageType.QueryPropagate]: Database.create(
				'QueryPropagate',
				path
			),
		} as DB;
	}

	public queryRequestDb() {
		return this.db(SystemMessageType.QueryRequest) as QueryRequestDatabase;
	}

	public queryResponseDb() {
		return this.db(SystemMessageType.QueryResponse) as QueryResponseDatabase;
	}

	public queryPropagateDb() {
		return this.db(SystemMessageType.QueryPropagate) as QueryPropagateDatabase;
	}

	private db(type: SystemMessageType) {
		if (!this._db[type]) {
			throw new Error('Database is not initialised');
		}
		return this._db[type];
	}
}
