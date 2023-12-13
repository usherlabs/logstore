export const counting = async function* <T>(
	items: AsyncIterable<T>,
	onFinally: (count: number) => void
): AsyncGenerator<T> {
	let count = 0;
	try {
		for await (const item of items) {
			yield item;
			count++;
		}
	} finally {
		onFinally(count);
	}
};
