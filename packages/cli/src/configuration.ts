import path from 'path';

export interface IConfig {
	privateKey: string;
	host: string;
}

export function resolveHome(filepath = '') {
	if (filepath.length > 0 && filepath[0] === '~') {
		return path.join(process.env.HOME!, filepath.slice(1));
	}
	return filepath;
}

export const readFeeMultiplier = 0.05; // See validator code. Should optimised to read from network
export const defaultConfigPath = '~/.logstore-cli/default.json';
