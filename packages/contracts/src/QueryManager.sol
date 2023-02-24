// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

// Open Zeppelin libraries for controlling upgradability and access.
import {IERC20Upgradeable} from "../node_modules/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {Initializable} from "../node_modules/@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "../node_modules/@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../node_modules/@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {IStreamRegistry} from "./interfaces/StreamRegistry.sol";

// Owned by the NodeManager Contract
contract LogStoreQueryManager is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    event DataQueried(
        string indexed store,
        uint256 fees,
        address indexed consumer,
        uint256 bytesProcessed
    );

    uint256 public totalSupply;
    address public stakeTokenAddress;
    mapping(string => uint256) public stores; // map of stores and their total balance
    mapping(string => address[]) public storeStakeholders; // map of stores and their stakeholders.
    mapping(address => uint256) public balanceOf; // map of addresses and their total balanace
    mapping(address => mapping(string => uint256)) public storeBalanceOf; // map of addresses and the stores they're staked in
    IERC20Upgradeable internal stakeToken;
    IStreamRegistry internal streamrRegistry;

    function initialize(
        address owner,
        address stakeTokenAddress_,
        address streamrRegistryAddress_
    ) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        require(stakeTokenAddress != address(0), "error_badTrackerData");
        stakeToken = IERC20Upgradeable(stakeTokenAddress_);
        streamrRegistry = IStreamRegistry(streamrRegistryAddress_);
        stakeTokenAddress = stakeTokenAddress_;
        transferOwnership(owner);
    }

    /// @dev required by the OZ UUPS module
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function captureBundle(
        string[] memory streamIds,
        uint256[] memory amounts,
        address[] memory consumers,
        uint256[] memory bytesProcessed
    ) public {
        require(streamIds.length == amounts.length, "error_badRequest");
        for (uint256 i = 0; i < streamIds.length; i++) {
            capture(streamIds[i], amounts[i], consumers[i], bytesProcessed[i]);
        }
    }

    /// Capture funds for a given query
    /// Only the LogStore Contract can call the capture method
    /// @param streamId id of stream in store
    /// @param amount amount of tokens to capture
    /// @param consumer address of the data consumer
    /// @param bytesProcessed number of bytes in the response
    function capture(
        string memory streamId,
        uint256 amount,
        address consumer,
        uint256 bytesProcessed
    ) public onlyOwner {
        require(
            amount <= stakeToken.balanceOf(address(this)),
            "error_notEnoughStake"
        );

        balanceOf[consumer] -= amount;
        storeBalanceOf[consumer][streamId] -= amount;
        if (storeBalanceOf[consumer][streamId] == 0) {
            for (uint256 i = 0; i < storeStakeholders[streamId].length; i++) {
                if (storeStakeholders[streamId][i] == consumer) {
                    address lastStakeholder = storeStakeholders[streamId][
                        storeStakeholders[streamId].length - 1
                    ];
                    storeStakeholders[streamId][i] = lastStakeholder;
                    storeStakeholders[streamId].pop(); // remove last element.
                    break;
                }
            }
        }
        stores[streamId] -= amount;
        totalSupply -= amount;

        bool success = stakeToken.transfer(msg.sender, amount);
        require(success == true, "error_unsuccessfulCapture");

        emit DataQueried(streamId, amount, consumer, bytesProcessed);
    }

    function stake(string memory streamId, uint amount) public {
        // Validate stream is inside of StreamrRegiststry
        // We use the registry here because a store is removed when stake expires, and queries can persist even after the store is lost.
        require(streamrRegistry.exists(streamId), "error_invalidStream");
        require(amount > 0, "error_insufficientStake");

        stores[streamId] += amount;
        balanceOf[msg.sender] += amount;
        if (storeBalanceOf[msg.sender][streamId] == 0) {
            storeStakeholders[streamId].push(msg.sender);
        }
        storeBalanceOf[msg.sender][streamId] += amount;
        totalSupply += amount;

        bool success = stakeToken.transferFrom(
            msg.sender,
            address(this),
            amount
        );
        require(success == true, "error_unsuccessfulStake");
    }
}
