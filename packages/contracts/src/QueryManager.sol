// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

// Open Zeppelin libraries for controlling upgradability and access.
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

// Owned by the NodeManager Contract
contract LogStoreQueryManager is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    event DataQueried(address indexed consumer, uint256 fees, uint256 bytesProcessed);
    event Stake(address indexed consumer, uint amount);

    uint256 public totalSupply;
    address public stakeTokenAddress;
    mapping(address => uint256) public balanceOf; // map of addresses and their total balanace
    IERC20Upgradeable internal stakeToken;

    function initialize(address owner, address stakeTokenAddress_) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        require(stakeTokenAddress_ != address(0), "error_badTrackerData");
        stakeToken = IERC20Upgradeable(stakeTokenAddress_);
        stakeTokenAddress = stakeTokenAddress_;
        transferOwnership(owner);
    }

    /// @dev required by the OZ UUPS module
    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// Capture funds for a given query
    /// Only the LogStore Contract can call the capture method
    /// @param amount amount of tokens to capture
    /// @param consumer address of the data consumer
    /// @param bytesProcessed number of bytes in the response
    function capture(address consumer, uint256 amount, uint256 bytesProcessed) public onlyOwner {
        require(amount <= stakeToken.balanceOf(address(this)), "error_notEnoughStake");

        balanceOf[consumer] -= amount;
        totalSupply -= amount;

        bool success = stakeToken.transfer(msg.sender, amount);
        require(success == true, "error_unsuccessfulCapture");

        emit DataQueried(consumer, amount, bytesProcessed);
    }

    function stake(uint amount) public {
        require(amount > 0, "error_insufficientStake");

        balanceOf[msg.sender] += amount;
        totalSupply += amount;

        bool success = stakeToken.transferFrom(msg.sender, address(this), amount);
        require(success == true, "error_unsuccessfulStake");
        emit Stake(msg.sender, amount);
    }
}
