import fs from "fs";
import path from "path";
import { promisify } from "util";



import { isObject } from "../../utils";
import { RawResultRecord } from "../result-types";
import { Reporter } from "./reporter-types";


// UTILS
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

/**
 * Try to merge object to file. If doesn't exist, create a new file with this content
 * @param obj
 * @param path
 */
const aggregateOrCreateJsonFile = async (
	obj: Record<string, unknown>,
	path: string
) => {
	const oldContent = await tryParseJsonFile(path);
	// if old content isnt on correct format, let's reinitialize
	const oldObj = isObject(oldContent) ? oldContent : {};
	const newObj = { ...oldObj, ...obj } as RawResultRecord;

	// sorts by keys for similar benchmarks to be together
	const sortedObj = Object.keys(newObj).sort();
	const sortedResult = sortedObj.reduce((acc, key) => {
		acc[key] = newObj[key];
		return acc;
	}, {} as RawResultRecord);

	await writeFile(path, JSON.stringify(sortedResult, null, 2));
};

const tryParseJsonFile = async <T = unknown>(path: string) => {
	try {
		const file = await readFile(path, { encoding: 'utf-8' });
		return JSON.parse(file) as T;
	} catch (e) {
		return undefined;
	}
};

const resultsDir = path.join(process.cwd(), 'results');
export const createJsonReporter = ({
	outputDir = resultsDir,
	filename,
}: {
	outputDir?: string;
	filename: `${string}.json`;
}): Reporter => {
	const filepath = path.join(outputDir, filename);
	return {
		save: async (result) => {
			await aggregateOrCreateJsonFile({ ...result }, filepath);
		},
		load: async () => {
			const content = await tryParseJsonFile<RawResultRecord>(filepath);
			return content ?? {};
		},
	};
};
