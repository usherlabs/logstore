import { IRuntimeExtended } from '../types';
import { NodeManager } from './NodeManager';
import { ReportManager } from './ReportManager';
import { StoreManager } from './StoreManager';

export class Managers {
	public store: StoreManager;
	public node: NodeManager;
	public report: ReportManager;

	constructor(
		public core: Pick<IRuntimeExtended, 'chain' | 'events' | 'heartbeat'> &
			ConstructorParameters<typeof NodeManager>[0]
	) {
		const { chain, events } = this.core;
		this.node = new NodeManager(core);
		this.store = new StoreManager(chain, events);
		this.report = new ReportManager(chain, events);
	}
}
