import type { Schema } from 'ajv';

type RawSchemaParams = {
	protocol: 'RAW';
	schemaOrHash: Schema;
};
type HashedSchemaParams = {
	protocol: 'ARWEAVE' | 'IPFS';
	/// The hash of the schema. We use it to fetch from the correct protocol. E.g. CID on IPFS
	schemaOrHash: string;
};
export type SchemaParams = RawSchemaParams | HashedSchemaParams;
export type Protocols = SchemaParams['protocol'];
