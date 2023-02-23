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

contract LogStoreReportManager is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    event ReportAccepted(string raw);

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

    uint256 public reportBlockBuffer = 10;
    string public lastReportId;
    mapping(address => uint256) public reputationOf;
    mapping(string => address[]) public reportersOf;
    mapping(string => Report) public reports;

    function initialize(address owner) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        transferOwnership(owner);
    }

    /// @dev required by the OZ UUPS module
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function getReportersList(
        string calldata id,
        address[] calldata nodeAddresses
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

    // Verifies a report and adds it to its accepted reports mapping
    function verifyReport(
        address[] calldata nodeAddresses,
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
    )
        public
        onlyOwner
        returns (
            Report memory report,
            uint256 storedBytes,
            uint256 queriedBytes
        )
    {
        require(
            reports[lastReportId].height < blockHeight,
            "error_invalidReport"
        );
        require(blockHeight <= block.number, "error_invalidReport");

        // validate that the appropriate reporters can submit reports based on the current block
        address[] memory orderedReportersList = getReportersList(
            bundleId,
            nodeAddresses
        );
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
                    uint256 x = 0;
                    x < consumerAddressesPerStream[i][j].length;
                    x++
                ) {
                    totalQueriedBytes += bytesQueriedByConsumerPerStream[i][j][
                        x
                    ];

                    formattedQueriedData = string.concat(
                        '"',
                        StringsUpgradeable.toHexString(
                            consumerAddressesPerStream[i][j][x]
                        ),
                        '": ',
                        StringsUpgradeable.toString(
                            bytesQueriedByConsumerPerStream[i][j][x]
                        )
                    );
                    if (x != consumerAddressesPerStream[i][j].length - 1) {
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

        reports[currentReport.id] = currentReport;
        lastReportId = currentReport.id;

        emit ReportAccepted(reportJson);

        return (currentReport, totalStoredBytes, totalQueriedBytes);
    }
}
