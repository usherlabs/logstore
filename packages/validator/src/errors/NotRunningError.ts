import { CustomError } from './CustomError';

export class NotRunningError extends CustomError {
	constructor() {
		super('Process not running');
	}
}
