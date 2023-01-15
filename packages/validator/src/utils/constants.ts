import { SupportedSourcesChains } from '@/types';

export const TREASURY = {
	[SupportedSourcesChains.goerli]:
		'0x73ea6ddbb178fe16b89910fae63f448f83a4713107f4c13e5275a2e277ccdbea',
} as const;
export const pipelineContractAddress = {
	[SupportedSourcesChains.polygonmum]: `0xDA50a7A41e5ac1d9d49A56A2647123Ed65F3e4B7`,
} as const;
