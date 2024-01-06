import { StreamDefinition, StreamID, StreamPartID } from 'streamr-client';

export interface StreamIDBuilder {
	toStreamID(streamIdOrPath: string): Promise<StreamID>;
	toStreamPartID(definition: StreamDefinition): Promise<StreamPartID>;
}

export const StreamIDBuilderInjectionToken = Symbol('StreamIDBuilder');
