// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

// Open Zeppelin libraries for controlling upgradability and access.
import {IERC20Upgradeable} from "../node_modules/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {Initializable} from "../node_modules/@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "../node_modules/@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../node_modules/@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {StringsUpgradeable} from "../node_modules/@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";

import {LogStoreManager} from "./StoreManager.sol";
import {LogStoreQueryManager} from "./QueryManager.sol";
import {LogStoreReportManager} from "./ReportManager.sol";
import {VerifySignature} from "./lib/VerifySignature.sol";

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
    event ReportProcessed(string indexed id);

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
    uint256 public treasurySupply;
    uint256 public stakeRequiredAmount;
    mapping(address => Node) public nodes;
    mapping(address => WhitelistState) public whitelist;
    mapping(address => uint256) public balanceOf;
    address internal headNode;
    IERC20Upgradeable internal stakeToken;
    uint256 internal storageFeeBasisPoints = 10000;
    uint256 internal treasuryFeeBasisPoints = 2000;
    uint256 internal queryFeeFlatPerByte = 100000000; // 0.0000000001 * 10^18 -- this is relevant to MATIC
    LogStoreManager private _storeManager;
    LogStoreQueryManager private _queryManager;
    LogStoreReportManager private _reportManager;

    function initialize(
        address owner,
        bool requiresWhitelist_,
        address stakeTokenAddress_,
        uint256 stakeRequiredAmount_,
        uint256 storageFeeBasisPoints_,
        uint256 treasuryFeeBasisPoints_,
        uint256 queryFeeFlatPerByte_,
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
            stakeTokenAddress_ != address(0) && stakeRequiredAmount_ > 0,
            "error_badTrackerData"
        );
        stakeToken = IERC20Upgradeable(stakeTokenAddress_);

        // Configure
        stakeRequiredAmount = stakeRequiredAmount_;
        storageFeeBasisPoints = storageFeeBasisPoints_;
        treasuryFeeBasisPoints = treasuryFeeBasisPoints_;
        queryFeeFlatPerByte = queryFeeFlatPerByte_;

        for (uint i = 0; i < initialNodes.length; i++) {
            upsertNodeAdmin(initialNodes[i], initialMetadata[i]);
        }
        transferOwnership(owner);
    }

    function configure(
        uint256 stakeRequiredAmount_,
        uint256 storageFeeBasisPoints_,
        uint256 treasuryFeeBasisPoints_,
        uint256 queryFeeFlatPerByte_
    ) public onlyOwner {
        stakeRequiredAmount = stakeRequiredAmount_;
        storageFeeBasisPoints = storageFeeBasisPoints_;
        treasuryFeeBasisPoints = treasuryFeeBasisPoints_;
        queryFeeFlatPerByte = queryFeeFlatPerByte_;
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

    function upsertNodeAdmin(
        address node,
        string memory metadata_
    ) public onlyOwner {
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
    function report(
        string calldata bundleId,
        uint256 blockHeight,
        uint256 fee,
        address[] calldata addresses,
        string[][] calldata streamsPerNode,
        uint256[][] calldata bytesObservedPerStream,
        uint256[][] calldata bytesMissedPerStream,
        address[][][] calldata consumerAddressesPerStream,
        uint256[][][] calldata bytesQueriedByConsumerPerStream,
        bytes[] calldata signatures // these are signatures of the constructed payload.
    ) public onlyStaked {
        (
            LogStoreReportManager.Report memory verifiedReport,
            uint256 storedBytes,

        ) = _reportManager.verifyReport(
                nodeAddresses,
                bundleId,
                blockHeight,
                fee,
                addresses,
                streamsPerNode,
                bytesObservedPerStream,
                bytesMissedPerStream,
                consumerAddressesPerStream,
                bytesQueriedByConsumerPerStream,
                signatures // these are signatures of the constructed payload.
            );

        // Determine fee amounts on a per stream basis
        // 1. Take the total fees/expense, priced in staked currency, and evaluate a fee per stored byte (observed + missed)
        // 2. Fee per stored byte is a multiplier on the fees/expense that incorporates the Treasury delegation
        uint256 expensePerStoredByte = fee / storedBytes;
        uint256 feePerStoredByte = (storageFeeBasisPoints / 10000 + 1) *
            expensePerStoredByte;
        uint256 treasuryFeePerStoredByte = (treasuryFeeBasisPoints / 10000) *
            (feePerStoredByte - expensePerStoredByte);
        uint256 nodeFeePerStoredByte = feePerStoredByte -
            treasuryFeePerStoredByte;

        for (uint256 i = 0; i < verifiedReport.nodes.length; i++) {
            LogStoreReportManager.ReportNode memory reportNode = verifiedReport
                .nodes[i];
            for (uint256 j = 0; j < reportNode.streams.length; i++) {
                LogStoreReportManager.ReportStream
                    memory reportStream = reportNode.streams[i];
                // Capture fees from LogStoreManager -- We only capture for observed data. Nodes will pay for missing data.
                // Once captured, partition between node and treasury
                uint256 storageCaptureAmount = reportStream.observed *
                    feePerStoredByte;
                _storeManager.capture(
                    reportStream.id,
                    storageCaptureAmount,
                    reportStream.observed
                );

                uint256 totalQueriedForStream = 0;
                for (uint256 x = 0; x < reportStream.consumers.length; x++) {
                    uint256 queryCaptureAmount = reportStream.queried[x] *
                        queryFeeFlatPerByte;
                    totalQueriedForStream += reportStream.queried[x];
                    _queryManager.capture(
                        reportStream.id,
                        queryCaptureAmount,
                        reportStream.consumers[x],
                        reportStream.queried[x]
                    );
                }

                uint256 totalQueryCaptureAmount = totalQueriedForStream *
                    queryFeeFlatPerByte;
                uint256 treasuryQueryFee = (treasuryFeeBasisPoints / 10000) *
                    totalQueryCaptureAmount;
                uint256 nodeQueryFee = totalQueryCaptureAmount -
                    treasuryQueryFee;

                balanceOf[reportNode.id] +=
                    (reportStream.observed * nodeFeePerStoredByte) +
                    nodeQueryFee;
                treasurySupply +=
                    reportStream.observed *
                    treasuryFeePerStoredByte +
                    treasuryQueryFee;
                totalSupply += totalQueryCaptureAmount + storageCaptureAmount;
            }
        }

        emit ReportProcessed(bundleId);
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
            nodes[nodeAddress] = Node({
                metadata: metadata_,
                lastSeen: block.timestamp // block timestamp should suffice
            });
            if (headNode == address(0)) {
                headNode = nodeAddress;
            } else {
                uint256 index = 0;
                address tailAddress = headNode;
                while (nodes[tailAddress].next != address(0)) {
                    tailAddress = nodes[tailAddress].next;
                    index++;
                }
                nodes[nodeAddress].prev = tailAddress;
                nodes[tailAddress].next = nodeAddress;
                nodes[nodeAddress].index = index + 1;
            }
        } else {
            nodes[nodeAddress] = Node({
                index: n.index,
                next: n.next,
                prev: n.prev,
                metadata: metadata_,
                lastSeen: block.timestamp
            });
        }
        emit NodeUpdated(nodeAddress, n.metadata, isNew, n.lastSeen);
    }

    function _removeNode(address nodeAddress) internal {
        Node memory n = nodes[nodeAddress];
        require(n.lastSeen != 0, "error_notFound");

        // Delete before loop as to no conflict
        delete nodes[nodeAddress];

        Node memory tailNode = nodes[headNode];
        while (tailNode.next != address(0)) {
            tailNode = nodes[tailNode.next];
            if (tailNode.index > n.index) {
                nodes[tailNode.next].index--;
            }
        }

        emit NodeRemoved(nodeAddress);
    }

    function nodeCount() public view returns (uint count) {
        return nodeAddresses.length;
    }
}
