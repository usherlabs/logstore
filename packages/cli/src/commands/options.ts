import { rootProgram } from '@/commands/index';
import { Command } from '@commander-js/extra-typings';
import { BehaviorSubject } from 'rxjs';

type InferCommmandOptions<T extends Command> =
	T extends Command<any, infer Options> ? Options : never;
type RootOptions = Partial<InferCommmandOptions<typeof rootProgram>>;
const rootOptions = new BehaviorSubject<RootOptions>({});
export const setRootOptions = (
	newOptionsOrUpdate:
		| Partial<RootOptions>
		| ((args: RootOptions) => RootOptions)
) => {
	if (typeof newOptionsOrUpdate === 'function') {
		rootOptions.next(newOptionsOrUpdate(rootOptions.value));
	} else {
		rootOptions.next(newOptionsOrUpdate);
	}
};

export const getRootOptions = () => {
	const result = rootOptions.getValue();
	const resultAlreadySet = Object.keys(result).length > 0;
	if (!resultAlreadySet) {
		const newResult = rootProgram.opts();
		rootOptions.next(newResult);
		return newResult;
	}
	return result;
};
