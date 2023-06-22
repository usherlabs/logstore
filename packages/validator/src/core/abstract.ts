import { Managers } from '../managers';
import type { IConfig, IRuntimeExtended } from '../types';
import type Validator from '../validator';

export abstract class AbstractDataItem<IPrepared> {
	abstract prepared: IPrepared;

	constructor(
		protected core: Validator,
		protected runtime: IRuntimeExtended,
		protected config: IConfig,
		protected fromKey: string,
		protected toKey: string
	) {}

	abstract load(managers: Managers, source: string): Promise<IPrepared>;

	public async prepare() {
		const { config } = this;
		this.prepared = await Managers.withSources<IPrepared>(
			config.sources,
			async (managers: Managers, source: string) => {
				const outcome = await this.load(managers, source);
				return outcome;
			}
		);
	}

	// eslint-disable-next-line
	abstract generate(): Promise<any>;
}
