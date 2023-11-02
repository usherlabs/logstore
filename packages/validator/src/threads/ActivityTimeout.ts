export class ActivityTimeout {
	private lastUpdate: number;
	private timeout?: NodeJS.Timeout;

	constructor(private callback: () => void, private ms: number) {
		this.lastUpdate = Date.now();
	}

	public start() {
		this.setTimeout(this.ms);
	}

	public update() {
		this.lastUpdate = Date.now();
	}

	public stop() {
		clearTimeout(this.timeout);
	}

	private setTimeout(ms: number) {
		this.timeout = setTimeout(this.onTimeout.bind(this), ms);
	}

	private onTimeout() {
		this.stop();

		const elapsedMs = Date.now() - this.lastUpdate;
		if (elapsedMs >= this.ms) {
			this.callback();
		} else {
			const leftMs = this.ms - elapsedMs;
			this.setTimeout(leftMs);
		}
	}
}
