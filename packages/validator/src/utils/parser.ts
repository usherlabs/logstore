import commander from 'commander';

export const parseEvmPriv = (value: string) => {
	if (!process.env[value]) {
		throw new commander.InvalidArgumentError(
			`Environment variable "${value}" has no value`
		);
	}

	return process.env[value];
};

export const parseBoolean = (value: string, require = false) => {
	if (require && !process.env[value]) {
		throw new commander.InvalidArgumentError(
			`Environment variable "${value}" has no value`
		);
	}
	return process.env[value] === 'true';
};
