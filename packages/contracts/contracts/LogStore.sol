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
	event StakeUpdate(uint256 indexed requiredAmount);

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

	modifier onlyStaked() {
		require(
			stakeRequiredAmount > 0 &&
				balanceOf[msg.sender] >= stakeRequiredAmount,
			'error_stakeRequired'
		);
		_;
	}

	uint64 public nodeCount;
	bool public requiresWhitelist;
	uint256 public totalSupply;
	uint256 public stakeRequiredAmount;
	address public stakeTokenAddress;
	mapping(address => Node) public nodes;
	mapping(address => WhitelistState) public whitelist;
	mapping(address => uint256) internal index;
	mapping(address => uint256) internal balanceOf;
	IERC20Upgradeable internal stakeToken;

	function initialize(
		address owner,
		bool requiresWhitelist_,
		address stakeTokenAddress_,
		uint256 stakeRequiredAmount_,
		address[] memory initialNodes,
		string[] memory initialMetadata
	) public initializer {
		__Ownable_init();
		__UUPSUpgradeable_init();
		requiresWhitelist = requiresWhitelist_;
		require(
			initialNodes.length == initialMetadata.length,
			'error_badTrackerData'
		);
		require(
			stakeTokenAddress != address(0) && stakeRequiredAmount_ > 0,
			'error_badTrackerData'
		);
		stakeToken = IERC20Upgradeable(stakeTokenAddress_);
		stakeTokenAddress = stakeTokenAddress_;
		stakeRequiredAmount = stakeRequiredAmount_;
		for (uint i = 0; i < initialNodes.length; i++) {
			upsertNodeAdmin(initialNodes[i], initialMetadata[i]);
		}
		transferOwnership(owner);
	}

	/// @dev required by the OZ UUPS module
	function _authorizeUpgrade(address) internal override onlyOwner {}

	function updateStakeRequiredAmount(uint256 amount) public onlyOwner {
		stakeRequiredAmount = amount;
		emit StakeUpdate(amount);
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

	function getBalance() public view returns (uint256 balance) {
		return balanceOf[msg.sender];
	}

	function removeNode() public {
		_removeNode(msg.sender);
	}

	function join(uint amount, string memory metadata_) public {
		stake(amount);
		upsertNode(metadata_);
	}

	function leave() public {
		withdraw(balanceOf[msg.sender]);
		removeNode();
	}

	function stake(uint amount) public {
		require(amount > 0, 'error_insufficientStake');
		bool success = stakeToken.transferFrom(
			msg.sender,
			address(this),
			amount
		);
		require(success == true, 'error_unsuccessfulStake');
		balanceOf[msg.sender] += amount;
		totalSupply += amount;
	}

	function withdraw(uint amount) public {
		require(amount <= balanceOf[msg.sender], 'error_insufficientStake');
		bool success = stakeToken.transfer(msg.sender, amount);
		require(success == true, 'error_unsuccessfulWithdraw');
		balanceOf[msg.sender] -= amount;
		totalSupply -= amount;
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
