import { DataItem } from '@kyvejs/protocol';
import { SystemReport } from '@logsn/protocol';

import { EventsByBlock } from '../../src/threads';

export const getBundleFromComponents = ({
	messages,
	report,
	events,
}: {
	messages: DataItem[];
	report: SystemReport;
	events?: EventsByBlock[];
}) => {
	const bundle = [...messages];
	bundle[bundle.length - 1].value.r = report.serialize();
	if (events) {
		bundle[bundle.length - 1].value.e = events;
	}
	return bundle;
};

export const messagesMock: DataItem[] = [
	{ key: '0', value: { m: [] } },
	{ key: '1689263977', value: { m: [] } },
];
export const reportMock = new SystemReport({
	v: 1,
	s: false,
	id: '1689263977',
	height: 713,
	treasury: '0',
	streams: [],
	consumers: [],
	nodes: {},
	delegates: {},
	events: { queries: [], storage: [] },
}) satisfies SystemReport;
export const eventsMock = [
	{
		k: 1689263977,
		v: {
			DataStored: [{ address: 'dataStoredAddres' }],
			StakeDelegateUpdated: [],
			StoreUpdated: [{ address: 'storeUpdatedAddress' }],
		},
	},
] as EventsByBlock[];

export const mockBundle = getBundleFromComponents({
	messages: messagesMock,
	report: reportMock,
	events: eventsMock,
});
