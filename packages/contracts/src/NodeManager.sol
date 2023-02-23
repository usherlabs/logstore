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
    event StakeUpdate(uint256 indexed requiredAmount);
    event ReportAccepted(string raw);

    enum WhitelistState {
        None,
        Approved,
        Rejected
    }

    struct Node {
        uint index; // index of node address
        string metadata; // Connection metadata, for example wss://node-domain-name:port
        uint lastSeen; // what's the best way to store timestamps in smart contracts?
        uint reputation;
    }

    struct ReportStream {
        string id;
        uint256 observed; // Byte count
        uint256 missed;
        address[] consumers;
        uint256[] queried;
    }

    struct ReportNode {
        address id;
        ReportStream[] streams;
    }

    struct Report {
        string id; // bundle id
        uint256 height;
        uint256 fee;
        ReportNode[] nodes;
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

    uint256 public reportBlockBuffer = 10;
    bool public requiresWhitelist;
    uint256 public totalSupply;
    uint256 public treasurySupply;
    uint256 public stakeRequiredAmount;
    address public stakeTokenAddress;
    address[] public nodeAddresses;
    string public lastReportId;
    mapping(string => address[]) public reportersOf;
    mapping(string => Report) public reports;
    mapping(address => Node) public nodes;
    mapping(address => WhitelistState) public whitelist;
    mapping(address => uint256) public balanceOf;
    IERC20Upgradeable internal stakeToken;
    LogStoreManager private _storeManager;
    LogStoreQueryManager private _queryManager;
    uint256 private storageFeeBP = 10000;
    uint256 private treasuryBP = 2000;
    uint256 private queryFeeFlatPerByte = 100000000; // 0.0000000001 * 10^18 -- this is relevant to MATIC

    function initialize(
        address owner,
        bool requiresWhitelist_,
        address stakeTokenAddress_,
        uint256 stakeRequiredAmount_,
        uint256 reportBlockBuffer_,
        uint256 storageFeeBP_,
        uint256 treasuryBP_,
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
            stakeTokenAddress != address(0) && stakeRequiredAmount_ > 0,
            "error_badTrackerData"
        );
        stakeToken = IERC20Upgradeable(stakeTokenAddress_);
        stakeTokenAddress = stakeTokenAddress_;

        // Configure
        stakeRequiredAmount = stakeRequiredAmount_;
        reportBlockBuffer = reportBlockBuffer_;
        storageFeeBP = storageFeeBP_;
        treasuryBP = treasuryBP_;
        queryFeeFlatPerByte = queryFeeFlatPerByte_;

        for (uint i = 0; i < initialNodes.length; i++) {
            upsertNodeAdmin(initialNodes[i], initialMetadata[i]);
        }
        transferOwnership(owner);
    }

    function configure(
        uint256 stakeRequiredAmount_,
        uint256 reportBlockBuffer_,
        uint256 storageFeeBP_,
        uint256 treasuryBP_,
        uint256 queryFeeFlatPerByte_
    ) public onlyOwner {
        stakeRequiredAmount = stakeRequiredAmount_;
        reportBlockBuffer = reportBlockBuffer_;
        storageFeeBP = storageFeeBP_;
        treasuryBP = treasuryBP_;
        queryFeeFlatPerByte = queryFeeFlatPerByte_;
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

    function treasuryWithdraw(uint256 amount) public onlyOwner {
        require(amount <= treasurySupply, "error_notEnoughStake");

        totalSupply -= amount;
        treasurySupply -= amount;

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

    function getReportersList(
        string calldata id
    ) internal returns (address[] memory reporters) {
        if (reportersOf[id].length > 0) {
            // Use cache in case previous report attempt was invalid.
            return reportersOf[id];
        }

        // Determine an array of addresses
        address[] memory reporterAddresses = new address[](
            nodeAddresses.length
        );
        uint256 ceilingReputation = 0;
        for (uint256 i = 0; i < nodeAddresses.length; i++) {
            address nextReporterAddress = address(0);
            for (uint256 j = 0; j < nodeAddresses.length; j++) {
                Node memory jNode = nodes[nodeAddresses[j]];
                if (
                    jNode.reputation >= ceilingReputation &&
                    ceilingReputation > 0
                ) {
                    continue;
                }
                if (nextReporterAddress == address(0)) {
                    nextReporterAddress = nodeAddresses[j];
                    continue;
                }
                if (jNode.reputation > nodes[nextReporterAddress].reputation) {
                    nextReporterAddress = nodeAddresses[jNode.index];
                }
            }
            Node memory nextReporterNode = nodes[nextReporterAddress];
            ceilingReputation = nextReporterNode.reputation;
            reporterAddresses[i] = nextReporterAddress;
        }

        reportersOf[id] = reporterAddresses;

        return reporterAddresses;
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
        require(
            reports[lastReportId].height < blockHeight,
            "error_invalidReport"
        );
        require(blockHeight <= block.number, "error_invalidReport");

        // validate that the appropriate reporters can submit reports based on the current block
        address[] memory orderedReportersList = getReportersList(bundleId);
        for (uint256 i = 0; i < orderedReportersList.length; i++) {
            if (orderedReportersList[i] == msg.sender) {
                require(
                    i * reportBlockBuffer + blockHeight < block.number,
                    "error_invalidReporter"
                );
                break;
            }
        }

        ReportNode[] memory reportNodes = new ReportNode[](addresses.length);
        // Produce json blob that signatures correspond to
        string memory nodesJson = "";
        uint256 totalStoredBytes = 0;
        uint256 totalQueriedBytes = 0;
        /* solhint-disable quotes */
        for (uint256 i = 0; i < addresses.length; i++) {
            ReportStream[] memory reportStreamsPerNode = new ReportStream[](
                streamsPerNode[i].length
            );
            string memory formattedStreams = "";
            for (uint256 j = 0; j < streamsPerNode[i].length; j++) {
                totalStoredBytes +=
                    bytesObservedPerStream[i][j] +
                    bytesMissedPerStream[i][j];

                reportStreamsPerNode[j] = ReportStream({
                    id: streamsPerNode[i][j],
                    observed: bytesObservedPerStream[i][j],
                    missed: bytesMissedPerStream[i][j],
                    consumers: consumerAddressesPerStream[i][j],
                    queried: bytesQueriedByConsumerPerStream[i][j]
                });

                string memory formattedQueriedData = "";
                for (
                    uint256 l = 0;
                    l < consumerAddressesPerStream[i][j].length;
                    l++
                ) {
                    totalQueriedBytes += bytesQueriedByConsumerPerStream[i][j][
                        l
                    ];

                    formattedQueriedData = string.concat(
                        '"',
                        StringsUpgradeable.toHexString(
                            consumerAddressesPerStream[i][j][l]
                        ),
                        '": ',
                        StringsUpgradeable.toString(
                            bytesQueriedByConsumerPerStream[i][j][l]
                        )
                    );
                    if (l != consumerAddressesPerStream[i][j].length - 1) {
                        formattedQueriedData = string.concat(
                            formattedQueriedData,
                            ","
                        );
                    }
                }
                formattedStreams = string.concat(
                    formattedStreams,
                    '{ "id": "',
                    streamsPerNode[i][j],
                    '", "observed": ',
                    StringsUpgradeable.toString(bytesObservedPerStream[i][j]),
                    ', "missed": ',
                    StringsUpgradeable.toString(bytesMissedPerStream[i][j]),
                    ', "queried": {',
                    formattedQueriedData,
                    "}}"
                );
                if (j != streamsPerNode[i].length - 1) {
                    formattedStreams = string.concat(formattedStreams, ",");
                }
            }
            reportNodes[i] = ReportNode({
                id: addresses[i],
                streams: reportStreamsPerNode
            });

            nodesJson = string.concat(
                nodesJson,
                '{ "address": "',
                StringsUpgradeable.toHexString(addresses[i]),
                '", "streams": "[',
                formattedStreams,
                ']"}'
            );
            if (i != addresses.length - 1) {
                nodesJson = string.concat(nodesJson, ",");
            }
        }
        // Consume report data
        Report memory currentReport = Report({
            id: bundleId,
            height: blockHeight,
            fee: fee,
            nodes: reportNodes
        });
        string memory reportJson = string.concat(
            '{ "id": "',
            bundleId,
            '", "height": "',
            StringsUpgradeable.toString(blockHeight),
            '", "fee": ',
            StringsUpgradeable.toString(fee),
            '", "nodes": [',
            nodesJson,
            "]"
        );
        /* solhint-enable quotes */
        bytes32 reportHash = keccak256(abi.encodePacked(reportJson));
        // Verify signatures
        bool accepted = true;
        for (uint256 i = 0; i < addresses.length; i++) {
            bool verified = VerifySignature.verify(
                addresses[i],
                reportHash,
                signatures[i]
            );
            if (verified != true) {
                accepted = false;
                break;
            }
        }

        require(accepted, "error_invalidReportSignatures");

        // Determine fee amounts on a per stream basis
        // 1. Take the total fees/expense, priced in staked currency, and evaluate a fee per stored byte (observed + missed)
        // 2. Fee per stored byte is a multiplier on the fees/expense that incorporates the Treasury delegation
        uint256 expensePerStoredByte = fee / totalStoredBytes;
        uint256 feePerStoredByte = (storageFeeBP / 10000 + 1) *
            expensePerStoredByte;
        uint256 treasuryFeePerStoredByte = (treasuryBP / 10000) *
            (feePerStoredByte - expensePerStoredByte);
        uint256 nodeFeePerStoredByte = feePerStoredByte -
            treasuryFeePerStoredByte;

        for (uint256 i = 0; i < currentReport.nodes.length; i++) {
            ReportNode memory reportNode = currentReport.nodes[i];
            for (uint256 j = 0; j < reportNode.streams.length; i++) {
                ReportStream memory reportStream = reportNode.streams[i];
                // Capture fees from LogStoreManager -- We only capture for observed data. Nodes will pay for missing data.
                // Once captured, partition between node and treasury
                uint256 storageCaptureAmount = reportStream.observed *
                    feePerStoredByte;
                _storeManager.capture(
                    reportStream.id,
                    storageCaptureAmount,
                    reportStream.observed
                );

                uint256 totalQueried = 0;
                for (uint256 l = 0; l < reportStream.consumers.length; l++) {
                    uint256 queryCaptureAmount = reportStream.queried[l] *
                        queryFeeFlatPerByte;
                    totalQueried += reportStream.queried[l];
                    _queryManager.capture(
                        reportStream.id,
                        queryCaptureAmount,
                        reportStream.consumers[l],
                        reportStream.queried[l]
                    );
                }

                uint256 totalQueryCaptureAmount = totalQueried *
                    queryFeeFlatPerByte;
                uint256 treasuryQueryFee = (treasuryBP / 10000) *
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

        reports[currentReport.id] = currentReport;
        lastReportId = currentReport.id;

        emit ReportAccepted(reportJson);
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
                lastSeen: block.timestamp, // block timestamp should suffice
                reputation: 0
            });
        } else {
            nodes[nodeAddress] = Node({
                index: n.index,
                metadata: metadata_,
                lastSeen: block.timestamp,
                reputation: n.reputation
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
