// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

// Open Zeppelin libraries for controlling upgradability and access.
import {IERC20Upgradeable} from "../node_modules/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {Initializable} from "../node_modules/@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "../node_modules/@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../node_modules/@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {StringsUpgradeable} from "../node_modules/@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";

import {LogStoreNodeManager} from "./NodeManager.sol";
import {VerifySignature} from "./lib/VerifySignature.sol";

contract LogStoreReportManager is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    event ReportAccepted(string raw);

    struct Stream {
        string id;
        address[] consumers;
        uint256[] queried;
        Node[] nodes;
        uint256 _read;
        uint256 _write;
    }

    struct Node {
        address id;
        uint256 observed; // Byte count
        uint256 missed;
        uint256 queried;
    }

    struct Report {
        string id; // bundle id
        uint256 height;
        uint256 fee;
        Stream[] streams;
        uint256 _read;
        uint256 _write;
        bool _processed;
    }

    modifier onlyStaked() {
        require(_nodeManager.isStaked(msg.sender), "error_stakeRequired");
        _;
    }

    uint256 internal reportBlockBuffer = 10;
    string internal lastReportId;
    mapping(address => uint256) internal reputationOf;
    mapping(string => address[]) internal reportersOf;
    mapping(string => Report) internal reports;
    LogStoreNodeManager private _nodeManager;

    function initialize(address owner) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        _nodeManager = LogStoreNodeManager(owner);

        transferOwnership(owner);
    }

    /// @dev required by the OZ UUPS module
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function getReport(
        string calldata id
    ) public view onlyOwner returns (Report memory) {
        return reports[id];
    }

    function getReportersList(
        string calldata id
    ) internal returns (address[] memory reporters) {
        if (reportersOf[id].length > 0) {
            // Use cache in case previous report attempt was invalid.
            return reportersOf[id];
        }

        address[] memory nodeAddresses = _nodeManager.nodeAddresses();

        // Determine an array of addresses
        address[] memory reporterAddresses = new address[](
            nodeAddresses.length
        );
        uint256 ceilingReputation = 0;
        for (uint256 i = 0; i < nodeAddresses.length; i++) {
            address nextReporterAddress = address(0);
            for (uint256 j = 0; j < nodeAddresses.length; j++) {
                if (
                    reputationOf[nodeAddresses[j]] >= ceilingReputation &&
                    ceilingReputation > 0
                ) {
                    continue;
                }
                if (nextReporterAddress == address(0)) {
                    nextReporterAddress = nodeAddresses[j];
                    continue;
                }
                if (
                    reputationOf[nodeAddresses[j]] >
                    reputationOf[nextReporterAddress]
                ) {
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
        string calldata bundleId,
        uint256 blockHeight,
        uint256 fee,
        string[] calldata streams,
        address[][] calldata nodesPerStream,
        uint256[][] calldata bytesObservedPerNode,
        uint256[][] calldata bytesMissedPerNode,
        uint256[][] calldata bytesQueriedPerNode,
        address[][] calldata consumerAddresses,
        uint256[][] calldata bytesQueriedPerConsumer,
        // Arrays of addresses and signatures for verification
        address[] calldata addresses,
        bytes[] calldata signatures
    ) public onlyStaked {
        require(
            reports[lastReportId].height < blockHeight,
            "error_invalidReport"
        );
        require(blockHeight <= block.number, "error_invalidReport");
        require(streams.length == nodesPerStream.length, "error_badRequest");
        require(
            streams.length == bytesObservedPerNode.length,
            "error_badRequest"
        );
        require(
            streams.length == bytesMissedPerNode.length,
            "error_badRequest"
        );
        require(streams.length == consumerAddresses.length, "error_badRequest");
        require(
            streams.length == bytesQueriedPerConsumer.length,
            "error_badRequest"
        );

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

        // Produce json blob that signatures correspond to
        uint256 totalWrite = 0;
        uint256 totalRead = 0;
        /* solhint-disable quotes */
        string memory reportJson = string.concat(
            '{ "id": "',
            bundleId,
            '", "height": "',
            StringsUpgradeable.toString(blockHeight),
            '", "fee": ',
            StringsUpgradeable.toString(fee),
            '", "streams": ['
        );

        Stream[] memory rStreams = new Stream[](streams.length);
        for (uint256 i = 0; i < streams.length; i++) {
            uint256 streamRead = 0;
            uint256 streamWrite = 0;

            reportJson = string.concat(
                reportJson,
                '{ "id": "',
                streams[i],
                '", "read": {'
            );
            for (uint256 j = 0; j < consumerAddresses[i].length; j++) {
                streamRead += bytesQueriedPerConsumer[i][j];

                reportJson = string.concat(
                    reportJson,
                    '"',
                    StringsUpgradeable.toHexString(consumerAddresses[i][j]),
                    '":"',
                    StringsUpgradeable.toString(bytesQueriedPerConsumer[i][j]),
                    '"'
                );
                if (j != consumerAddresses[i].length - 1) {
                    reportJson = string.concat(reportJson, ",");
                }
            }
            reportJson = string.concat(reportJson, '}, "write": [');

            Node[] memory rNodes = new Node[](nodesPerStream[i].length);
            for (uint256 j = 0; j < nodesPerStream[i].length; j++) {
                streamWrite += bytesObservedPerNode[i][j];
                reportJson = string.concat(
                    reportJson,
                    '{ "id": "',
                    StringsUpgradeable.toHexString(nodesPerStream[i][j]),
                    '", "observed": ',
                    StringsUpgradeable.toString(bytesObservedPerNode[i][j]),
                    ', "missed": ',
                    StringsUpgradeable.toString(bytesMissedPerNode[i][j]),
                    ', "queried": ',
                    StringsUpgradeable.toString(bytesQueriedPerNode[i][j]),
                    " }"
                );

                rNodes[j] = Node({
                    id: nodesPerStream[i][j],
                    observed: bytesObservedPerNode[i][j],
                    missed: bytesMissedPerNode[i][j],
                    queried: bytesQueriedPerNode[i][j]
                });
            }
            reportJson = string.concat(reportJson, "]}");
            totalWrite += streamWrite; // the total amount of data cached across nodes for the given stream
            totalRead += streamRead;

            rStreams[i] = Stream({
                id: streams[i],
                consumers: consumerAddresses[i],
                queried: bytesQueriedPerConsumer[i],
                nodes: rNodes,
                _read: streamRead,
                _write: streamWrite
            });
        }
        reportJson = string.concat(reportJson, "]}");
        /* solhint-enable quotes */

        // Consume report data
        Report memory currentReport = Report({
            id: bundleId,
            height: blockHeight,
            fee: fee,
            streams: rStreams,
            _read: totalRead,
            _write: totalWrite,
            _processed: false
        });

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

        // Remove reporter from list?

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
}
