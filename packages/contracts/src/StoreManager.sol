// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

// Open Zeppelin libraries for controlling upgradability and access.
import {IERC20Upgradeable} from "../node_modules/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {Initializable} from "../node_modules/@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "../node_modules/@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../node_modules/@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {IStreamRegistry} from "./interfaces/StreamRegistry.sol";

// Owned by the NodeManager Contract
contract LogStoreManager is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    event StoreUpdated(
        string indexed store,
        bool indexed isNew,
        uint256 amount,
        address indexed updatedBy
    );
    event DataStored(string indexed store, uint256 fees, uint256 bytesStored);

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

    function exists(string calldata streamId) public view returns (bool) {
        return stores[streamId] > 0;
    }

    function captureBundle(
        string[] memory streamIds,
        uint256[] memory amounts,
        uint256[] memory bytesStored
    ) public {
        require(streamIds.length == amounts.length, "error_badRequest");
        for (uint256 i = 0; i < streamIds.length; i++) {
            capture(streamIds[i], amounts[i], bytesStored[i]);
        }
    }

    // Only the LogStore Contract can call the capture method
    function capture(
        string memory streamId,
        uint256 amount,
        uint256 bytesStored
    ) public onlyOwner returns (bool success) {
        require(
            amount <= stakeToken.balanceOf(address(this)),
            "error_notEnoughStake"
        );

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
                storeStakeholders[streamId] = new address[](0);
                for (uint256 j = 0; j < stakeholders.length; j++) {
                    if (stakeholders[j] != stakeholder) {
                        storeStakeholders[streamId].push(stakeholder);
                    }
                }
            }
        }
        stores[streamId] -= amount;
        totalSupply -= amount;

        bool transferSuccess = stakeToken.transfer(msg.sender, amount);
        require(transferSuccess == true, "error_unsuccessfulCapture");

        emit DataStored(streamId, amount, bytesStored);

        return transferSuccess;
    }

    function stake(string memory streamId, uint amount) public {
        // Validate stream is inside of StreamrRegiststry
        require(streamrRegistry.exists(streamId), "error_invalidStream");

        require(amount > 0, "error_insufficientStake");
        bool success = stakeToken.transferFrom(
            msg.sender,
            address(this),
            amount
        );
        require(success == true, "error_unsuccessfulStake");
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
}
