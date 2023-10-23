import { StoreUpdatedEvent } from '@logsn/contracts/dist/src/StoreManager.sol/LogStoreManager';

import { EventsIndexer, SerializedEvent } from '../../src/threads';

test('deserialize event', () => {
	const serialized = {
		blockNumber: 1172,
		blockHash:
			'0x36a7cb4ac1ba193df908bcea7cd91a0e7d7d497e40423beeb4e567fe25f903e6',
		transactionIndex: 0,
		removed: false,
		address: '0x8560200b8E7477FB09281A0566B50fa6E7a66a34',
		data: '0x00000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000c9f2c9cd04674edea4000000000000000000000000000000000000000000000000000000000000000000000343078313965376533373665376332313362376537653765343663633730613564643038366461666632612f686561727462656174000000000000000000000000',
		topics: [
			'0x71a18d400e8f2654aebe2b0998654bbfb6769cad471c06b8141cfe473c3bb2af',
		],
		transactionHash:
			'0x2161ca9fdf7e1fed6b40ea906288a34960f166dd8c69ba1eec5da2f25ec25270',
		logIndex: 2,
		event: 'StoreUpdated',
		eventSignature: 'StoreUpdated(string,bool,uint256)',
		args: [
			'0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a/heartbeat',
			true,
			{
				type: 'BigNumber',
				hex: '0x0c9f2c9cd04674edea40000000',
			},
		],
	} as SerializedEvent<StoreUpdatedEvent>;

	const log = EventsIndexer.deserializeEvent(serialized);
	// we can get from the store on args
	expect(log.args.store.toString()).toBe(
		'0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a/heartbeat'
	);
	// but it is still serialized like this
	expect(log).toMatchInlineSnapshot(`
		{
		  "address": "0x8560200b8E7477FB09281A0566B50fa6E7a66a34",
		  "args": [
		    "0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a/heartbeat",
		    true,
		    {
		      "hex": "0x0c9f2c9cd04674edea40000000",
		      "type": "BigNumber",
		    },
		  ],
		  "blockHash": "0x36a7cb4ac1ba193df908bcea7cd91a0e7d7d497e40423beeb4e567fe25f903e6",
		  "blockNumber": 1172,
		  "data": "0x00000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000c9f2c9cd04674edea4000000000000000000000000000000000000000000000000000000000000000000000343078313965376533373665376332313362376537653765343663633730613564643038366461666632612f686561727462656174000000000000000000000000",
		  "decode": [Function],
		  "event": "StoreUpdated",
		  "eventSignature": "StoreUpdated(string,bool,uint256)",
		  "getBlock": [Function],
		  "getTransaction": [Function],
		  "getTransactionReceipt": [Function],
		  "logIndex": 2,
		  "removeListener": [Function],
		  "removed": false,
		  "topics": [
		    "0x71a18d400e8f2654aebe2b0998654bbfb6769cad471c06b8141cfe473c3bb2af",
		  ],
		  "transactionHash": "0x2161ca9fdf7e1fed6b40ea906288a34960f166dd8c69ba1eec5da2f25ec25270",
		  "transactionIndex": 0,
		}
	`);
});
