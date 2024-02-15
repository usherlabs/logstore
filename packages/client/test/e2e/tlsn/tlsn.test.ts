import { TLSNManager } from '../../../src/tlsn/TLSNManager';
import simpleProofRedacted from './assets/simple_proof_redacted.json';
import simpleProofExpected from './assets/simple_proof_expected.json';

describe('TLSN', () => {
	it('should verify a TLSN proof', async () => {
		const tlsnManager = new TLSNManager();
		const notaryPublicKey = `-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEBv36FI4ZFszJa0DQFJ3wWCXvVLFr\ncRzMG5kaTeHGoSzDu6cFqx3uEWYpFGo6C0EOUgf+mEgbktLrXocv5yHzKg==\n-----END PUBLIC KEY-----`;
		const proof = simpleProofRedacted;
		console.log({ proof });

		console.time('verify'); // TIMER START
		const result = await tlsnManager.verifyTlsProof(
			JSON.stringify(proof),
			notaryPublicKey
		);
		console.timeEnd('verify'); // TIMER END

		console.log(result);
		expect(JSON.parse(result)).toEqual(
			JSON.parse(JSON.stringify(simpleProofExpected))
		);
	});
});
