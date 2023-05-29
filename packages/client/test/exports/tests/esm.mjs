// check esm works, as native and via webpack + babel. Also see typescript.ts
import DefaultExport, * as NamedExports from '@concertotech/logstore-client';

console.info(
	"import DefaultExport, * as NamedExports from '@concertotech/logstore-client':",
	{ DefaultExport, NamedExports }
);

const LogStoreClient = DefaultExport;

const auth = LogStoreClient.generateEthereumAccount();
const client = new LogStoreClient({
	auth,
});
console.assert(
	!!NamedExports.Subscription,
	'NamedExports should have Subscription'
);
client.connect().then(async () => {
	console.info('success');
	await client.destroy();
	process.exit(0);
});
