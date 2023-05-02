import { toEthereumAddress } from '@streamr/utils';
import { ethers } from 'ethers';
import { NextFunction, Request, Response } from 'express';
import { Base64 } from 'js-base64';

const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_FORBIDDEN = 403;

const getCredentials = (req: Request) => {
	const headerValue = req.headers.authorization;
	const PREFIX = 'basic ';
	if (headerValue?.toLowerCase().startsWith(PREFIX)) {
		const [user, signature] = Base64.decode(
			headerValue.substring(PREFIX.length)
		).split(':');
		return { user, signature };
	}
	return undefined;
};

export const createBasicAuthenticatorMiddleware = (): ((
	req: Request,
	res: Response,
	next: NextFunction
) => void) => {
	return (req: Request, res: Response, next: NextFunction) => {
		const credentials = getCredentials(req);
		if (credentials?.user && credentials?.signature) {
			const signerAddress = toEthereumAddress(
				ethers.utils.verifyMessage(credentials.user, credentials.signature)
			);

			if (credentials.user === signerAddress) {
				req.consumer = signerAddress;
				return next();
			}
		}

		const status =
			credentials === undefined
				? HTTP_STATUS_UNAUTHORIZED
				: HTTP_STATUS_FORBIDDEN;
		res.sendStatus(status);
	};
};
