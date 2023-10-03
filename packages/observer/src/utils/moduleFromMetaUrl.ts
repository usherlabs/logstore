import { fileURLToPath } from 'url';

/**
 * Creates a NodeJS.Module object from a given meta URL. Used because
 * at ESM modules, the module object is not available in the global scope.
 */
export const moduleFromMetaUrl = (url: string | undefined) =>
	({
		id: fileURLToPath(url ?? ''),
	}) as NodeJS.Module;
