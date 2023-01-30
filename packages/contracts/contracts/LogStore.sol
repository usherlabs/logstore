// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

// Open Zeppelin libraries for controlling upgradability and access.
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

contract LogStore is Initializable, UUPSUpgradeable, OwnableUpgradeable {
	event NodeUpdated(
		address indexed nodeAddress,
		string metadata,
		uint indexed isNew,
		uint lastSeen
	);
	event NodeRemoved(address indexed nodeAddress);
	event NodeWhitelistApproved(address indexed nodeAddress);
	event NodeWhitelistRejected(address indexed nodeAddress);
	event RequiresWhitelistChanged(bool indexed value);

	enum WhitelistState {
		None,
		Approved,
		Rejected
	}

	struct Node {
		uint256 stake;
		string metadata; // Connection metadata, for example wss://node-domain-name:port
		uint lastSeen; // what's the best way to store timestamps in smart contracts?
	}

	modifier onlyWhitelist() {
		require(
			!requiresWhitelist ||
				whitelist[msg.sender] == WhitelistState.Approved,
			'error_notApproved'
		);
		_;
	}

	uint64 public nodeCount;
	bool public requiresWhitelist;
	mapping(address => uint256) public currencies;
	mapping(address => Node) public nodes;
	mapping(address => WhitelistState) public whitelist;

	function initialize(
		address owner,
		bool requiresWhitelist_,
		address[] memory initialNodes,
		string[] memory initialMetadata
	) public initializer {
		__Ownable_init();
		__UUPSUpgradeable_init();
		requiresWhitelist = requiresWhitelist_;
		for (uint i = 0; i < initialNodes.length; i++) {
			upsertNodeAdmin(initialNodes[i], initialMetadata[i]);
		}
		transferOwnership(owner);
	}

	/// @dev required by the OZ UUPS module
	function _authorizeUpgrade(address) internal override onlyOwner {}

	function addNewOperatorStakeCurrency(
		address tokenAddress,
		uint256 amount
	) public onlyOwner {
		currencies[tokenAddress] = amount;
	}

	function upsertNodeAdmin(
		address node,
		string memory metadata_
	) public onlyOwner {
		_upsertNode(node, metadata_);
	}

	function removeNodeAdmin(address nodeAddress) public onlyOwner {
		_removeNode(nodeAddress);
	}

	function upsertNode(string memory metadata_) public onlyWhitelist {
		_upsertNode(msg.sender, metadata_);
	}

	function removeNode() public {
		_removeNode(msg.sender);
	}

	function _upsertNode(
		address nodeAddress,
		string memory metadata_
	) internal {
		Node memory n = nodes[nodeAddress];
		uint isNew = 0;
		if (n.lastSeen == 0) {
			isNew = 1;
			nodes[nodeAddress] = Node({
				stake: 0,
				metadata: metadata_,
				lastSeen: block.timestamp
			});
			nodeCount++;
		} else {
			nodes[nodeAddress] = Node({
				stake: n.stake,
				metadata: metadata_,
				lastSeen: block.timestamp
			});
		}
		emit NodeUpdated(nodeAddress, n.metadata, isNew, n.lastSeen);
	}

	function _removeNode(address nodeAddress) internal {
		Node memory n = nodes[nodeAddress];
		require(n.lastSeen != 0, 'error_notFound');
		delete nodes[nodeAddress];
		nodeCount--;
		emit NodeRemoved(nodeAddress);
	}

	function whitelistApproveNode(address nodeAddress) public onlyOwner {
		whitelist[nodeAddress] = WhitelistState.Approved;
		emit NodeWhitelistApproved(nodeAddress);
	}

	function whitelistRejectNode(address nodeAddress) public onlyOwner {
		whitelist[nodeAddress] = WhitelistState.Rejected;
		emit NodeWhitelistRejected(nodeAddress);
	}

	function kickNode(address nodeAddress) public onlyOwner {
		whitelistRejectNode(nodeAddress);
		removeNodeAdmin(nodeAddress);
	}

	function setRequiresWhitelist(bool value) public onlyOwner {
		requiresWhitelist = value;
		emit RequiresWhitelistChanged(value);
	}
}
