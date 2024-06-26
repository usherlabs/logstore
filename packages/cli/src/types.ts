export type Options = {
	wallet: string;
	host: string;
	network: string;
};

export type StakeOptions = Options & {
	usd: boolean;
	amount: number;
};

export enum Network {
	Local = 5,
	Dev = 31337,
	Testnet = 80001,
	Mainnet = 137,
}
