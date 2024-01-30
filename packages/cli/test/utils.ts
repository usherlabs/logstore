import { getClientsForCredentials } from '@/utils/logstore-client';
import { exec } from 'child_process';
import path from 'path';

const getCliPath = async () => {
	// gets package.json from the root of the project
	// gets property bin > logstore path
	// joins path to the root of the project
	// returns the path

	const pkg = await import(path.join(__dirname, '../package.json'));
	return path.join(__dirname, '../', pkg.bin.logstore);
};

const getTSCliPath = () => {
	const relativePath = '../bin/logstore-cli.ts';
	const logstoreCliPath = path.join(__dirname, relativePath);
	return logstoreCliPath;
};

/**
 * @param command
 * @param type -- this will define if we are running the cli from the source code or from the build
 */
export const executeOnCli = async (
	command: string,
	type: 'build' | 'dev' = 'dev'
) => {
	const cliPath = type === 'dev' ? getTSCliPath() : await getCliPath();
	const execCommand =
		type === 'dev'
			? `pnpm tsx -- ${cliPath} ${command}`
			: `node ${cliPath} ${command}`;
	console.log('executing: ', execCommand);
	return new Promise<{ stdout: string; stderr: string; code: number }>(
		(resolve) => {
			exec(execCommand, (error, stdout, stderr) => {
				if (error) {
					resolve({ stdout, stderr, code: Number( error.code ) });
				} else {
					resolve({ stdout, stderr, code: 0 });
				}
			});
		}
	);
};

export function getTestLogStoreClient(privateKey: string) {
	return getClientsForCredentials({
		host: 'http://localhost:8546',
		wallet: privateKey,
	});
}
