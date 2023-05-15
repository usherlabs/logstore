import { StreamPermission } from '@concertodao/streamr-client';
import { BigNumber } from '@ethersproject/bignumber';

export const streamPermissionToSolidityType = (
	permission: StreamPermission
): BigNumber => {
	switch (permission) {
		case StreamPermission.EDIT:
			return BigNumber.from(0);
		case StreamPermission.DELETE:
			return BigNumber.from(1);
		case StreamPermission.PUBLISH:
			return BigNumber.from(2);
		case StreamPermission.SUBSCRIBE:
			return BigNumber.from(3);
		case StreamPermission.GRANT:
			return BigNumber.from(4);
		default:
			break;
	}
	return BigNumber.from(0);
};
