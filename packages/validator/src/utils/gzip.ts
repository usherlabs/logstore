import { gunzip as baseGunzip, gzip as baseGzip } from 'zlib';

export const gzip = (data: Buffer): Promise<Buffer> => {
	return new Promise((resolve, reject) => {
		baseGzip(data, (err, resData) => {
			if (err) {
				return reject(err);
			}
			resolve(resData);
		});
	});
};

export const gunzip = (data: Buffer): Promise<Buffer> => {
	return new Promise((resolve, reject) => {
		baseGunzip(data, (err, resData) => {
			if (err) {
				return reject(err);
			}
			resolve(resData);
		});
	});
};
