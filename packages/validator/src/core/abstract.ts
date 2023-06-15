import { Managers } from '../managers';
import type { SystemListener } from '../threads';
import type { IConfig } from '../types';
import type Validator from '../validator';

export abstract class AbstractDataItem<IPrepared> {
	abstract prepared: IPrepared;

	constructor(
		protected core: Validator,
		protected listener: SystemListener,
		protected config: IConfig,
		protected key: string
	) {}

	abstract load(
		managers: Managers,
		startBlockNumber: number,
		source: string
	): Promise<IPrepared>;

	public async prepare() {
		const { config } = this;
		this.prepared = await Managers.withSources<IPrepared>(
			config.sources,
			async (managers: Managers, source: string) => {
				const startBlockNumber = await managers.node.getStartBlockNumber();
				const outcome = await this.load(managers, startBlockNumber, source);
				return outcome;
			}
		);
	}

	// eslint-disable-next-line
	abstract generate(): Promise<any>;
}
