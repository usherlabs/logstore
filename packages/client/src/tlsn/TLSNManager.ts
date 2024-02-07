import { initThreadPool, verify } from 'tlsn-verify-rs';
import { Lifecycle, scoped } from 'tsyringe';

const getNumThreads = () => {
	if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
		return navigator.hardwareConcurrency;
	} else {
		// Default to 4 threads as usual minimum, even on phones running it
		return 4;
	}
};

/**
 * TlsnManager is responsible for verifying TLSN proofs.
 *
 * When it's created, it starts a thread pool with a number of threads equal to the number of CPU cores, if available
 */
@scoped(Lifecycle.ContainerScoped)
export class TLSNManager {
	private startPromise: Promise<void>;

	constructor() {
		this.startPromise = this.start();
	}

	private async start(): Promise<void> {
		await initThreadPool(getNumThreads());
	}

	private waitForStart = async () => {
		await this.startPromise;
	};

	public async verifyTlsProof(
		proof: string,
		notaryPublicKey: string
	): Promise<string> {
		this.waitForStart();
		return verify(proof, notaryPublicKey);
	}
}
