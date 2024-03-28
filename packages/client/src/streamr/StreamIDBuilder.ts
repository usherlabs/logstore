import { StreamDefinition, StreamID, StreamPartID } from '@streamr/sdk';

export interface StreamIDBuilder {
	toStreamID(streamIdOrPath: string): Promise<StreamID>;
	toStreamPartID(definition: StreamDefinition): Promise<StreamPartID>;
}

export const StreamIDBuilderInjectionToken = Symbol('StreamIDBuilder');
