import { StreamID } from 'streamr-client';

export interface StreamIDBuilder {
	toStreamID(streamIdOrPath: string): Promise<StreamID>;
}

export const StreamIDBuilderInjectionToken = Symbol('StreamIDBuilder');
