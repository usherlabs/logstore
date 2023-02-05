// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

// Open Zeppelin libraries for controlling upgradability and access.
import '@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import 'streamr-contracts/packages/network-contracts/contracts/StreamRegistry/StreamRegistryV4.sol'; // https://github.com/streamr-dev/network-contracts/blob/master/packages/network-contracts/contracts/StreamRegistry/StreamRegistryV4.sol

// Owned by the NodeManager Contract
contract LogStoreManager is Initializable, UUPSUpgradeable, OwnableUpgradeable {
	event StoreUpdated(
		string indexed store,
		bool isNew,
		uint256 indexed amount,
		address indexed updatedBy
	);
	event DataStored(
		string indexed store,
		uint256 indexed fees,
		uint256 indexed bytesStored
	);

	uint256 public totalSupply;
	address public stakeTokenAddress;
	address public streamrRegistryAddress;
	mapping(string => uint256) public stores; // map of stores and their total balance
	mapping(string => address[]) public storeStakeholders; // map of stores and their stakeholders.
	mapping(address => uint256) public balanceOf; // map of addresses and their total balanace
	mapping(address => mapping(string => uint256)) public storeBalanceOf; // map of addresses and the stores they're staked in
	IERC20Upgradeable internal stakeToken;

	function initialize(
		address owner,
		address stakeTokenAddress_,
		address streamrRegistryAddress_
	) public initializer {
		__Ownable_init();
		__UUPSUpgradeable_init();
		require(stakeTokenAddress != address(0), 'error_badTrackerData');
		stakeToken = IERC20Upgradeable(stakeTokenAddress_);
		streamrRegistry = StreamRegistryV4(streamrRegistryAddress_);
		stakeTokenAddress = stakeTokenAddress_;
		streamrRegistryAddress = streamrRegistryAddress_;
		transferOwnership(owner);
	}

	/// @dev required by the OZ UUPS module
	function _authorizeUpgrade(address) internal override onlyOwner {}

	function exists(string calldata streamId) public view returns (bool) {
		return stores[streamId] > 0;
	}

	function captureBundle(
		string[] memory streamIds,
		uint256[] memory amounts,
		uint256[] memory bytesStored
	) public {
		require(streamIds.length == amounts.length, 'error_badRequest');
		for (uint256 i = 0; i < streamIds.length; i++) {
			capture(streamIds[i], amounts[i], bytesStored[i]);
		}
	}

	// Only the LogStore Contract can call the capture method
	function capture(
		string memory streamId,
		uint256 amount,
		uint256 memory bytesStored
	) public onlyOwner {
		require(
			amount <= stakeToken.balanceOf(address(this)),
			'error_notEnoughStake'
		);
		bool success = stakeToken.transfer(msg.sender, amount);
		require(success == true, 'error_unsuccessfulCapture');
		address[] memory stakeholders = storeStakeholders[streamId];
		// Determine the fee amounts proportional to each stakeholder stake amount
		for (uint256 i = 0; i < stakeholders.length; i++) {
			address stakeholder = stakeholders[i];
			uint256 stakeOwnership = storeBalanceOf[stakeholder][streamId] /
				stores[streamId];
			uint256 deduction = stakeOwnership * amount;
			balanceOf[stakeholder] -= deduction;
			storeBalanceOf[stakeholder][streamId] -= deduction;
			if (storeBalanceOf[stakeholder][streamId] == 0) {
				storeStakeholders[streamId] = [];
				for (uint256 i = 0; i < stakeholders.length; i++) {
					if (stakeholders[i] != stakeholder) {
						storeStakeholders[streamId].push(stakeholder);
					}
				}
			}
		}
		stores[streamId] -= amount;
		totalSupply -= amount;

		emit DataStored(streamId, amount, bytesStored);
	}

	function stake(string memory streamId, uint amount) public {
		// Validate stream is inside of StreamrRegiststry
		require(streamrRegistry.exists(streamId), 'error_invalidStream');

		require(amount > 0, 'error_insufficientStake');
		bool success = stakeToken.transferFrom(
			msg.sender,
			address(this),
			amount
		);
		require(success == true, 'error_unsuccessfulStake');
		bool isNew = false;
		if (stores[streamId] == 0) {
			isNew = true;
		}
		stores[streamId] += amount;
		balanceOf[msg.sender] += amount;
		if (storeBalanceOf[msg.sender][streamId] == 0) {
			storeStakeholders[streamId].push(msg.sender);
		}
		storeBalanceOf[msg.sender][streamId] += amount;
		totalSupply += amount;
		emit StoreUpdated(streamId, isNew, amount, msg.sender);
	}

	function withdraw(string memory streamId, uint amount) public {
		require(amount < balanceOf[msg.sender], 'error_notEnoughStake');
		bool success = stakeToken.transfer(msg.sender, amount);
		require(success == true, 'error_unsuccessfulWithdraw');
		stores[stream] -= amount;
		balanceOf[msg.sender] -= amount;
		storeBalanceOf[msg.sender][streamId] -= amount;
		if (storeBalanceOf[msg.sender][streamId] == 0) {
			address[] memory stakeholders = storeStakeholders[streamId];
			storeStakeholders[streamId] = [];
			for (uint256 i = 0; i < stakeholders.length; i++) {
				if (stakeholders[i] != msg.sender) {
					storeStakeholders[streamId].push(msg.sender);
				}
			}
		}
		totalSupply -= amount;
		emit StoreUpdated(streamId, false, amount, msg.sender);
	}
}
