export type RawResult = {
	date: string;
	stats: Record<string, any>;
	[key: string]: any;
};
export type RawResultRecord = {
	[key: string]: RawResult;
};
