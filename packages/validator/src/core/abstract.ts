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
		const preparedOutcomes: IPrepared[] = [];
		const { config } = this;
		for (const source of config.sources) {
			const managers = new Managers(source);
			await managers.init();

			const startBlockNumber = await managers.node.getStartBlockNumber();
			if (startBlockNumber === 0) {
				throw new Error(
					'No Brokers Nodes are available on the network to validate'
				);
			}

			const outcome = await this.load(managers, startBlockNumber, source);
			preparedOutcomes.push(outcome);
		}

		// check if results from the different sources match
		if (
			!preparedOutcomes.every(
				(b) => JSON.stringify(b) === JSON.stringify(preparedOutcomes[0])
			)
		) {
			throw new Error(`Sources returned different results`);
		}

		this.prepared = preparedOutcomes[0];
	}

	// eslint-disable-next-line
	abstract generate(): Promise<any>;
}
