// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

// Open Zeppelin libraries for controlling upgradability and access.
import "../node_modules/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "../node_modules/@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../node_modules/@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../node_modules/@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../node_modules/@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";

import "./StoreManager.sol";
import "./QueryManager.sol";
import "./lib/VerifySignature.sol";

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
    event ReportUpdated(bool indexed accepted, string raw);

    enum WhitelistState {
        None,
        Approved,
        Rejected
    }

    enum Currencies {
        Kyve,
        Ar
    }

    struct Currency {
        uint256 marketPriceToStable;
        uint256 marketPriceToStaked;
        uint256 pricePerByte;
    }

    struct Node {
        uint index; // index of node address
        string metadata; // Connection metadata, for example wss://node-domain-name:port
        uint lastSeen; // what's the best way to store timestamps in smart contracts?
        uint reputation;
        uint bytesObserved;
        uint bytesMissed;
        uint bytesQueried;
    }

    struct ReportStream {
        string id;
        uint256 observed; // Byte count
        uint256 missed;
        uint256 queried;
    }

    struct ReportNode {
        address id;
        ReportStream[] streams;
    }

    struct Report {
        string id; // bundle id
        uint256 height;
        uint256[2] fees; // Kyve, Ar
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

    bool public requiresWhitelist;
    uint256 public totalSupply;
    uint256 public stakeRequiredAmount;
    address public stakeTokenAddress;
    address[] public nodeAddresses;
    address[] public reporters;
    uint256 public lastAcceptedReportBlockHeight;
    mapping(string => Report) public reports;
    mapping(address => Node) public nodes;
    mapping(address => WhitelistState) public whitelist;
    mapping(address => uint256) public balanceOf;
    mapping(Currencies => Currency) internal currencyPrice;
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
    function report(
        string calldata bundleId,
        string calldata blockHeight,
        uint256[2] calldata fees,
        address[] calldata addresses,
        string[][] calldata streamsPerNode,
        uint256[][] calldata bytesObservedPerStream,
        uint256[][] calldata bytesMissedPerStream,
        uint256[][] calldata bytesQueriedPerStream,
        bytes[] calldata signatures // these are signatures of the constructed payload.
    ) public onlyStaked {
        if (reporters.length == 0) {
            // A condition that will be true on the first report
            reporters = nodeAddresses;
        }
        // TODO: Ensure msg.sender is the next reporter.

        ReportNode[] memory reportNodes = new ReportNode[](addresses.length);
        for (uint256 i = 0; i < addresses.length; i++) {
            ReportStream[] memory reportStreamsPerNode = new ReportStream[](
                streamsPerNode[i].length
            );
            for (uint256 j = 0; j < addresses.length; j++) {
                reportStreamsPerNode[j] = ReportStream({
                    id: streamsPerNode[i][j],
                    observed: bytesObservedPerStream[i][j],
                    missed: bytesMissedPerStream[i][j],
                    queried: bytesQueriedPerStream[i][j]
                });
            }
            reportNodes[i] = ReportNode({
                id: addresses[i],
                streams: reportStreamsPerNode
            });
        }
        // Consume report data
        uint256 currentHeight = block.number;
        Report memory currentReport = Report({
            id: bundleId,
            height: currentHeight,
            fees: fees,
            nodes: reportNodes
        });
        // Produce json blob that signatures correspond to
        string memory nodesJson = "";
        for (uint256 i = 0; i < addresses.length; i++) {
            string memory formattedStreams = "";
            for (uint256 j = 0; j < streamsPerNode[i].length; j++) {
                formattedStreams = string.concat(
                    formattedStreams,
                    '{ "id": "',
                    streamsPerNode[i][j],
                    '", "observed": ',
                    StringsUpgradeable.toString(bytesObservedPerStream[i][j]),
                    ', "missed": ',
                    StringsUpgradeable.toString(bytesMissedPerStream[i][j]),
                    ', "queried": ',
                    StringsUpgradeable.toString(bytesQueriedPerStream[i][j]),
                    " }"
                );
                if (j != streamsPerNode[i].length - 1) {
                    formattedStreams = string.concat(formattedStreams, ",");
                }
            }
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
        string memory reportJson = string.concat(
            '{ "bundleId": "',
            bundleId,
            '", "height": "',
            blockHeight,
            '", "fees": {"kyve": "',
            StringsUpgradeable.toString(fees[0]),
            '", "ar": "',
            StringsUpgradeable.toString(fees[1]),
            '"}", "nodes": [',
            nodesJson,
            "]"
        );
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

        if (accepted) {
            reports[currentReport.id] = currentReport;

            // Determine fee amounts on a per stream basis
            string[] memory captureStreamIds = new string[](0);
            mapping(string => uint256) memory captureAmounts;
            mapping(string => uint256) memory captureBytesStored;
            mapping(string => bool) memory captured;
            for (uint256 i = 0; i < currentReport.nodes.length; i++) {
                ReportNode memory reportNode = currentReport.nodes[i];
                for (uint256 j = 0; j < reportNode.streams.length; i++) {
                    ReportStream memory reportStream = reportNode.streams[i];
                    // TODO: Insert Pricing Algorithm
                    if (captured[reportStream.id] == false) {
                        captureStreamIds.push(reportStream.id);
                        captured[reportStream.id] = true;
                    }

                    uint256 amount = reportStream.observed *
                        currencyPrice[Currencies.Ar] *
                        captureAmounts[reportStream.id] =
                        captureAmounts[reportStream.id] +
                        amount;
                }
            }
            // Reproduce ReportList based on the performance of each node.

            // Capture fees from LogStoreManager
            _storeManager.captureBundle(
                captureStreamIds,
                captureAmounts,
                captureBytesStored
            );
        }

        emit ReportUpdated(accepted, reportJson);
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

    function getStorageFee(uint256 bytesStored) public returns (uint256 fee) {
        // Need to get the KYVE/STAKE_TOKEN & AR/STAKE_TOKEN prices
    }

    function getQueryFee(uint256 bytesQueried) public returns (uint256 fee) {}
}
