import fs from 'fs';
import path from 'path';
import { Logger } from 'tslog';
import { promisify } from 'util';

import { OUTPUT_DIR } from '../../../environment-vars';
import { isObject } from '../../utils';
import { RawResultRecord } from '../result-types';
import { Reporter } from './reporter-types';

// UTILS
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const logger = new Logger();

/**
 * Try to merge object to file. If doesn't exist, create a new file with this content
 * @param obj
 * @param path
 */
const aggregateOrCreateJsonFile = async (
	obj: Record<string, unknown>,
	filePath: string
) => {
	const oldContent = await tryParseJsonFile(filePath);
	// if old content isnt on correct format, let's reinitialize
	const oldObj = isObject(oldContent) ? oldContent : {};
	const newObj = { ...oldObj, ...obj } as RawResultRecord;

	// sorts by keys for similar benchmarks to be together
	const sortedObj = Object.keys(newObj).sort();
	const sortedResult = sortedObj.reduce((acc, key) => {
		acc[key] = newObj[key];
		return acc;
	}, {} as RawResultRecord);

	await writeFile(filePath, JSON.stringify(sortedResult, null, 2));
	logger.info(`Saved results to ${filePath}`);
};

const tryParseJsonFile = async <T = unknown>(filePath: string) => {
	try {
		const file = await readFile(filePath, { encoding: 'utf-8' });
		return JSON.parse(file) as T;
	} catch (e) {
		return undefined;
	}
};

const createDirIfNotExists = async (dir: string) => {
	if (!fs.existsSync(dir)) {
		await fs.promises.mkdir(dir, { recursive: true });
	}
};

const ensureJsonExtension = (filename: string) => {
	if (!filename.endsWith('.json')) {
		return `${filename}.json`;
	}
	return filename;
};

const resultsDir = path.join(process.cwd(), OUTPUT_DIR ?? 'results');
export const createJsonReporter = ({
	outputDir = resultsDir,
	filename,
}: {
	outputDir?: string;
	filename: `${string}.json`;
}): Reporter => {
	const filepath = path.join(outputDir, ensureJsonExtension(filename));
	return {
		save: async (result) => {
			await createDirIfNotExists(outputDir);
			await aggregateOrCreateJsonFile({ ...result }, filepath);
		},
		load: async () => {
			const content = await tryParseJsonFile<RawResultRecord>(filepath);
			return content ?? {};
		},
	};
};
