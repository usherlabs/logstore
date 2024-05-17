import { StreamrClientEvents } from '@streamr/sdk';
import { Lifecycle, scoped } from 'tsyringe';

import { ObservableEventEmitter } from '@streamr/utils';
import { LogStoreAssignmentEvent } from './registry/LogStoreRegistry';

export interface LogStoreClientEvents extends StreamrClientEvents {
	addToLogStore: (payload: LogStoreAssignmentEvent) => void;
	removeFromLogStore: (payload: LogStoreAssignmentEvent) => void;
}

// events for internal communication between StreamrClient components
export interface InternalEvents {
	publish: () => void;
	subscribe: () => void;
}

@scoped(Lifecycle.ContainerScoped)
export class LogStoreClientEventEmitter extends ObservableEventEmitter<
	LogStoreClientEvents & InternalEvents
> { }
