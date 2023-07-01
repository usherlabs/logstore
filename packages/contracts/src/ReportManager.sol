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

import "hardhat/console.sol";

contract LogStoreReportManager is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
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

    modifier onlyStaked() {
        require(_nodeManager.isStaked(_msgSender()), "error_stakeRequired");
        _;
    }

    uint256 public reportTimeBuffer;
    mapping(address => uint256) public reputationOf;
    string internal lastReportId;
    mapping(string => Report) internal reports;
    LogStoreNodeManager private _nodeManager;

		// used for unit testing time-dependent code
		// block.timestamp is a miner-dependent variable that progresses over time. accuracy of time isn't. simply it's guarantee of increment for each block.
		uint256 private _test_block_timestamp;

    function initialize(
        address _owner,
        uint256 _reportTimeBuffer,
				uint256 __test_block_timestamp
    ) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _nodeManager = LogStoreNodeManager(_owner);
        reportTimeBuffer = _reportTimeBuffer * MATH_PRECISION;
				_test_block_timestamp = __test_block_timestamp * 1000 * MATH_PRECISION;

        transferOwnership(_owner);
    }

    /// @dev required by the OZ UUPS module
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function setReportTimeBuffer(uint256 _reportTimeBuffer) public onlyOwner {
        reportTimeBuffer = _reportTimeBuffer * MATH_PRECISION;
    }

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
        require(quorumIsMet(addresses), "error_quorumNotMet");

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

        // Verify signatures
        bool accepted = true;
        for (uint256 i = 0; i < addresses.length; i++) {
            bytes32 timeBasedOneTimeHash = keccak256(
                abi.encodePacked(
                    id,
                    blockHeight,
                    pack,
                    StringsUpgradeable.toHexString(treasurySupplyChange),
                    proofTimestamps[i]
                )
            );
            bool verified = VerifySignature.verify(addresses[i], timeBasedOneTimeHash, signatures[i]);
            if (verified != true) {
                accepted = false;
                break;
            }
        }

        // Require that all signatures provided are verified
        require(accepted, "error_invalidReportSignatures");

        // validate that the current reporter can submit the report based on the current block.timestamp and verified proofTimestamps
        address[] memory orderedReportersList = getReporters();
        require(
            _canReport(_msgSender(), orderedReportersList, proofTimestamps),
            "error_invalidReporter"
        );

        // once reporter is validated, accept the report
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

    function canReport(uint256[] memory proofTimestamps) public view returns (bool) {
        address[] memory reporterList = getReporters();
        return _canReport(_msgSender(), reporterList, proofTimestamps);
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

    function _canReport(address reporter, address[] memory reporterList, uint256[] memory proofTimestamps) internal view returns (bool validReporter) {
        // Use all timestamps - as the more consistent the mean is as an anchor, the better.
        // Validators will subscibe to ProofOfReports to slash brokers that are working against the interests of the network.
        uint256 meanProofTimestamp = aggregateTimestamps(proofTimestamps);
				console.log(StringsUpgradeable.toString(meanProofTimestamp), "meanProofTimestamp");
        uint256 preciseBlockTs = blockTimestamp();
				console.log(StringsUpgradeable.toString(preciseBlockTs), "preciseBlockTs");
        // uint256 cycleTime = reportTimeBuffer * reporterList.length;
        uint256 cycles = 1; // first cycle
        // while(preciseBlockTs > (cycles * cycleTime) + meanProofTimestamp) {
        //         // Count the number of cycles from the mean to the current block.
        //         cycles += 1;
        // }
				console.log(StringsUpgradeable.toString(cycles),"cycles");
        for (uint256 i = 0; i < reporterList.length; i++) {
            if (reporterList[i] == reporter) {
                uint256 start = (i * reportTimeBuffer * cycles) + meanProofTimestamp;
                uint256 end = ((i + 1) * reportTimeBuffer * cycles) + meanProofTimestamp;
								console.log(StringsUpgradeable.toString(i), "reporterIndex: ");
								console.log(StringsUpgradeable.toString(start), "start: ");
								console.log(StringsUpgradeable.toString(end), "end: ");
								// console.log("started: ", started ? 'true' : 'false');
								// console.log("ended: ", ended ? 'true' : 'false');
                // validReporter = started == true && ended == false;
                validReporter = preciseBlockTs >= start && preciseBlockTs < end;
								console.log(validReporter ? 'T' : 'F', "ValidReporter");
                break;
            }
        }
    }

		function blockTimestamp() public view returns (uint256) {
			if(_test_block_timestamp > 0){
				return _test_block_timestamp;
			}
			return block.timestamp * 1000 * MATH_PRECISION;
		}
}
