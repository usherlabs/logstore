import type { Schema } from 'ajv';

type RawSchemaParams = {
	protocol: 'RAW';
	schemaOrHash: Schema;
};
type HashedSchemaParams = {
	protocol: 'ARWEAVE' | 'IPFS';
	schemaOrHash: string;
};
export type SchemaParams = RawSchemaParams | HashedSchemaParams;
export type Protocols = SchemaParams['protocol'];
