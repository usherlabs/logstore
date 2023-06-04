import { allowanceConfirmFn } from '@logsn/shared';
import inquirer from 'inquirer';
import { Logger } from 'tslog';

export const logger = new Logger();

export const allowanceConfirm: allowanceConfirmFn = async (
	currentAllowance: bigint,
	requiredAllowance: bigint
) => {
	logger.debug(`Current allowance: ${currentAllowance.valueOf()}`);
	logger.debug(`Required allowance: ${requiredAllowance.valueOf()}`);

	const answers = await inquirer.prompt([
		{
			name: 'confirm',
			type: 'confirm',
			message:
				'Are you sure you want to continue? Once funded, this cannot be reversed.',
			default: true,
		},
	]);
	if (!answers.confirm) {
		process.exit(0);
	}
	return true;
};
