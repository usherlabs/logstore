export const transformError = async function* <T>(
	src: AsyncGenerator<T>,
	transformFn: (err: any) => any
): AsyncGenerator<T> {
	try {
		for await (const item of src) {
			yield item;
		}
	} catch (err: any) {
		throw await transformFn(err);
	}
};
