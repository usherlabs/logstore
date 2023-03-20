export const reportContractABI = [
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: 'address',
				name: 'previousAdmin',
				type: 'address',
			},
			{
				indexed: false,
				internalType: 'address',
				name: 'newAdmin',
				type: 'address',
			},
		],
		name: 'AdminChanged',
		type: 'event',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: 'address',
				name: 'beacon',
				type: 'address',
			},
		],
		name: 'BeaconUpgraded',
		type: 'event',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: 'uint8',
				name: 'version',
				type: 'uint8',
			},
		],
		name: 'Initialized',
		type: 'event',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: 'address',
				name: 'previousOwner',
				type: 'address',
			},
			{
				indexed: true,
				internalType: 'address',
				name: 'newOwner',
				type: 'address',
			},
		],
		name: 'OwnershipTransferred',
		type: 'event',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: 'string',
				name: 'raw',
				type: 'string',
			},
		],
		name: 'ReportAccepted',
		type: 'event',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: 'address',
				name: 'implementation',
				type: 'address',
			},
		],
		name: 'Upgraded',
		type: 'event',
	},
	{
		inputs: [],
		name: 'getLastReport',
		outputs: [
			{
				components: [
					{
						internalType: 'string',
						name: 'id',
						type: 'string',
					},
					{
						internalType: 'uint256',
						name: 'height',
						type: 'uint256',
					},
					{
						internalType: 'uint256',
						name: 'fee',
						type: 'uint256',
					},
					{
						components: [
							{
								internalType: 'string',
								name: 'id',
								type: 'string',
							},
							{
								internalType: 'address[]',
								name: 'consumers',
								type: 'address[]',
							},
							{
								internalType: 'uint256[]',
								name: 'queried',
								type: 'uint256[]',
							},
							{
								components: [
									{
										internalType: 'address',
										name: 'id',
										type: 'address',
									},
									{
										internalType: 'uint256',
										name: 'observed',
										type: 'uint256',
									},
									{
										internalType: 'uint256',
										name: 'missed',
										type: 'uint256',
									},
									{
										internalType: 'uint256',
										name: 'queried',
										type: 'uint256',
									},
								],
								internalType: 'struct LogStoreReportManager.Node[]',
								name: 'nodes',
								type: 'tuple[]',
							},
							{
								internalType: 'uint256',
								name: '_read',
								type: 'uint256',
							},
							{
								internalType: 'uint256',
								name: '_write',
								type: 'uint256',
							},
						],
						internalType: 'struct LogStoreReportManager.Stream[]',
						name: 'streams',
						type: 'tuple[]',
					},
					{
						internalType: 'uint256',
						name: '_read',
						type: 'uint256',
					},
					{
						internalType: 'uint256',
						name: '_write',
						type: 'uint256',
					},
					{
						internalType: 'bool',
						name: '_processed',
						type: 'bool',
					},
				],
				internalType: 'struct LogStoreReportManager.Report',
				name: '',
				type: 'tuple',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'string',
				name: 'id',
				type: 'string',
			},
		],
		name: 'getReport',
		outputs: [
			{
				components: [
					{
						internalType: 'string',
						name: 'id',
						type: 'string',
					},
					{
						internalType: 'uint256',
						name: 'height',
						type: 'uint256',
					},
					{
						internalType: 'uint256',
						name: 'fee',
						type: 'uint256',
					},
					{
						components: [
							{
								internalType: 'string',
								name: 'id',
								type: 'string',
							},
							{
								internalType: 'address[]',
								name: 'consumers',
								type: 'address[]',
							},
							{
								internalType: 'uint256[]',
								name: 'queried',
								type: 'uint256[]',
							},
							{
								components: [
									{
										internalType: 'address',
										name: 'id',
										type: 'address',
									},
									{
										internalType: 'uint256',
										name: 'observed',
										type: 'uint256',
									},
									{
										internalType: 'uint256',
										name: 'missed',
										type: 'uint256',
									},
									{
										internalType: 'uint256',
										name: 'queried',
										type: 'uint256',
									},
								],
								internalType: 'struct LogStoreReportManager.Node[]',
								name: 'nodes',
								type: 'tuple[]',
							},
							{
								internalType: 'uint256',
								name: '_read',
								type: 'uint256',
							},
							{
								internalType: 'uint256',
								name: '_write',
								type: 'uint256',
							},
						],
						internalType: 'struct LogStoreReportManager.Stream[]',
						name: 'streams',
						type: 'tuple[]',
					},
					{
						internalType: 'uint256',
						name: '_read',
						type: 'uint256',
					},
					{
						internalType: 'uint256',
						name: '_write',
						type: 'uint256',
					},
					{
						internalType: 'bool',
						name: '_processed',
						type: 'bool',
					},
				],
				internalType: 'struct LogStoreReportManager.Report',
				name: '',
				type: 'tuple',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: 'owner',
				type: 'address',
			},
		],
		name: 'initialize',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [],
		name: 'owner',
		outputs: [
			{
				internalType: 'address',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'string',
				name: 'id',
				type: 'string',
			},
		],
		name: 'processReport',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [],
		name: 'proxiableUUID',
		outputs: [
			{
				internalType: 'bytes32',
				name: '',
				type: 'bytes32',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'renounceOwnership',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'string',
				name: 'bundleId',
				type: 'string',
			},
			{
				internalType: 'uint256',
				name: 'blockHeight',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: 'fee',
				type: 'uint256',
			},
			{
				internalType: 'string[]',
				name: 'streams',
				type: 'string[]',
			},
			{
				internalType: 'address[][]',
				name: 'nodesPerStream',
				type: 'address[][]',
			},
			{
				internalType: 'uint256[][]',
				name: 'bytesObservedPerNode',
				type: 'uint256[][]',
			},
			{
				internalType: 'uint256[][]',
				name: 'bytesMissedPerNode',
				type: 'uint256[][]',
			},
			{
				internalType: 'uint256[][]',
				name: 'bytesQueriedPerNode',
				type: 'uint256[][]',
			},
			{
				internalType: 'address[][]',
				name: 'consumerAddresses',
				type: 'address[][]',
			},
			{
				internalType: 'uint256[][]',
				name: 'bytesQueriedPerConsumer',
				type: 'uint256[][]',
			},
			{
				internalType: 'address[]',
				name: 'addresses',
				type: 'address[]',
			},
			{
				internalType: 'bytes[]',
				name: 'signatures',
				type: 'bytes[]',
			},
		],
		name: 'report',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: 'newOwner',
				type: 'address',
			},
		],
		name: 'transferOwnership',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: 'newImplementation',
				type: 'address',
			},
		],
		name: 'upgradeTo',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: 'newImplementation',
				type: 'address',
			},
			{
				internalType: 'bytes',
				name: 'data',
				type: 'bytes',
			},
		],
		name: 'upgradeToAndCall',
		outputs: [],
		stateMutability: 'payable',
		type: 'function',
	},
];
