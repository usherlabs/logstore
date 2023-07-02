/**
 * Singleton Logger Class
 *
 * Created to enable passing Logger class around simpler.
 */
import { Logger } from 'tslog';

export class Slogger {
	private static _logger: Logger;

	public static register(logger: Logger) {
		this._logger = logger;
	}

	public static get instance() {
		return this._logger;
	}
}
