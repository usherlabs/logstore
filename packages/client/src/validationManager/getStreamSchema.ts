import Ajv, { Schema } from 'ajv';
import addFormats from 'ajv-formats';
import { Option } from 'effect';
import { pipe } from 'rxjs';
import type { StreamMetadata } from 'streamr-client';
import { U } from 'ts-toolbelt';

import type { Protocols, SchemaParams } from './types';

export const defaultAjv = new Ajv({
	useDefaults: true,
	discriminator: true,
});
addFormats(defaultAjv);
defaultAjv.addFormat('ethereum-address', /^0x[a-zA-Z0-9]{40}$/);

const getSchemaConfigFromMetadata = (metadata: StreamMetadata) => {
	// @ts-expect-error metadata isn't stated by default by streamr
	return metadata.logstore?.schema as SchemaParams | undefined;
};

type SchemaFetchRecord = {
	[key in Protocols]: (
		hashOrSchema: U.Select<
			SchemaParams,
			{
				protocol: key;
			},
			'<-extends'
		>['schemaOrHash']
	) => Promise<Schema>;
};

// todo: move to logstore client
const fetchProtocolSchema = {
	// todo: is some form of sanitizing needed here?
	IPFS: async (hash: string) => {
		const res = await fetch(`https://ipfs.io/ipfs/${hash}`);
		const schema = await res.json();
		await defaultAjv.validateSchema(schema, true);
		return schema as Schema;
	},
	ARWEAVE: async (hash: string) => {
		const res = await fetch(`https://arweave.net/${hash}`);
		const schema = await res.json();
		await defaultAjv.validateSchema(schema, true);
		return schema as Schema;
	},
	RAW: async (schema: Schema) => {
		await defaultAjv.validateSchema(schema, true);
		return schema;
	},
} satisfies SchemaFetchRecord;

export const getSchemaFromMetadata = pipe(
	getSchemaConfigFromMetadata,
	Option.fromNullable,
	Option.map(({ protocol, schemaOrHash }) =>
		fetchProtocolSchema[protocol](schemaOrHash as string & Schema)
	)
);
