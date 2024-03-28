import { EthereumAddress, StreamID, StreamPartID } from '@streamr/sdk';

import { StrictStreamrClientConfig } from '../Config';
import { DestroySignal } from '../DestroySignal';
import { LoggerFactory } from '../LoggerFactory';

export interface MessagePipelineOptions {
	streamPartId: StreamPartID;
	getStorageNodes: (streamId: StreamID) => Promise<EthereumAddress[]>;
	config: StrictStreamrClientConfig;
	destroySignal: DestroySignal;
	loggerFactory: LoggerFactory;
}
