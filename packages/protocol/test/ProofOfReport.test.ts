import assert from 'assert';

import { ProofOfReport, SystemMessage } from '../src/system';
import '../src/system/ProofOfReportSerializerV1';

describe(ProofOfReport, () => {
	describe('seqNum', () => {
		const createMessage = () => {
			return new ProofOfReport({
				address: 'address',
				hash: 'hash',
				toth: 'toth',
				timestamp: 100200300,
				signature: 'signature',
			});
		};

		it('increases when a new message created', () => {
			const message1 = createMessage();
			const message2 = createMessage();

			assert.equal(message2.seqNum, message1.seqNum + 1);
		});

		it('not affected by serialization/deserialization', () => {
			const message1 = createMessage();
			const message2 = createMessage();

			const serializedMessage0 = message1.serialize();
			const serializedMessage1 = message2.serialize();

			const deserializedMessage0 =
				SystemMessage.deserialize(serializedMessage0);
			const deserializedMessage1 =
				SystemMessage.deserialize(serializedMessage1);

			const message3 = createMessage();

			assert.equal(deserializedMessage0.seqNum, message1.seqNum);
			assert.equal(deserializedMessage1.seqNum, message2.seqNum);
			assert.equal(message3.seqNum, message2.seqNum + 1);
		});
	});
});
