import { HexString } from '../interfaces/report.common';

export const strToHex = (str: string): HexString =>
	Buffer.from(str, 'utf8').toString('hex');

export const hexToStr = (hex: HexString): string =>
	Buffer.from(hex, 'hex').toString('utf8');

export const numToHex = (num: number | bigint): HexString => num.toString(16);

export const hexToNum = (hex: HexString): number => parseInt(hex, 16);
