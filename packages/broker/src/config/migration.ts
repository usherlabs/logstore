import fs from 'fs';

import { ConfigFile } from './config';

export const readConfigAndMigrateIfNeeded = (
	fileName: string
): ConfigFile | never => {
	const content = JSON.parse(fs.readFileSync(fileName, 'utf8'));
	return content;
};
