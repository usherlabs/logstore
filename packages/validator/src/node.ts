import { events } from './utils/events';
import { Node as KyveNode } from '@kyve/core-beta';
import { syncPoolConfig } from '@kyve/core-beta/src/methods';

async function syncPoolConfigExtended(this: KyveNode): Promise<void> {
	await syncPoolConfig.bind(this);

	events.emit('config', this.poolConfig);
}

export default class Node extends KyveNode {
	protected syncPoolConfig = syncPoolConfigExtended;
}
