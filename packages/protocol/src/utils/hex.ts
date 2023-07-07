import { HexString } from '../interfaces/report.common';

export const strToHex = (str: string): HexString =>
	`0x` + Buffer.from(str, 'utf8').toString('hex').toLowerCase();

export const hexToStr = (hex: HexString): string =>
	Buffer.from(hex.substring(2, hex.length), 'hex').toString('utf8');
