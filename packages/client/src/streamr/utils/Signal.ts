export interface Signal<ArgsType extends any[] = []> {
	listen(): Promise<ArgsType[0]>;
	listen(cb: SignalListener<ArgsType>): this;
	listen(cb?: SignalListener<ArgsType>): this | Promise<ArgsType[0]>;
}

export type SignalListener<T extends any[]> = (
	...args: T
) => unknown | Promise<unknown>;
