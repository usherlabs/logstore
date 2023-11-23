export type BrokerProgramModule = {
	createProgram(rpcUrl: string): BrokerProgram;
};

export abstract class BrokerProgram {
	protected readonly rpcUrl: string;

	constructor(rpcUrl: string) {
		this.rpcUrl = rpcUrl;
	}

	public abstract process(args: unknown): Promise<unknown>;
}
