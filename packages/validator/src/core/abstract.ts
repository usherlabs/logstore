import Listener from '../listener';
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

	abstract load(source: string): Promise<IPrepared>;

	public async prepare() {
		const preparedOutcomes: IPrepared[] = [];
		const { config } = this;
		for (const source of config.sources) {
			const outcome = await this.load(source);
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
