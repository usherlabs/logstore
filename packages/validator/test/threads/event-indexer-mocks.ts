import { KyveLCDClientType } from '@kyvejs/sdk';
import { DeepPartial } from '@kyvejs/types/lcd/google/api/http';

export const kyveMock = {
	kyve: {
		query: {
			v1beta1: {
				finalizedBundles: jest.fn() as any,
			},
		},
	},
} as DeepPartial<KyveLCDClientType> as KyveLCDClientType;
