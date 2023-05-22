import zlib, { InputType } from 'zlib';

export function decompressData(gzippedData: InputType) {
	return new Promise((resolve, reject) => {
		zlib.gunzip(
			gzippedData,
			(error: any, decompressedData: Record<string, any>) => {
				if (error) {
					reject(error);
				} else {
					// Use the decompressed data
					const decompressedString = decompressedData.toString();
					resolve(decompressedString);
				}
			}
		);
	});
}
