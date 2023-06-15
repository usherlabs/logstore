import Listener from '../listener';
import { Managers } from '../managers';
import { IConfig } from '../types';
import Validator from '../validator';

export abstract class AbstractDataItem<IPrepared> {
	abstract prepared: IPrepared;

	constructor(
		protected core: Validator,
		protected listener: Listener,
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
				if (startBlockNumber === 0) {
					throw new Error(
						'No Brokers Nodes are available on the network to validate'
					);
				}
				const outcome = await this.load(managers, startBlockNumber, source);
				return outcome;
			}
		);
	}

	// eslint-disable-next-line
	abstract generate(): Promise<any>;
}
