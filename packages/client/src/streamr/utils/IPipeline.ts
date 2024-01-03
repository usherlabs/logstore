import { Signal } from './Signal';

export type PipelineTransform<InType = any, OutType = any> = (
	src: AsyncGenerator<InType>
) => AsyncGenerator<OutType>;

export type IPipeline<InType, OutType = InType> = {
	pipe<NewOutType>(
		fn: PipelineTransform<OutType, NewOutType>
	): IPipeline<InType, NewOutType>;
	flow(): IPipeline<InType, OutType>;
	onMessage: Signal<[OutType]>;
} & AsyncGenerator<OutType>;
