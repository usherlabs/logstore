// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

// Open Zeppelin libraries for controlling upgradability and access.
import '@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

contract LogStoreStreamManager is
	Initializable,
	UUPSUpgradeable,
	OwnableUpgradeable
{
	event StreamUpdated(string indexed stream);

	modifier onlyStaked() {
		require(balanceOf[msg.sender] > 0, 'error_stakeRequired');
		_;
	}

	uint256 public totalSupply;
	address public stakeTokenAddress;
	mapping(string => uint256) public streams;
	mapping(address => uint256) public balanceOf;
	IERC20Upgradeable internal stakeToken;

	function initialize(
		address owner,
		address stakeTokenAddress_,
		string[] memory initialStreams
	) public initializer {
		__Ownable_init();
		__UUPSUpgradeable_init();
		require(stakeTokenAddress != address(0), 'error_badTrackerData');
		stakeToken = IERC20Upgradeable(stakeTokenAddress_);
		stakeTokenAddress = stakeTokenAddress_;
		for (uint i = 0; i < initialStreams.length; i++) {
			// TODO: Add method to create Stream
		}
		transferOwnership(owner);
	}

	/// @dev required by the OZ UUPS module
	function _authorizeUpgrade(address) internal override onlyOwner {}

	function create(string memory stream, uint amount) public {
		// TODO: Add public log store stream creation
		stake(stream, amount);
	}

	function destroy(string memory stream, uint amount) public {
		// TODO: Add public log store stream destroy
		withdraw(stream, amount);
	}

	function stake(string memory stream, uint amount) public {
		require(amount > 0, 'error_insufficientStake');
		bool success = stakeToken.transferFrom(
			msg.sender,
			address(this),
			amount
		);
		require(success == true, 'error_unsuccessfulStake');
		balanceOf[msg.sender] += amount;
		streams[stream] += amount;
		totalSupply += amount;
	}

	function withdraw(string memory stream, uint amount) public {
		require(amount <= balanceOf[msg.sender], 'error_notEnoughStake');
		bool success = stakeToken.transfer(msg.sender, amount);
		require(success == true, 'error_unsuccessfulWithdraw');
		balanceOf[msg.sender] -= amount;
		streams[stream] -= amount;
		if (streams[stream] <= 0) {
			delete streams[stream];
		}
		totalSupply -= amount;
	}
}
