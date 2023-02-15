// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

// Open Zeppelin libraries for controlling upgradability and access.
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./StoreManager.sol";
import "./QueryManager.sol";

contract LogStoreNodeManager is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
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
    event ReportUpdated(uint256 indexed height, bool indexed accepted);

    enum WhitelistState {
        None,
        Approved,
        Rejected
    }

    struct Node {
        uint index; // index of node address
        string metadata; // Connection metadata, for example wss://node-domain-name:port
        uint lastSeen; // what's the best way to store timestamps in smart contracts?
    }

    struct Report {
        string id; // bundle id
    }

    modifier onlyWhitelist() {
        require(
            !requiresWhitelist ||
                whitelist[msg.sender] == WhitelistState.Approved,
            "error_notApproved"
        );
        _;
    }

    modifier onlyStaked() {
        require(
            stakeRequiredAmount > 0 &&
                balanceOf[msg.sender] >= stakeRequiredAmount,
            "error_stakeRequired"
        );
        _;
    }

    bool public requiresWhitelist;
    uint256 public totalSupply;
    uint256 public stakeRequiredAmount;
    address public stakeTokenAddress;
    address[] public nodeAddresses;
    address[] public reporters;
    uint256 public lastAcceptedReportBlockHeight;
    mapping(uint256 => Report) public reports;
    mapping(address => Node) public nodes;
    mapping(address => WhitelistState) public whitelist;
    mapping(address => uint256) public balanceOf;
    IERC20Upgradeable internal stakeToken;
    LogStoreManager private _storeManager;
    LogStoreQueryManager private _queryManager;

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
            "error_badTrackerData"
        );
        require(
            stakeTokenAddress != address(0) && stakeRequiredAmount_ > 0,
            "error_badTrackerData"
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

    function registerStoreManager(address contractAddress) public onlyOwner {
        _storeManager = LogStoreManager(contractAddress);
    }

    function registerQueryManager(address contractAddress) public onlyOwner {
        _queryManager = LogStoreQueryManager(contractAddress);
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

    // TODO: Update only access the funds in treasury
    function treasuryWithdraw(uint256 amount) public onlyOwner {
        require(
            amount <= stakeToken.balanceOf(address(this)),
            "error_notEnoughStake"
        );
        bool success = stakeToken.transfer(msg.sender, amount);
        require(success == true, "error_unsuccessfulWithdraw");
    }

    function upsertNode(
        string memory metadata_
    ) public onlyWhitelist onlyStaked {
        _upsertNode(msg.sender, metadata_);
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

    // recieve report data broken up into a series of arrays
    function report() public onlyStaked {
        if (reporters.length == 0) {
            // A condition that will be true on the first report
            // reportList = nodeAddresses;
        }

        // Consume report data
        // Produce new reportList
        // Capture fees from LogStoreManager
        // _storeManager.captureBundle(streamIds, amounts, bytesStored);
    }

    function stake(uint amount) public {
        require(amount > 0, "error_insufficientStake");

        balanceOf[msg.sender] += amount;
        totalSupply += amount;

        bool success = stakeToken.transferFrom(
            msg.sender,
            address(this),
            amount
        );
        require(success == true, "error_unsuccessfulStake");
    }

    function withdraw(uint amount) public {
        require(amount <= balanceOf[msg.sender], "error_notEnoughStake");

        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;

        bool success = stakeToken.transfer(msg.sender, amount);
        require(success == true, "error_unsuccessfulWithdraw");
    }

    function _upsertNode(
        address nodeAddress,
        string memory metadata_
    ) internal {
        Node memory n = nodes[nodeAddress];
        uint isNew = 0;
        if (n.lastSeen == 0) {
            isNew = 1;
            nodeAddresses.push(nodeAddress);
            nodes[nodeAddress] = Node({
                index: nodeAddresses.length - 1,
                metadata: metadata_,
                lastSeen: block.timestamp // block timestamp should suffice
            });
        } else {
            nodes[nodeAddress] = Node({
                index: n.index,
                metadata: metadata_,
                lastSeen: block.timestamp
            });
        }
        emit NodeUpdated(nodeAddress, n.metadata, isNew, n.lastSeen);
    }

    function _removeNode(address nodeAddress) internal {
        Node memory n = nodes[nodeAddress];
        require(n.lastSeen != 0, "error_notFound");
        nodes[nodeAddresses[nodeAddresses.length - 1]].index = n.index; // set index of last node to the index of removed node
        nodeAddresses[n.index] = nodeAddresses[nodeAddresses.length - 1]; // replace removed node with last node
        delete nodes[nodeAddress];
        nodeAddresses.pop();
        emit NodeRemoved(nodeAddress);
    }

    function nodeCount() public view returns (uint count) {
        return nodeAddresses.length;
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
