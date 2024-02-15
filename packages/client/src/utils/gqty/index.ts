/**
 * GQty: You can safely modify this file based on your needs.
 */
import { Cache, createClient, GQtyError, type QueryFetcher } from 'gqty';
// import { createClient as createSubscriptionsClient } from 'graphql-ws';
import { Headers } from 'node-fetch';

import type { HttpFetcher } from '../../streamr/utils/HttpFetcher';
import {
	generatedSchema,
	type GeneratedSchema,
	scalarsEnumsHash,
} from './schema.generated';

export const createQueryFetcher = (
	url: string,
	fetcher: HttpFetcher
): QueryFetcher =>
	async function ({ query, variables, operationName }, fetchOptions) {
		const response = await fetcher.fetch(url, {
			method: 'POST',
			headers: new Headers({
				'Content-Type': 'application/json',
			}),
			body: JSON.stringify({
				query,
				variables,
				operationName,
			}),
			...fetchOptions,
		});

		if (response.status >= 400) {
			throw new GQtyError(
				`GraphQL endpoint responded with HTTP status ${response.status}.`
			);
		}

		const text = await response.text();

		try {
			return JSON.parse(text);
		} catch {
			throw new GQtyError(
				`Malformed JSON response: ${
					text.length > 50 ? text.slice(0, 50) + '...' : text
				}`
			);
		}
	};

// const subscriptionsClient =
// 	typeof window !== 'undefined'
// 		? createSubscriptionsClient({
// 				lazy: true,
// 				url: () => {
// 					// Modify if needed
// 					const url = new URL('/api/graphql', window.location.href);
// 					url.protocol = url.protocol.replace('http', 'ws');
// 					return url.href;
// 				},
// 		  })
// 		: undefined;

const cache = new Cache(
	undefined,
	/**
	 * Default option is immediate cache expiry but keep it for 5 minutes,
	 * allowing soft refetches in background.
	 */
	{
		maxAge: 0,
		staleWhileRevalidate: 5 * 60 * 1000,
		normalization: true,
	}
);

export const createStreamrGraphQLClient = (url: string, fetcher: HttpFetcher) =>
	createClient<GeneratedSchema>({
		schema: generatedSchema,
		scalars: scalarsEnumsHash,
		cache,
		fetchOptions: {
			fetcher: createQueryFetcher(url, fetcher),
			// subscriber: subscriptionsClient,
			cache: 'no-store',
		},
	});

export type GQtyClient = ReturnType<typeof createStreamrGraphQLClient>;

export * from './schema.generated';
