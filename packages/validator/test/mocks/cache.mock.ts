import { MessageMetadata } from 'streamr-client';

export const TestListenerCacheProvider = jest.fn().mockImplementation(() => {
	let cache: any = {};

	return {
		open: jest.fn().mockImplementation(async () => {
			return null;
		}),
		put: jest
			.fn()
			.mockImplementation(async (key: string, value: MessageMetadata) => {
				cache[key] = value;
			}),
		get: jest.fn().mockImplementation(async (key: string) => {
			if (cache[key]) {
				return cache[key];
			}

			throw new Error('not found');
		}),
		exists: jest.fn().mockImplementation(async (key: string) => {
			return !!cache[key];
		}),
		del: jest.fn().mockImplementation(async (key: string) => {
			delete cache[key];
		}),
		clear: jest.fn().mockImplementation(async () => {
			cache = {};
		}),
		// iterator: jest.fn().mockImplementation(function* (params){

		// })
	};
});
