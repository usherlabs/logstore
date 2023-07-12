import { ChainSources } from '../sources';
import { EventsIndexer } from '../threads';
import { NodeManager } from './NodeManager';
import { ReportManager } from './ReportManager';
import { StoreManager } from './StoreManager';

export class Managers {
	public store: StoreManager;
	public node: NodeManager;
	public report: ReportManager;

	constructor(public chain: ChainSources, public indexer: EventsIndexer) {
		this.node = new NodeManager(chain, indexer);
		this.store = new StoreManager(chain, indexer);
		this.report = new ReportManager(chain, indexer);
	}
}
