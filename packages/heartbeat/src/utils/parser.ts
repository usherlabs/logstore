export const parseEvmPriv = (value: string) => {
	if (!process.env[value]) {
		throw new Error(`Environment variable "${value}" has no value`);
	}

	return process.env[value] as string;
};
