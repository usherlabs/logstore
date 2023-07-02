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

    struct Proof {
        address signer;
        bytes signature;
        uint256 timestamp;
    }

    modifier onlyStaked() {
        require(_nodeManager.isStaked(_msgSender()), "error_stakeRequired");
        _;
    }

    modifier onlyParent() {
        require(_msgSender() == parent, "error_onlyParent");
        _;
    }

    uint256 public reportTimeBuffer;
    mapping(address => uint256) public reputationOf;
    string internal lastReportId;
    mapping(string => Report) internal reports;
    mapping(string => Proof[]) internal reportProofs;
    LogStoreNodeManager private _nodeManager;
    address internal parent;

    // used for unit testing time-dependent code
    // block.timestamp is a miner-dependent variable that progresses over time. accuracy of time isn't. simply it's guarantee of increment for each block.
    uint256 private _test_block_timestamp;

    function initialize(
        address owner_,
        address parent_,
        uint256 reportTimeBuffer_,
        uint256 __test_block_timestamp
    ) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        reportTimeBuffer = reportTimeBuffer_ * MATH_PRECISION;
        _test_block_timestamp = __test_block_timestamp * 1000 * MATH_PRECISION;

        setParent(parent_);
        transferOwnership(owner_);
    }

    /// @dev required by the OZ UUPS module
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function setParent(address _parent) public onlyOwner {
        parent = _parent;
        _nodeManager = LogStoreNodeManager(_parent);
    }

    function setReportTimeBuffer(uint256 _reportTimeBuffer) public onlyOwner {
        reportTimeBuffer = _reportTimeBuffer * MATH_PRECISION;
    }

    function getReport(string calldata id) public view returns (Report memory) {
        return reports[id];
    }

    function getLastReport() public view returns (Report memory) {
        return reports[lastReportId];
    }

    function getProofOfReport(string calldata id) public view returns (Proof[] memory) {
        return reportProofs[id];
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

    function processReport(string calldata id) public onlyParent {
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
        // Arrays of addresses, proofTimestamps, and signatures for verification of reporter & report data
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

        address[] memory orderedReportersList = getReporters();

        // validate that enough members are paritipating to proceed
        require(quorumIsMet(addresses, orderedReportersList), "error_quorumNotMet");

        // validate that the current reporter can submit the report based on the current block.timestamp and quorum proofTimestamps
        require(_canReport(_msgSender(), orderedReportersList, proofTimestamps), "error_invalidReporter");

        // produce the pack based on parameters to use in consensus
        bytes memory pack;
        Stream[] memory rStreams = new Stream[](streams.length);
        for (uint256 i = 0; i < streams.length; i++) {
            pack = abi.encodePacked(
                pack,
                streams[i],
                StringsUpgradeable.toHexString(writeCaptureAmounts[i]),
                writeBytes[i]
            );
            rStreams[i] = Stream({id: streams[i], writeCapture: writeCaptureAmounts[i], writeBytes: writeBytes[i]});
        }

        Consumer[] memory rConsumers = new Consumer[](readConsumerAddresses.length);
        for (uint256 i = 0; i < readConsumerAddresses.length; i++) {
            pack = abi.encodePacked(
                pack,
                readConsumerAddresses[i],
                StringsUpgradeable.toHexString(readCaptureAmounts[i]),
                readBytes[i]
            );
            rConsumers[i] = Consumer({
                id: readConsumerAddresses[i],
                readCapture: readCaptureAmounts[i],
                readBytes: readBytes[i]
            });
        }

        Node[] memory rNodes = new Node[](nodes.length);
        for (uint256 i = 0; i < nodes.length; i++) {
            pack = abi.encodePacked(pack, nodes[i], StringsUpgradeable.toHexString(nodeChanges[i]));
            rNodes[i] = Node({id: nodes[i], amount: nodeChanges[i]});
        }

        Delegate[] memory rDelegates = new Delegate[](delegates.length);
        for (uint256 i = 0; i < delegates.length; i++) {
            bytes memory dPack;

            Node[] memory rDelegateNodes = new Node[](delegateNodes[i].length);
            for (uint256 j = 0; j < delegateNodes[i].length; j++) {
                dPack = abi.encodePacked(
                    dPack,
                    delegateNodes[i][j],
                    StringsUpgradeable.toHexString(delegateNodeChanges[i][j])
                );

                rDelegateNodes[j] = Node({id: delegateNodes[i][j], amount: delegateNodeChanges[i][j]});
            }
            pack = abi.encodePacked(pack, delegates[i], dPack);

            rDelegates[i] = Delegate({id: delegates[i], nodes: rDelegateNodes});
        }

        // Verify signatures, ordered by the reporter list and then adjust reputations
        // Start by ensuring all proofs provided belong to valid reporters.
        reportProofs[id] = new Proof[](0); // ordered by reporter list
        bool leadReporterReputationAdjusted = false;
        uint256 consensusCount;
        uint256 minConsensusCount = (orderedReportersList.length * MATH_PRECISION) / 2;

        for (uint256 i = 0; i < orderedReportersList.length; i++) {
            Proof memory proof; // The proof of the reporter
            for (uint256 j = 0; j < addresses.length; j++) {
                // Validate that the proof provided belongs to an address that's actually inside of the reporter list
                if (orderedReportersList[i] == addresses[j]) {
                    proof.signer = addresses[j];
                    proof.signature = signatures[j];
                    proof.timestamp = proofTimestamps[j];
                }
            }

            bytes32 timeBasedOneTimeHash = keccak256(
                abi.encodePacked(
                    id,
                    blockHeight,
                    pack,
                    StringsUpgradeable.toHexString(treasurySupplyChange),
                    proof.timestamp
                )
            );
            bool verified = VerifySignature.verify(proof.signer, timeBasedOneTimeHash, proof.signature);
            if (verified == true) {
                reportProofs[id].push(proof);

                consensusCount += 1 * MATH_PRECISION;

                // Increase rep of reporter if they're the sender
                // Otherwise, if this report was produced by a reporter that is NOT in the lead, decrease their reputation
                // Finally, if they're participating and NOT in the lead, minor increase rep of reporter
                if (_msgSender() == proof.signer) {
                    reputationOf[_msgSender()] += 10;
                    leadReporterReputationAdjusted = true;
                } else if (leadReporterReputationAdjusted == false) {
                    reputationOf[proof.signer] -= reputationOf[proof.signer] >= 5 ? 5 : reputationOf[proof.signer];
                } else {
                    reputationOf[proof.signer] += 1;
                }
            } else {
                // Bad proofs reset reputation to 0
                reputationOf[addresses[i]] = 0;
            }
        }

        require(consensusCount >= minConsensusCount, "error_consensusNotMet");

        // once consensus is reached among reporters, accept the report
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

        reports[currentReport.id] = currentReport;
        lastReportId = currentReport.id;

        emit ReportAccepted(currentReport.id);
    }

    /**
     * Check to ensure that the addresses signing off on the report are >= minimum required nodes - ie. >= 50% of nodes
     */
    function quorumIsMet(
        address[] memory participants,
        address[] memory totalMembers
    ) public pure returns (bool isMet) {
        uint256 count;
        uint256 minCount = (totalMembers.length * MATH_PRECISION) / 2;

        for (uint256 i = 0; i < totalMembers.length; i++) {
            for (uint256 j = 0; j < participants.length; j++) {
                if (totalMembers[i] == participants[j]) {
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

    function canReport(uint256[] memory timestamps) public view returns (bool) {
        address[] memory reporterList = getReporters();
        return _canReport(_msgSender(), reporterList, timestamps);
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

    function blockTimestamp() public view returns (uint256) {
        if (_test_block_timestamp > 0) {
            return _test_block_timestamp;
        }
        return block.timestamp * 1000 * MATH_PRECISION;
    }

    function _canReport(
        address reporter,
        address[] memory reporterList,
        uint256[] memory timestamps
    ) internal view returns (bool validReporter) {
        // Use all timestamps - as the more consistent the mean is as an anchor, the better.
        // Validators will subscibe to ProofOfReports to slash brokers that are working against the interests of the network.
        uint256 meanProofTimestamp = aggregateTimestamps(timestamps);
        uint256 preciseBlockTs = blockTimestamp();
        uint256 cycleTime = reportTimeBuffer * reporterList.length;
        uint256 cycle = 0; // first cycle
        while (preciseBlockTs >= ((cycle + 1) * cycleTime) + meanProofTimestamp) {
            // Is the current blockTs greater then the time of a full?
            // Set the current cycle based on this condition
            cycle += 1;
        }
        uint256 fromTime = (cycle * cycleTime) + meanProofTimestamp;

        for (uint256 i = 0; i < reporterList.length; i++) {
            if (reporterList[i] == reporter) {
                uint256 start = (i * reportTimeBuffer) + fromTime;
                uint256 end = ((i + 1) * reportTimeBuffer) + fromTime;

                validReporter = preciseBlockTs >= start && preciseBlockTs < end;
                break;
            }
        }
    }
}
