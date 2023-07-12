import { gunzip as baseGunzip, gzip as baseGzip, ZlibOptions } from 'zlib';

export const gzip = (data: Buffer, options?: ZlibOptions): Promise<Buffer> => {
	return new Promise((resolve, reject) => {
		baseGzip(data, options, (err, resData) => {
			if (err) {
				return reject(err);
			}
			resolve(resData);
		});
	});
};

export const gunzip = (
	data: Buffer,
	options?: ZlibOptions
): Promise<Buffer> => {
	return new Promise((resolve, reject) => {
		baseGunzip(data, options, (err, resData) => {
			if (err) {
				return reject(err);
			}
			resolve(resData);
		});
	});
};
