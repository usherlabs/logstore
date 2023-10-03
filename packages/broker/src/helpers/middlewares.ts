export type Middleware<T> = (next: T) => T;

export const applyMiddlewares = <T>(
	initialState: T,
	middlewares: Middleware<T>[]
): T => {
	return middlewares.reduceRight(
		(acc, middleware) => middleware(acc),
		initialState
	);
};
