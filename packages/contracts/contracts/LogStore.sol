// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

// Open Zeppelin libraries for controlling upgradability and access.
import '@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol';
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
	event CurrencyAdded(
		address indexed tokenAddress,
		uint256 indexed requiredAmount
	);

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

	struct Currency {
		IERC20Upgradeable token;
		uint256 requiredAmount; // Required amount of currency to be staked
		mapping(address => uint256) balanceOf;
		uint256 totalSupply;
	}

	modifier onlyWhitelist() {
		require(
			!requiresWhitelist ||
				whitelist[msg.sender] == WhitelistState.Approved,
			'error_notApproved'
		);
		_;
	}

	modifier onlyStaked(address tokenAddress) {
		require(
			currencies[tokenAddress].requiredAmount > 0 &&
				currencies[tokenAddress].balanceOf[msg.sender] >=
				currencies[tokenAddress].requiredAmount,
			'error_stakeRequired'
		);
		_;
	}

	uint64 public nodeCount;
	bool public requiresWhitelist;
	mapping(address => Currency) public currencies;
	mapping(address => Node) public nodes;
	mapping(address => WhitelistState) public whitelist;
	mapping(address => uint256) internal index;

	function initialize(
		address owner,
		bool requiresWhitelist_,
		address[] memory initialNodes,
		string[] memory initialMetadata,
		address[] memory currencyAddresses,
		uint256[] memory currencyRequiredAmounts
	) public initializer {
		__Ownable_init();
		__UUPSUpgradeable_init();
		requiresWhitelist = requiresWhitelist_;
		require(
			initialNodes.length == initialMetadata.length,
			'error_badTrackerData'
		);
		require(
			currencyAddresses.length == currencyRequiredAmounts.length,
			'error_badTrackerData'
		);
		for (uint i = 0; i < initialNodes.length; i++) {
			upsertNodeAdmin(initialNodes[i], initialMetadata[i]);
		}
		for (uint i = 0; i < currencyAddresses.length; i++) {
			addNewOperatorStakeCurrency(
				currencyAddresses[i],
				currencyRequiredAmounts[i]
			);
		}
		transferOwnership(owner);
	}

	/// @dev required by the OZ UUPS module
	function _authorizeUpgrade(address) internal override onlyOwner {}

	function addNewOperatorStakeCurrency(
		address tokenAddress,
		uint256 amount
	) public onlyOwner {
		currencies[tokenAddress].token = IERC20Upgradeable(tokenAddress);
		currencies[tokenAddress].requiredAmount = amount;
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

	function upsertNode(
		string memory metadata_
	) public onlyWhitelist onlyStaked {
		_upsertNode(msg.sender, metadata_);
	}

	function removeNode() public {
		_removeNode(msg.sender);
	}

	function stake(address tokenAddress, uint amount) external {
		require(
			currencies[tokenAddress].requiredAmount > 0,
			'error_invalidCurrency'
		);
		require(amount > 0, 'error_insufficientStake');
		currencies[tokenAddress].token.transferFrom(
			msg.sender,
			address(this),
			amount
		);
		currencies[tokenAddress].balanceOf[msg.sender] += amount;
		currencies[tokenAddress].totalSupply += amount;
	}

	function withdraw(address tokenAddress, uint amount) external {
		require(
			currencies[tokenAddress].requiredAmount > 0,
			'error_invalidCurrency'
		);
		require(amount > 0, 'error_insufficientStake');
		currencies[tokenAddress].balanceOf[msg.sender] -= amount;
		currencies[tokenAddress].totalSupply -= amount;
		currencies[tokenAddress].token.transfer(msg.sender, amount);
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
