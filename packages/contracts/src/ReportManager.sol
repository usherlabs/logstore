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
    uint256 public constant MATH_PRECISION = 10 ** 10;

    event ReportAccepted(string id);
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

    uint256 public reportTimeBuffer;
    string internal lastReportId;
    mapping(address => uint256) internal reputationOf;
    mapping(string => Report) internal reports;
    LogStoreNodeManager private _nodeManager;

    function initialize(address _owner, uint256 _reportTimeBuffer) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _nodeManager = LogStoreNodeManager(_owner);
        reportTimeBuffer = _reportTimeBuffer;

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

    /**
     * This method will return the same array every time unless reputations are changed after a successfully accepted report.
     * use bubble sort to sort the node addresses
     */
    function getReporters() public view returns (address[] memory reporters) {
        reporters = _nodeManager.nodeAddresses();
        uint256 reportersCount = reporters.length;

        for (uint256 i = 0; i < reportersCount - 1; i++) {
            for (uint256 j = 0; j < reportersCount - i - 1; j++) {
                if (reputationOf[reporters[j + 1]] > reputationOf[reporters[j]]) {
                    (reporters[j], reporters[j + 1]) = (reporters[j + 1], reporters[j]);
                }
            }
        }
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
        // Arrays of addresses, proofTimestamos, and signatures for verification of reporter & report data
        address[] calldata addresses,
        uint256[] calldata proofTimestamps,
        bytes[] calldata signatures
    ) public onlyStaked {
        require(reports[id]._processed == false, "error_reportAlreadyProcessed");
        require(blockHeight <= block.number && blockHeight > reports[lastReportId].height, "error_invalidReport");
        require(
            addresses.length * 3 == addresses.length + proofTimestamps.length + signatures.length,
            "error_invalidProofs"
        );
        require(quorumIsMet(addresses), "error_quorumNotMet");

        // validate that the appropriate reporters can submit reports based on the current block
        address[] memory orderedReportersList = getReporters();
        uint256 meanProofTimestampWithPrecision = aggregateTimestamps(proofTimestamps);
        for (uint256 i = 0; i < orderedReportersList.length; i++) {
            if (orderedReportersList[i] == _msgSender()) {
                // Ensure that the current block number > report generation block height + reporter block buffer
                // Give the leading reporter a head-start to hydrate the report from foreign sources
                require(
                    block.timestamp * MATH_PRECISION >
                        (i * reportTimeBuffer * MATH_PRECISION) + meanProofTimestampWithPrecision,
                    "error_invalidReporter"
                );
                break;
            }
        }

        /* solhint-disable quotes */
        string[14] memory hashElements;
        hashElements[0] = string.concat('"', id, '"');
        hashElements[1] = StringsUpgradeable.toString(blockHeight);
        hashElements[13] = string.concat('"', StringsUpgradeable.toHexString(treasurySupplyChange), '"');

        Stream[] memory rStreams = new Stream[](streams.length);
        for (uint256 i = 0; i < streams.length; i++) {
            hashElements[2] = string.concat(hashElements[2], '"', streams[i], '"');
            hashElements[3] = string.concat(
                hashElements[3],
                '"',
                StringsUpgradeable.toHexString(writeCaptureAmounts[i]),
                '"'
            );
            hashElements[4] = string.concat(hashElements[4], StringsUpgradeable.toString(writeBytes[i]));
            if (i != streams.length - 1) {
                hashElements[2] = string.concat(hashElements[2], ",");
                hashElements[3] = string.concat(hashElements[3], ",");
                hashElements[4] = string.concat(hashElements[4], ",");
            }

            rStreams[i] = Stream({id: streams[i], writeCapture: writeCaptureAmounts[i], writeBytes: writeBytes[i]});
        }

        Consumer[] memory rConsumers = new Consumer[](readConsumerAddresses.length);
        for (uint256 i = 0; i < readConsumerAddresses.length; i++) {
            hashElements[5] = string.concat(
                hashElements[5],
                '"',
                StringsUpgradeable.toHexString(readConsumerAddresses[i]),
                '"'
            );
            hashElements[6] = string.concat(
                hashElements[6],
                '"',
                StringsUpgradeable.toHexString(readCaptureAmounts[i]),
                '"'
            );
            hashElements[7] = string.concat(hashElements[7], StringsUpgradeable.toString(readBytes[i]));
            if (i != readConsumerAddresses.length - 1) {
                hashElements[5] = string.concat(hashElements[5], ",");
                hashElements[6] = string.concat(hashElements[6], ",");
                hashElements[7] = string.concat(hashElements[7], ",");
            }

            rConsumers[i] = Consumer({
                id: readConsumerAddresses[i],
                readCapture: readCaptureAmounts[i],
                readBytes: readBytes[i]
            });
        }

        Node[] memory rNodes = new Node[](nodes.length);
        for (uint256 i = 0; i < nodes.length; i++) {
            hashElements[8] = string.concat(hashElements[8], '"', StringsUpgradeable.toHexString(nodes[i]), '"');
            hashElements[9] = string.concat(hashElements[9], '"', StringsUpgradeable.toHexString(nodeChanges[i]), '"');
            if (i != nodes.length - 1) {
                hashElements[8] = string.concat(hashElements[8], ",");
                hashElements[9] = string.concat(hashElements[9], ",");
            }

            rNodes[i] = Node({id: nodes[i], amount: nodeChanges[i]});
        }

        Delegate[] memory rDelegates = new Delegate[](delegates.length);
        for (uint256 i = 0; i < delegates.length; i++) {
            hashElements[10] = string.concat(hashElements[10], '"', StringsUpgradeable.toHexString(delegates[i]), '"');
            hashElements[11] = string.concat(hashElements[11], "[");
            hashElements[12] = string.concat(hashElements[12], "[");

            Node[] memory rDelegateNodes = new Node[](delegateNodes[i].length);
            for (uint256 j = 0; j < delegateNodes[i].length; j++) {
                hashElements[11] = string.concat(
                    hashElements[11],
                    '"',
                    StringsUpgradeable.toHexString(delegateNodes[i][j]),
                    '"'
                );
                hashElements[12] = string.concat(
                    hashElements[12],
                    '"',
                    StringsUpgradeable.toHexString(delegateNodeChanges[i][j]),
                    '"'
                );
                if (j != delegateNodes[i].length - 1) {
                    hashElements[11] = string.concat(hashElements[11], ",");
                    hashElements[12] = string.concat(hashElements[12], ",");
                }

                rDelegateNodes[j] = Node({id: delegateNodes[i][j], amount: delegateNodeChanges[i][j]});
            }
            hashElements[11] = string.concat(hashElements[11], "]");
            hashElements[12] = string.concat(hashElements[12], "]");
            if (i != delegates.length - 1) {
                hashElements[10] = string.concat(hashElements[10], ",");
                hashElements[11] = string.concat(hashElements[11], ",");
                hashElements[12] = string.concat(hashElements[12], ",");
            }

            rDelegates[i] = Delegate({id: delegates[i], nodes: rDelegateNodes});
        }

        string memory rawHashParam = string.concat(
            "[",
            // id
            hashElements[0],
            ",",
            // blockHeight
            hashElements[1],
            ",[",
            // stream Ids
            hashElements[2],
            "],[",
            // writeCaptureAmounts
            hashElements[3],
            "],[",
            // writeBytes
            hashElements[4],
            "],[",
            // readConsumerAddresses
            hashElements[5],
            "],[",
            // readCaptureAmounts
            hashElements[6],
            "],[",
            // readBytes
            hashElements[7],
            "],[",
            // nodes
            hashElements[8],
            "],[",
            // nodeChanges
            hashElements[9],
            "],[",
            // delegates
            hashElements[10],
            "],[",
            // delegatesNodes
            hashElements[11],
            "],[",
            // delegatesNodeChanges
            hashElements[12],
            "],",
            // treasurySupplyChange
            hashElements[13],
            "]"
        );

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

        bytes32 reportHash = keccak256(abi.encodePacked(rawHashParam));

        // Verify signatures
        bool accepted = true;
        for (uint256 i = 0; i < addresses.length; i++) {
            bytes32 proofHash = keccak256(
                abi.encodePacked(bytes.concat(reportHash, abi.encodePacked(proofTimestamps[i])))
            );
            bool verified = VerifySignature.verify(addresses[i], proofHash, signatures[i]);
            if (verified != true) {
                accepted = false;
                break;
            }
        }

        // Require that all signatures provided are verified
        require(accepted, "error_invalidReportSignatures");

        reports[currentReport.id] = currentReport;
        lastReportId = currentReport.id;

        // Adjust reputation of reporters
        bool leadReporterAdjusted = false;
        for (uint256 i = 0; i < orderedReportersList.length; i++) {
            if (_msgSender() == orderedReportersList[i]) {
                reputationOf[_msgSender()] += 10;
                leadReporterAdjusted = true;
            } else if (leadReporterAdjusted == false) {
                reputationOf[orderedReportersList[i]] -= reputationOf[orderedReportersList[i]] >= 5
                    ? 5
                    : reputationOf[orderedReportersList[i]];
            } else {
                reputationOf[orderedReportersList[i]] += 1;
            }
        }

        emit ReportAccepted(currentReport.id);
    }

    /**
     * Check to ensure that the addresses signing off on the report are >= minimum required nodes - ie. >= 50% of nodes
     */
    function quorumIsMet(address[] memory submittedNodes) public view returns (bool isMet) {
        uint256 count;
        address[] memory existingNodes = _nodeManager.nodeAddresses();
        uint256 minCount = (existingNodes.length * MATH_PRECISION) / 2;

        for (uint256 i = 0; i < existingNodes.length; i++) {
            for (uint256 j = 0; j < submittedNodes.length; j++) {
                if (existingNodes[i] == submittedNodes[j]) {
                    count += 1 * MATH_PRECISION;
                    break;
                }
            }
            if (count >= minCount) {
                isMet = true;
                break;
            }
        }
    }

    /**
     * Accepts an array of timestamps and evaluates the mean timestamp with precision
     */
    function aggregateTimestamps(uint256[] memory timestamps) public pure returns (uint256) {
        uint256 sum;
        for (uint256 i = 0; i < timestamps.length; i++) {
            sum += timestamps[i] * MATH_PRECISION;
        }
        uint256 mean = sum / timestamps.length;
        return mean;
    }
}
