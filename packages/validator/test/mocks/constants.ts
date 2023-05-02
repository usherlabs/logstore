import addresses from '@concertodao/logstore-contracts/address.json';

export const genesis_pool = {
	id: '0',
	data: {
		id: '0',
		name: 'Log Store Network',
		runtime: '@concertodao/logstore-validator',
		logo: 'ar://9FJDam56yBbmvn8rlamEucATH5UcYqSBw468rlCXn8E',
		config: `{
			"sources": ["http://localhost:8546"],
			"contracts": ${JSON.stringify(addresses[8997])}
		}`.replace(/\s/g, ''),
		start_key: '1681200822557',
		current_key: '',
		current_summary: '',
		current_index: '0',
		total_bundles: '0',
		upload_interval: '120',
		operating_cost: '2500000000',
		min_delegation: '0',
		max_bundle_size: '3',
		paused: false,
		funders: [
			{
				address: 'test_funder',
				amount: '100000000000',
			},
		],
		total_funds: '100000000000',
		protocol: {
			version: '0.0.0',
			binaries:
				'{"macos":"https://github.com/kyve-org/evm/releases/download/v1.0.5/kyve-evm-macos.zip"}',
			last_upgrade: '0',
		},
		upgrade_plan: {
			version: '',
			binaries: '',
			scheduled_at: '0',
			duration: '0',
		},
		current_storage_provider_id: 0,
		current_compression_id: 0,
	},
	bundle_proposal: {
		pool_id: '0',
		storage_id: '',
		uploader: '',
		next_uploader: '',
		data_size: '0',
		data_hash: '',
		bundle_size: '0',
		from_key: '',
		to_key: '',
		bundle_summary: '',
		updated_at: '0',
		voters_valid: [],
		voters_invalid: [],
		voters_abstain: [],
	},
	stakers: ['test_staker'],
	total_self_delegation: '100000000000',
	total_delegation: '100000000000',
	status: 'POOL_STATUS_ACTIVE',
};
