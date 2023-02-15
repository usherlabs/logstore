import { events } from './utils/events';
import { Validator as KyveValidator } from '@kyvejs/protocol';
import { syncPoolConfig } from '@kyvejs/protocol/src/methods/queries/syncPoolConfig';

async function syncPoolConfigExtended(this: KyveValidator): Promise<void> {
	await syncPoolConfig.bind(this);

	events.emit('config', this.poolConfig);
}

export default class Validator extends KyveValidator {
	protected syncPoolConfig = syncPoolConfigExtended;
}
