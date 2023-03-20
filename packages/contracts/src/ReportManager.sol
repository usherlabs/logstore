// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

// Open Zeppelin libraries for controlling upgradability and access.
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {LogStoreNodeManager} from "./NodeManager.sol";
import {VerifySignature} from "./lib/VerifySignature.sol";
import {StringsUpgradeable} from "./lib/StringsUpgradeable.sol";


contract LogStoreReportManager is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    event ReportAccepted(string raw);

		struct Consumer {
			address id;
			uint256 readCapture;
			uint256 readBytes;
		}

    struct Stream {
			string id;
			uint256 writeCapture;
			uint256 writeBytes;
			Consumer[] consumers;
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
        string id; // bundle id
				string key; // key inside of bundle
        uint256 height;
        uint256 fee;
				int256 treasury;
        Stream[] streams;
				Node[] nodes;
				Delegate[] delegates;
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

    function initialize(address owner) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        _nodeManager = LogStoreNodeManager(owner);
        reportBlockBuffer = 10;

        transferOwnership(owner);
    }

    /// @dev required by the OZ UUPS module
    function _authorizeUpgrade(address) internal override onlyOwner {}


		function getReport(string calldata id) public view returns (Report memory){
			return reports[id];
		}

		function getLastReport() public view returns (Report memory) {
			return reports[lastReportId];
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
				string calldata key,
        uint256 blockHeight,
        uint256 fee,
        string[] calldata streams,
				uint256[] calldata writeCaptureAmounts,
				uint256[] calldata writeBytes,
				address[][] calldata readConsumerAddresses,
				uint256[][] calldata readCaptureAmounts,
				uint256[][] calldata readBytes,
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

			/* solhint-disable quotes */
			string memory reportJson = string.concat(
					'{"id":"',
					bundleId,
					'","height":"',
					StringsUpgradeable.toString(blockHeight),
					'","fee":"',
					StringsUpgradeable.toString(fee),
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
							'","write":{"capture":',
							StringsUpgradeable.toString(writeCaptureAmounts[i]),
							', "bytes": ',StringsUpgradeable.toString(writeBytes[i]),
							'},"read": {'
					);

					Consumer[] memory rConsumers = new Consumer[](readConsumerAddresses[i].length);
					for (uint256 j = 0; j < readConsumerAddresses[i].length; j++) {
						reportJson = string.concat(
								reportJson,
								'"',
								StringsUpgradeable.toHexString(readConsumerAddresses[i][j]),
								'":{"amount": ',
								StringsUpgradeable.toString(readCaptureAmounts[i][j]),
								', "bytes": ', StringsUpgradeable.toString(readBytes[i][j]) ,'}'
						);
						if (j != readConsumerAddresses[i].length - 1) {
								reportJson = string.concat(reportJson, ",");
						}

						rConsumers[j] = Consumer({
							id: readConsumerAddresses[i][j],
							readCapture: readCaptureAmounts[i][j],
							readBytes: readBytes[i][j]
						});
					}
					if (i != streams.length - 1) {
								reportJson = string.concat(reportJson, "},");
						}else{
							reportJson = string.concat(reportJson,'}');
						}

					rStreams[i] = Stream({
						id: streams[i],
						writeCapture: writeCaptureAmounts[i],
						writeBytes: writeBytes[i],
						consumers: rConsumers
					});
			}

			reportJson = string.concat(reportJson,'], "nodes": {');
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

				rNodes[i] = Node({
					id: nodes[i],
					amount: nodeChanges[i]
				});
			}

			reportJson = string.concat(reportJson,'}, "delegates": {');
			Delegate[] memory rDelegates = new Delegate[](delegates.length);
			for (uint256 i = 0; i < delegates.length; i++) {
				reportJson = string.concat(
						reportJson,
						'"',
						StringsUpgradeable.toHexString(delegates[i]),
						'":{'
				);
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

					rDelegateNodes[j] = Node({
						id: delegateNodes[i][j],
						amount: delegateNodeChanges[i][j]
					});
				}
				if (i != delegates.length - 1) {
						reportJson = string.concat(reportJson, ",");
				}

				rDelegates[i] = Delegate({
					id: delegates[i],
					nodes: rDelegateNodes
				});
			}

			reportJson = string.concat(reportJson,'}}');
			/* solhint-enable quotes */

			// Consume report data
			Report memory currentReport = Report({
					id: bundleId,
					key: key,
					height: blockHeight,
					fee: fee,
					treasury: treasurySupplyChange,
					streams: rStreams,
					nodes: rNodes,
					delegates: rDelegates,
					_reporter: _msgSender(),
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
