import { TLSNManager } from '../../src/tlsn/TLSNManager';

describe('TLSN', () => {
	it('should verify a TLSN proof', async () => {
		const tlsnManager = new TLSNManager();
		const proof = 'proof';
		const notaryPublicKey = 'notaryPublicKey';
		const result = await tlsnManager.verifyTlsProof(proof, notaryPublicKey);
		expect(result).toBe('verified');
	});
});
