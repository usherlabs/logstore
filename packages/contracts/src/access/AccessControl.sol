// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (access/AccessControl.sol)

pragma solidity ^0.8.0;

import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {StringsUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import {ERC165Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

abstract contract AccessControlUpgradeable is Initializable, ContextUpgradeable, ERC165Upgradeable {
    enum Role {
        USER,
        SUPER_USER,
        DEV,
        ADMIN
    }

    mapping(address => Role) public roles;

    modifier isAuthorized(Role minimumRequiredRole) {
        require(roles[_msgSender()] >= minimumRequiredRole, "AccessControl: NOT_AUTHORIZED");
        _;
    }

    event RoleGranted(Role indexed role, address indexed account, address indexed sender);
    event RoleRevoked(Role indexed role, address indexed account, address indexed sender);

    function __AccessControl_init(address _owner) internal onlyInitializing {
        __AccessControl_init_unchained(_owner);
    }

    function __AccessControl_init_unchained(address _owner) internal onlyInitializing {
        _grantRole(Role.ADMIN, _owner);
    }

    function grantRole(Role role, address account) external isAuthorized(Role.ADMIN) {
        _grantRole(role, account);
    }

    function revokeRole(address account) external {
        _revokeRole(account);
    }

    function renounceRole(address account) external {
        require(account == _msgSender(), "AccessControl: NOT_ACCOUNT_OWNER");
        _revokeRole(account);
    }

    function _revokeRole(address account) internal {
        roles[account] = Role.USER;
    }

    function _grantRole(Role role, address account) internal {
        require(roles[account] != role, "AccessControl: ROLE_ALREADY_ASSIGNED");
        roles[account] = role;
        emit RoleGranted(role, account, _msgSender());
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[49] private __gap;
}
