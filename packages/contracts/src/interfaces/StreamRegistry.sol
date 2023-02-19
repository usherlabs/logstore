// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

// import 'streamr-contracts/packages/network-contracts/contracts/StreamRegistry/StreamRegistryV4.sol';
// https://github.com/streamr-dev/network-contracts/blob/master/packages/network-contracts/contracts/StreamRegistry/StreamRegistryV4.sol

interface IStreamRegistry {
    function exists(string calldata streamId) external view returns (bool);
}
