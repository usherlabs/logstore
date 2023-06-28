import { HexString } from '../interfaces/report.common';

export const strToHex = (str: string): HexString =>
	Buffer.from(str, 'utf8').toString('hex');

export const hexToStr = (hex: HexString): string =>
	Buffer.from(hex, 'hex').toString('utf8');
