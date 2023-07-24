import { SystemMessageType } from '@logsn/protocol';
import { RootDatabase } from 'lmdb';

import {
	ProofOfMessageStoredMessage,
	QueryRequestMessage,
	QueryResponseMessage,
} from '../types';
import { Database } from '../utils/database';

type ProofOfMessageStoredDatabase = RootDatabase<
	Array<{
		message: ProofOfMessageStoredMessage;
		hash: string;
	}>,
	number
>;

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

type DB = {
	[SystemMessageType.ProofOfMessageStored]: ProofOfMessageStoredDatabase;
	[SystemMessageType.QueryRequest]: QueryRequestDatabase;
	[SystemMessageType.QueryResponse]: QueryResponseDatabase;
};

export class SystemDb {
	private _db!: DB;

	public open(path: string) {
		this._db = {
			[SystemMessageType.ProofOfMessageStored]: Database.create(
				'ProofOfMessageStored',
				path
			),
			[SystemMessageType.QueryRequest]: Database.create('QueryRequest', path),
			[SystemMessageType.QueryResponse]: Database.create('QueryResponse', path),
		} as DB;
	}

	public storeDb() {
		return this.db(
			SystemMessageType.ProofOfMessageStored
		) as ProofOfMessageStoredDatabase;
	}

	public queryRequestDb() {
		return this.db(SystemMessageType.QueryRequest) as QueryRequestDatabase;
	}

	public queryResponseDb() {
		return this.db(SystemMessageType.QueryResponse) as QueryResponseDatabase;
	}

	private db(type: SystemMessageType) {
		if (!this._db[type]) {
			throw new Error('Database is not initialised');
		}
		return this._db[type];
	}
}
