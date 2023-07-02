// A reporter will take a result and save it to a file
import { RawResultRecord } from '../result-types';

export type Reporter = {
	// expected behavior of saving is to actually append the result
	// to existing data. If a test name is equal to previous data, it will get overwritten
	save: (result: RawResultRecord) => Promise<void>;
	load: () => Promise<RawResultRecord>;
};
