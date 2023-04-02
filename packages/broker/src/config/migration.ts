import fs from 'fs';

import { ConfigFile, getDefaultFile } from './config';

export const readConfigAndMigrateIfNeeded = (
	fileName: string
): ConfigFile | never => {
	if (fileName === undefined) {
		const defaultTargetFile = getDefaultFile();
		if (!fs.existsSync(defaultTargetFile)) {
			/*
			 * No config file. Some config options are maybe set with enviroment variables
			 * (see overrideConfigToEnvVarsIfGiven function), and others just
			 * use the default values (see `default` definitions in config.schema.json)
			 */
			return {};
		}
	}

	const content = JSON.parse(fs.readFileSync(fileName, 'utf8'));
	return content;
};
