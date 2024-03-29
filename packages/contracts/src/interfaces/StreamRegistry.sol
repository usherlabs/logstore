// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

// import 'streamr-contracts/packages/network-contracts/contracts/StreamRegistry/StreamRegistryV4.sol';
// https://github.com/streamr-dev/network-contracts/blob/master/packages/network-contracts/contracts/StreamRegistry/StreamRegistryV4.sol

interface IStreamRegistry {
    enum PermissionType {
        Edit,
        Delete,
        Publish,
        Subscribe,
        Grant
    }

    function createStream(string calldata streamIdPath, string calldata metadataJsonString) external;

    function grantPublicPermission(string calldata streamId, PermissionType permissionType) external;

    function grantPermission(string calldata streamId, address user, PermissionType permissionType) external;

    function revokePermission(string calldata streamId, address user, PermissionType permissionType) external;

    function exists(string calldata streamId) external view returns (bool);

    function deleteStream(string calldata streamId) external;
}
