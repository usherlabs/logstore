// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

// Open Zeppelin libraries for controlling upgradability and access.
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {LogStoreNodeManager} from "./NodeManager.sol";
import {VerifySignature} from "./lib/VerifySignature.sol";
import {StringsUpgradeable} from "./lib/StringsUpgradeable.sol";

contract LogStoreReportManager is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    event ReportAccepted(string raw);
    event Logger(bool isMet);

    struct Consumer {
        address id;
        uint256 readCapture;
        uint256 readBytes;
    }

    struct Stream {
        string id;
        uint256 writeCapture;
        uint256 writeBytes;
    }

    struct Node {
        address id;
        int256 amount;
    }

    struct Delegate {
        address id;
        Node[] nodes;
    }

    struct Report {
        string id; // key inside of bundle
        uint256 height;
        int256 treasury;
        Stream[] streams;
        Node[] nodes;
        Delegate[] delegates;
        Consumer[] consumers;
        address _reporter;
        bool _processed;
    }

    modifier onlyStaked() {
        require(_nodeManager.isStaked(_msgSender()), "error_stakeRequired");
        _;
    }

    uint256 internal reportBlockBuffer;
    string internal lastReportId;
    mapping(address => uint256) internal reputationOf;
    mapping(string => address[]) internal reportersOf;
    mapping(string => Report) internal reports;
    LogStoreNodeManager private _nodeManager;

    function initialize(address _owner) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _nodeManager = LogStoreNodeManager(_owner);
        reportBlockBuffer = 10;

        transferOwnership(_owner);
    }

    /// @dev required by the OZ UUPS module
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function getReport(string calldata id) public view returns (Report memory) {
        return reports[id];
    }

    function getLastReport() public view returns (Report memory) {
        return reports[lastReportId];
    }

    function getReportersList(string calldata id) internal returns (address[] memory reporters) {
        if (reportersOf[id].length > 0) {
            // Use cache in case previous report attempt was invalid.
            return reportersOf[id];
        }

        address[] memory nodeAddresses = _nodeManager.nodeAddresses();

        // Determine an array of addresses
        address[] memory reporterAddresses = new address[](nodeAddresses.length);
        uint256 ceilingReputation = 0;
        for (uint256 i = 0; i < nodeAddresses.length; i++) {
            address nextReporterAddress = address(0);
            for (uint256 j = 0; j < nodeAddresses.length; j++) {
                if (reputationOf[nodeAddresses[j]] >= ceilingReputation && ceilingReputation > 0) {
                    continue;
                }
                if (nextReporterAddress == address(0)) {
                    nextReporterAddress = nodeAddresses[j];
                    continue;
                }
                if (reputationOf[nodeAddresses[j]] > reputationOf[nextReporterAddress]) {
                    nextReporterAddress = nodeAddresses[j];
                }
            }
            ceilingReputation = reputationOf[nextReporterAddress];
            reporterAddresses[i] = nextReporterAddress;
        }

        reportersOf[id] = reporterAddresses;

        return reporterAddresses;
    }

    function processReport(string calldata id) public onlyOwner {
        reports[id]._processed = true;
    }

    // Verifies a report and adds it to its accepted reports mapping
    function report(
        string calldata id,
        uint256 blockHeight,
        string[] calldata streams,
        uint256[] calldata writeCaptureAmounts,
        uint256[] calldata writeBytes,
        address[] calldata readConsumerAddresses,
        uint256[] calldata readCaptureAmounts,
        uint256[] calldata readBytes,
        address[] calldata nodes,
        int256[] calldata nodeChanges,
        address[] calldata delegates,
        address[][] calldata delegateNodes,
        int256[][] calldata delegateNodeChanges,
        int256 treasurySupplyChange,
        // Arrays of addresses and signatures for verification
        address[] calldata addresses,
        bytes[] calldata signatures
    ) public onlyStaked {
        // require(
        //     bytes(lastReportId).length > 0 && reports[lastReportId].height < blockHeight,
        //     "error_invalidReport"
        // );
        require(blockHeight <= block.number && blockHeight > reports[lastReportId].height, "error_invalidReport");
        require(quorumIsMet(addresses), "error_quorumNotMet");

        // validate that the appropriate reporters can submit reports based on the current block
        address[] memory orderedReportersList = getReportersList(id);
        for (uint256 i = 0; i < orderedReportersList.length; i++) {
            if (orderedReportersList[i] == msg.sender) {
                require(i * reportBlockBuffer + blockHeight < block.number, "error_invalidReporter");
                break;
            }
        }

        /* solhint-disable quotes */
        string memory reportJson = string.concat(
            '{"id":"',
            id,
            '","height":"',
            StringsUpgradeable.toString(blockHeight),
            '","treasury":"',
            StringsUpgradeable.toString(treasurySupplyChange),
            '","streams":['
        );

        Stream[] memory rStreams = new Stream[](streams.length);
        for (uint256 i = 0; i < streams.length; i++) {
            reportJson = string.concat(
                reportJson,
                '{"id":"',
                streams[i],
                '","capture":',
                StringsUpgradeable.toString(writeCaptureAmounts[i]),
                ', "bytes": ',
                StringsUpgradeable.toString(writeBytes[i]),
                "}"
            );

            if (i != streams.length - 1) {
                reportJson = string.concat(reportJson, ",");
            }

            rStreams[i] = Stream({id: streams[i], writeCapture: writeCaptureAmounts[i], writeBytes: writeBytes[i]});
        }

        reportJson = string.concat(reportJson, '], "consumers": [');
        Consumer[] memory rConsumers = new Consumer[](readConsumerAddresses.length);
        for (uint256 i = 0; i < readConsumerAddresses.length; i++) {
            reportJson = string.concat(
                reportJson,
                '{"id":"',
                StringsUpgradeable.toHexString(readConsumerAddresses[i]),
                '","capture": ',
                StringsUpgradeable.toString(readCaptureAmounts[i]),
                ', "bytes": ',
                StringsUpgradeable.toString(readBytes[i]),
                "}"
            );
            if (i != readConsumerAddresses.length - 1) {
                reportJson = string.concat(reportJson, ",");
            }

            rConsumers[i] = Consumer({
                id: readConsumerAddresses[i],
                readCapture: readCaptureAmounts[i],
                readBytes: readBytes[i]
            });
        }

        reportJson = string.concat(reportJson, '], "nodes": {');
        Node[] memory rNodes = new Node[](nodes.length);
        for (uint256 i = 0; i < nodes.length; i++) {
            reportJson = string.concat(
                reportJson,
                '"',
                StringsUpgradeable.toHexString(nodes[i]),
                '":',
                StringsUpgradeable.toString(nodeChanges[i])
            );
            if (i != nodes.length - 1) {
                reportJson = string.concat(reportJson, ",");
            }

            rNodes[i] = Node({id: nodes[i], amount: nodeChanges[i]});
        }

        reportJson = string.concat(reportJson, '}, "delegates": {');
        Delegate[] memory rDelegates = new Delegate[](delegates.length);
        for (uint256 i = 0; i < delegates.length; i++) {
            reportJson = string.concat(reportJson, '"', StringsUpgradeable.toHexString(delegates[i]), '":{');
            Node[] memory rDelegateNodes = new Node[](delegateNodes[i].length);
            for (uint256 j = 0; j < delegateNodes[i].length; j++) {
                reportJson = string.concat(
                    reportJson,
                    '"',
                    StringsUpgradeable.toHexString(delegateNodes[i][j]),
                    '":',
                    StringsUpgradeable.toString(delegateNodeChanges[i][j])
                );
                if (j != delegateNodes[i].length - 1) {
                    reportJson = string.concat(reportJson, ",");
                }

                rDelegateNodes[j] = Node({id: delegateNodes[i][j], amount: delegateNodeChanges[i][j]});
            }
            if (i != delegates.length - 1) {
                reportJson = string.concat(reportJson, ",");
            }

            rDelegates[i] = Delegate({id: delegates[i], nodes: rDelegateNodes});
        }

        reportJson = string.concat(reportJson, "}}");
        /* solhint-enable quotes */

        // Consume report data
        Report memory currentReport = Report({
            id: id,
            height: blockHeight,
            treasury: treasurySupplyChange,
            streams: rStreams,
            nodes: rNodes,
            delegates: rDelegates,
            consumers: rConsumers,
            _reporter: _msgSender(),
            _processed: false
        });

        bytes32 reportHash = keccak256(abi.encodePacked(reportJson));

        // Verify signatures
        bool accepted = true;
        for (uint256 i = 0; i < addresses.length; i++) {
            bool verified = VerifySignature.verify(addresses[i], reportHash, signatures[i]);
            if (verified != true) {
                accepted = false;
                break;
            }
        }

        require(accepted, "error_invalidReportSignatures");

        reports[currentReport.id] = currentReport;
        lastReportId = currentReport.id;

        // Increase reputation of reporter
        for (uint256 i = 0; i < orderedReportersList.length; i++) {
            if (msg.sender == orderedReportersList[i]) {
                reputationOf[msg.sender] += 10;
            } else {
                reputationOf[orderedReportersList[i]] += 1;
            }
        }

        emit ReportAccepted(reportJson);
    }

    function quorumIsMet(address[] memory submittedNodes) public view returns (bool isMet) {
        uint256 count;
        address[] memory existingNodes = _nodeManager.nodeAddresses();
        uint256 requiredNodes = existingNodes.length / 2;
        uint256 minimumNodes = requiredNodes <= 0 ? 1 : requiredNodes; //condition for only one node

        for (uint256 i = 0; i < existingNodes.length; i++) {
            for (uint256 j = 0; j < submittedNodes.length; j++) {
                if (existingNodes[i] == submittedNodes[j]) {
                    count++;
                    break;
                }
            }
            if (count >= minimumNodes) {
                isMet = true;
                break;
            }
        }
    }
}
