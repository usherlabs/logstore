// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

// Open Zeppelin libraries for controlling upgradability and access.
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

// Owned by the NodeManager Contract
contract LogStoreQueryManager is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    event DataQueried(address indexed consumer, uint256 fees, uint256 bytesProcessed);
    event Stake(address indexed consumer, uint amount);
    event CaptureOverflow(address consumer, uint stake, uint capture, uint overflow);
    event SupplyOverflow(uint supply, uint capture, uint overflow);

    modifier onlyParent() {
        require(_msgSender() == parent, "error_onlyParent");
        _;
    }

    uint256 public totalSupply;
    address public stakeTokenAddress;
    mapping(address => uint256) public balanceOf; // map of addresses and their total balanace
    IERC20Upgradeable internal stakeToken;
    address internal parent;

    function initialize(address owner_, address parent_, address stakeTokenAddress_) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        require(stakeTokenAddress_ != address(0), "error_badTrackerData");
        stakeToken = IERC20Upgradeable(stakeTokenAddress_);
        stakeTokenAddress = stakeTokenAddress_;
        setParent(parent_);
        transferOwnership(owner_);
    }

    /// @dev required by the OZ UUPS module
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function setParent(address _parent) public onlyOwner {
        parent = _parent;
    }

    /// Capture funds for a given query
    /// Only the LogStore Contract can call the capture method
    /// @param amount amount of tokens to capture
    /// @param consumer address of the data consumer
    /// @param bytesProcessed number of bytes in the response
    function capture(address consumer, uint256 amount, uint256 bytesProcessed) public nonReentrant onlyParent {
        require(balanceOf[consumer] > 0, "error_invalidConsumerAddress");

        uint256 amountToTransfer = amount;
        if (balanceOf[consumer] < amount) {
            emit CaptureOverflow(consumer, balanceOf[consumer], amount, amount - balanceOf[consumer]);
            amountToTransfer = balanceOf[consumer];
            balanceOf[consumer] = 0;
        } else {
            balanceOf[consumer] -= amount;
        }
        if (totalSupply < amount) {
            emit SupplyOverflow(totalSupply, amount, amount - totalSupply);
            totalSupply = 0;
        } else {
            totalSupply -= amount;
        }

        require(amountToTransfer <= stakeToken.balanceOf(address(this)), "error_insufficientStake");

        bool success = stakeToken.transfer(msg.sender, amountToTransfer);
        require(success == true, "error_unsuccessfulCapture");

        emit DataQueried(consumer, amount, bytesProcessed);
    }

    function stake(uint amount) public nonReentrant {
        require(amount > 0, "error_insufficientStake");

        balanceOf[msg.sender] += amount;
        totalSupply += amount;

        bool success = stakeToken.transferFrom(msg.sender, address(this), amount);
        require(success == true, "error_unsuccessfulStake");
        emit Stake(msg.sender, amount);
    }
}
