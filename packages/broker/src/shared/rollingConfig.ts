class RollingConfig {
	private readonly _key: number;

	constructor(key: number) {
		this._key = key;
	}

	public get keyStep(): number {
		if (this._key > Date.parse('2023-07-06T05:00:00') / 1000) {
			return 20;
		}

		if (this._key > Date.parse('2023-07-05T18:00:00') / 1000) {
			return 10;
		}

		return 1;
	}
}

export const rollingConfig = (key: number) => {
	const curr = new RollingConfig(key);
	const prev = new RollingConfig(key - curr.keyStep);
	return {
		curr,
		prev,
	};
};
