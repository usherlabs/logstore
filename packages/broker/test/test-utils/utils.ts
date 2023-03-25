import { counterId } from '../../src/client/utils/utils';

export const uid = (prefix?: string): string =>
	counterId(`p${process.pid}${prefix ? '-' + prefix : ''}`);
