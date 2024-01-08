import { IPipeline, PipelineTransform } from './IPipeline';
import { IPushBuffer } from './IPushBuffer';

/**
 * Pipeline that is also a PushBuffer.
 * i.e. can call .push to push data into pipeline and .pipe to transform it.
 */
export interface IPushPipeline<InType, OutType = InType>
	extends IPipeline<InType, OutType>,
		IPushBuffer<InType, OutType> {
	pipe<NewOutType>(
		fn: PipelineTransform<OutType, NewOutType>
	): IPushPipeline<InType, NewOutType>;
}
