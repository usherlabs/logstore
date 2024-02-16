import { ReplaySubject } from 'rxjs';

export class StaleReplaySubject<T> extends ReplaySubject<T> {
	constructor(_windowTime?: number) {
		super(undefined, _windowTime);
	}
}
