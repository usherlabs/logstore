// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

// Open Zeppelin libraries for controlling upgradability and access.
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {IStreamRegistry} from "./interfaces/StreamRegistry.sol";
import {StringsUpgradeable} from "./lib/StringsUpgradeable.sol";
import {LogStoreManager} from "./StoreManager.sol";
import {LogStoreQueryManager} from "./QueryManager.sol";
import {LogStoreReportManager} from "./ReportManager.sol";

contract LogStoreNodeManager is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    string public constant LOGSTORE_STORE_SYSTEM_STREAM_ID_PATH = "/logstore-system";
    string public constant LOGSTORE_QUERY_SYSTEM_STREAM_ID_PATH = "/logstore-query";
    /* solhint-disable quotes */
    string public constant LOGSTORE_STORE_SYSTEM_STREAM_METADATA_JSON_STRING = '{ "partitions": 1 }';
    string public constant LOGSTORE_QUERY_SYSTEM_STREAM_METADATA_JSON_STRING = '{ "partitions": 1 }';
    /* solhint-enable quotes */

    event NodeUpdated(address indexed nodeAddress, string metadata, uint indexed isNew, uint lastSeen);
    event NodeRemoved(address indexed nodeAddress);
    event NodeStakeUpdated(address indexed nodeAddress, uint stake);
    event NodeWhitelistApproved(address indexed nodeAddress);
    event NodeWhitelistRejected(address indexed nodeAddress);
    event RequiresWhitelistChanged(bool indexed value);
    event ReportProcessed(string id);

    enum WhitelistState {
        None,
        Approved,
        Rejected
    }

    struct Node {
        uint index; // index of node address
        string metadata; // Connection metadata, for example wss://node-domain-name:port
        uint lastSeen; // what's the best way to store timestamps in smart contracts?
        address next;
        address prev;
        uint256 stake;
        address[] delegates;
        mapping(address => bool) delegateExists;
    }

    modifier onlyWhitelist() {
        require(!requiresWhitelist || whitelist[msg.sender] == WhitelistState.Approved, "error_notApproved");
        _;
    }

    modifier onlyStaked() {
        require(isStaked(msg.sender), "error_stakeRequired");
        _;
    }

    bool public requiresWhitelist;
    uint256 public totalSupply;
    uint256 public treasurySupply;
    uint256 public stakeRequiredAmount;
    address public stakeTokenAddress;
    uint256 public totalNodes;
    mapping(address => Node) public nodes;
    mapping(address => WhitelistState) public whitelist;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public delegatesOf;
    address public headNode;
    address public tailNode;
    string internal storeStreamId;
    string internal queryStreamId;
    IERC20Upgradeable internal stakeToken;
    LogStoreManager private _storeManager;
    LogStoreQueryManager private _queryManager;
    LogStoreReportManager private _reportManager;
    IStreamRegistry private streamrRegistry;

    function initialize(
        address owner_,
        bool requiresWhitelist_,
        address stakeTokenAddress_,
        uint256 stakeRequiredAmount_,
        address streamrRegistryAddress_,
        address[] memory initialNodes,
        string[] calldata initialMetadata
    ) public initializer {
        require(initialNodes.length == initialMetadata.length, "error_badTrackerData");
        require(stakeTokenAddress_ != address(0) && stakeRequiredAmount_ > 0, "error_badTrackerData");

        __Ownable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        requiresWhitelist = requiresWhitelist_;
        stakeToken = IERC20Upgradeable(stakeTokenAddress_);
        stakeTokenAddress = stakeTokenAddress_;
        stakeRequiredAmount = stakeRequiredAmount_;
        streamrRegistry = IStreamRegistry(streamrRegistryAddress_);

        streamrRegistry.createStream(LOGSTORE_STORE_SYSTEM_STREAM_ID_PATH, LOGSTORE_STORE_SYSTEM_STREAM_METADATA_JSON_STRING);
        streamrRegistry.createStream(LOGSTORE_QUERY_SYSTEM_STREAM_ID_PATH, LOGSTORE_QUERY_SYSTEM_STREAM_METADATA_JSON_STRING);

        storeStreamId = string(
            abi.encodePacked(StringsUpgradeable.toHexString(address(this)), LOGSTORE_STORE_SYSTEM_STREAM_ID_PATH)
        );
        queryStreamId = string(
            abi.encodePacked(StringsUpgradeable.toHexString(address(this)), LOGSTORE_QUERY_SYSTEM_STREAM_ID_PATH)
        );

        streamrRegistry.grantPublicPermission(storeStreamId, IStreamRegistry.PermissionType.Subscribe);
        streamrRegistry.grantPublicPermission(queryStreamId, IStreamRegistry.PermissionType.Subscribe);

        for (uint i = 0; i < initialNodes.length; i++) {
            upsertNodeAdmin(initialNodes[i], initialMetadata[i]);
        }
        transferOwnership(owner_);
    }

    /// @dev required by the OZ UUPS module
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function registerStoreManager(address contractAddress) public onlyOwner {
        _storeManager = LogStoreManager(contractAddress);
    }

    function registerQueryManager(address contractAddress) public onlyOwner {
        _queryManager = LogStoreQueryManager(contractAddress);
    }

    function registerReportManager(address contractAddress) public onlyOwner {
        _reportManager = LogStoreReportManager(contractAddress);
    }

    function upsertNodeAdmin(address node, string calldata metadata_) public onlyOwner {
        _upsertNode(node, metadata_);
    }

    function removeNodeAdmin(address nodeAddress) public onlyOwner {
        _removeNode(nodeAddress);
    }

    function treasuryWithdraw(uint256 amount) public onlyOwner {
        require(amount <= treasurySupply, "error_notEnoughStake");

        totalSupply -= amount;
        treasurySupply -= amount;

        bool success = stakeToken.transfer(msg.sender, amount);
        require(success == true, "error_unsuccessfulWithdraw");
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

    // recieve report data broken up into a series of arrays
    function processReport(string calldata id) public onlyStaked {
        LogStoreReportManager.Report memory report = _reportManager.getReport(id);

        require(report._processed == false, "error_reportAlreadyProcessed");

        for (uint256 i = 0; i < report.streams.length; i++) {
            if (report.streams[i].writeBytes > 0) {
                _storeManager.capture(
                    report.streams[i].id,
                    report.streams[i].writeCapture,
                    report.streams[i].writeBytes
                );
                totalSupply += report.streams[i].writeCapture;
            }
        }
        for (uint256 i = 0; i < report.consumers.length; i++) {
            if (report.consumers[i].readBytes > 0) {
                _queryManager.capture(
                    report.consumers[i].id,
                    report.consumers[i].readCapture,
                    report.consumers[i].readBytes
                );
                totalSupply += report.consumers[i].readCapture;
            }
        }
        for (uint256 i = 0; i < report.nodes.length; i++) {
            int256 newNodeAmount = int(nodes[report.nodes[i].id].stake) + report.nodes[i].amount;
            if (newNodeAmount > 0) {
                nodes[report.nodes[i].id].stake = uint(newNodeAmount);
            } else {
                nodes[report.nodes[i].id].stake = 0;
            }
            _checkAndGrantAccess(report.nodes[i].id);
        }
        for (uint256 i = 0; i < report.delegates.length; i++) {
            for (uint256 j = 0; j < report.delegates[i].nodes.length; j++) {
                address delegateNodeAddress = report.delegates[i].nodes[j].id;
                int256 delegateNodeChange = report.delegates[i].nodes[j].amount;

                int256 newDelegateAmount = int(delegatesOf[report.delegates[i].id][delegateNodeAddress]) +
                    delegateNodeChange;
                if (newDelegateAmount > 0) {
                    delegatesOf[report.delegates[i].id][delegateNodeAddress] = uint(newDelegateAmount);
                } else {
                    delegatesOf[report.delegates[i].id][delegateNodeAddress] = 0;
                }
            }
        }
        int256 newTreasurySupply = int(treasurySupply) + report.treasury;
        if (newTreasurySupply > 0) {
            treasurySupply = uint(newTreasurySupply);
        } else {
            treasurySupply = 0;
        }

        _reportManager.processReport(id);
        emit ReportProcessed(id);
    }

    // Nodes can join the network, but they will not earn rewards or participate unless they're staked.
    function upsertNode(string calldata metadata_) public onlyWhitelist {
        _upsertNode(msg.sender, metadata_);
    }

    function removeNode() public {
        _removeNode(msg.sender);
    }

    function join(uint amount, string calldata metadata_) public {
        upsertNode(metadata_);
        stake(amount);
        delegate(amount, msg.sender);
    }

    function leave() public {
        undelegate(delegatesOf[msg.sender][msg.sender], msg.sender);
        withdraw(balanceOf[msg.sender]);
        removeNode();
    }

    function stake(uint amount) public nonReentrant {
        require(amount > 0, "error_insufficientStake");
        require(stakeToken.balanceOf(msg.sender) >= amount, "error_insufficientBalance");

        balanceOf[msg.sender] += amount;
        totalSupply += amount;

        bool success = stakeToken.transferFrom(msg.sender, address(this), amount);
        require(success == true, "error_unsuccessfulStake");
    }

    function delegate(uint amount, address node) public {
        require(amount > 0, "error_insufficientDelegateAmount");
        require(nodes[node].lastSeen > 0, "error_invalidNode");

        balanceOf[msg.sender] -= amount;
        delegatesOf[msg.sender][node] += amount;
        nodes[node].stake += amount;

        bool delegateExists = nodes[node].delegateExists[msg.sender];
        if (!delegateExists) {
            nodes[node].delegates.push(msg.sender);
            nodes[node].delegateExists[msg.sender] = true;
        }

        _checkAndGrantAccess(node);

        emit NodeStakeUpdated(node, nodes[node].stake);
    }

    function undelegate(uint amount, address node) public {
        require(amount > 0, "error_insufficientDelegateAmount");
        require(nodes[node].lastSeen > 0, "error_invalidNode");

        delegatesOf[msg.sender][node] -= amount;
        nodes[node].stake -= amount;
        balanceOf[msg.sender] += amount;

        uint256 removeIndex = 0;
        uint256 numDelegates = nodes[node].delegates.length;
        for (uint256 i = 0; i < numDelegates; i++) {
            if (msg.sender == nodes[node].delegates[i]) {
                removeIndex = i;
                break;
            }
        }
        nodes[node].delegates[removeIndex] = nodes[node].delegates[nodes[node].delegates.length - 1];
        nodes[node].delegates.pop();

        _checkAndGrantAccess(node);

        emit NodeStakeUpdated(node, nodes[node].stake);
    }

    function stakeAndDelegate(uint amount, address node) public {
        stake(amount);
        delegate(amount, node);
    }

    function withdraw(uint amount) public {
        require(amount <= balanceOf[msg.sender], "error_notEnoughStake");

        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;

        bool success = stakeToken.transfer(msg.sender, amount);
        require(success == true, "error_unsuccessfulWithdraw");
    }

    function undelegateWithdraw(uint amount, address node) public {
        undelegate(amount, node);
        withdraw(amount);
    }

    function _upsertNode(address nodeAddress, string calldata metadata_) internal {
        Node storage foundNode = nodes[nodeAddress];
        uint isNew = 0;

        if (foundNode.lastSeen == 0) {
            isNew = 1;
            if (headNode == address(0)) {
                headNode = nodeAddress;
            } else {
                nodes[tailNode].next = nodeAddress;
                foundNode.prev = tailNode;
                foundNode.index = totalNodes;
            }
            tailNode = nodeAddress;
            totalNodes += 1;
        }

        // update this fields for create or update operations
        foundNode.metadata = metadata_;
        foundNode.lastSeen = block.timestamp;

        emit NodeUpdated(nodeAddress, foundNode.metadata, isNew, foundNode.lastSeen);
    }

    function _removeNode(address nodeAddress) internal {
        Node storage removedNode = nodes[nodeAddress];
        require(removedNode.lastSeen != 0, "error_notFound");

        // Delete before loop as to no conflict
        delete nodes[nodeAddress];

        nodes[removedNode.next].prev = removedNode.prev;
        if (headNode == nodeAddress) {
            headNode = removedNode.next;
        }
        if (tailNode == nodeAddress) {
            tailNode = removedNode.prev;
        }

        // Go through all the nodes after the removed one
        // and reduce the index value to account for a deduction
        address nextNodeAddress = removedNode.next;
        while (nextNodeAddress != address(0)) {
            nodes[nextNodeAddress].index--;
            nextNodeAddress = nodes[nextNodeAddress].next;
        }
        emit NodeRemoved(nodeAddress);
    }

    function _checkAndGrantAccess(address node) internal {
        if (nodes[node].stake >= stakeRequiredAmount) {
            streamrRegistry.grantPermission(storeStreamId, node, IStreamRegistry.PermissionType.Publish);
            streamrRegistry.grantPermission(queryStreamId, node, IStreamRegistry.PermissionType.Publish);
        } else {
            streamrRegistry.revokePermission(storeStreamId, node, IStreamRegistry.PermissionType.Publish);
            streamrRegistry.revokePermission(queryStreamId, node, IStreamRegistry.PermissionType.Publish);
        }
    }

    function nodeAddresses() public view returns (address[] memory resultAddresses) {
        address[] memory result = new address[](totalNodes);

        address tailAddress = headNode;
        uint256 index = 0;
        do {
            result[index] = tailAddress;

            tailAddress = nodes[tailAddress].next;
            index++;
        } while (tailAddress != address(0));

        return result;
    }

    function countNodes() public view returns (uint) {
        uint256 index = 0;
        address tailAddress = headNode;
        while (nodes[tailAddress].next != address(0)) {
            tailAddress = nodes[tailAddress].next;
            index++;
        }
        return index + 1;
    }

    function nodeStake(address node) public view returns (uint256) {
        return nodes[node].stake;
    }

    function isStaked(address node) public view returns (bool) {
        return stakeRequiredAmount > 0 && nodes[node].stake >= stakeRequiredAmount;
    }
}
