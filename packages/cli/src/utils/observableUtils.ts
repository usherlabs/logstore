import { getRootOptions } from '@/commands/options';
import { getCredentialsFromOptions } from '@/utils/logstore-client';
import { defer, map } from 'rxjs';

export const rootOptions$ = defer(async () => getRootOptions());
export const credentials$ = defer(async () => getCredentialsFromOptions());

export const isDevNetwork$ = credentials$.pipe(
	// enough to validate?
	map(
		({ provider }) =>
			provider.connection.url.includes('localhost') ||
			provider.connection.url.includes('sidechain')
	)
);
