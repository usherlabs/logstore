import { Logger, toEthereumAddress } from '@streamr/utils';
import cors from 'cors';
import { ethers } from 'ethers';
import { once } from 'events';
import express, {
	NextFunction,
	Request,
	RequestHandler,
	Response,
} from 'express';
import fs from 'fs';
import { Server as HttpServer } from 'http';
import https, { Server as HttpsServer } from 'https';

import { StrictConfig } from './config/config';

const logger = new Logger(module);

const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_FORBIDDEN = 403;

export interface Endpoint {
	path: string;
	method: 'get' | 'post';
	requestHandlers: RequestHandler[];
}

const getCredentials = (req: Request) => {
	const headerValue = req.headers.authorization;
	const PREFIX = 'basic ';
	if (headerValue?.toLowerCase().startsWith(PREFIX)) {
		const [user, signature] = headerValue.substring(PREFIX.length).split(':');
		return { user, signature };
	}
	return undefined;
};

export const createAuthenticatorMiddleware = (): ((
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

export const startServer = async (
	endpoints: Endpoint[],
	config: StrictConfig['httpServer']
): Promise<HttpServer | https.Server> => {
	const app = express();
	app.use(
		cors({
			origin: true, // Access-Control-Allow-Origin: request origin. The default '*' is invalid if credentials included.
			credentials: true, // Access-Control-Allow-Credentials: true
		})
	);
	endpoints.forEach((endpoint: Endpoint) => {
		const handlers = [createAuthenticatorMiddleware()].concat(
			endpoint.requestHandlers
		);
		app.route(endpoint.path)[endpoint.method](handlers);
	});
	let serverFactory: { listen: (port: number) => HttpServer | HttpsServer };
	if (config.sslCertificate !== undefined) {
		serverFactory = https.createServer(
			{
				cert: fs.readFileSync(config.sslCertificate.certFileName),
				key: fs.readFileSync(config.sslCertificate.privateKeyFileName),
			},
			app
		);
	} else {
		serverFactory = app;
	}
	const server = serverFactory.listen(config.port);
	await once(server, 'listening');
	logger.info(`HTTP server listening on ${config.port}`);
	return server;
};

export const stopServer = async (
	httpServer: HttpServer | HttpsServer
): Promise<void> => {
	if (httpServer.listening) {
		httpServer.close();
		await once(httpServer, 'close');
	}
};
