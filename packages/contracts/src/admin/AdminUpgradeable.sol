// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (access/Ownable.sol)

pragma solidity ^0.8.19;

import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
// Fork of OwnableUpgradeable
abstract contract AdminUpgradeable is Initializable, ContextUpgradeable {
    address private _admin;

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error AdminUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error AdminInvalidOwner(address owner);

    event AdminTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    function __Admin_init(address initialOwner) internal onlyInitializing {
        __Admin_init_unchained(initialOwner);
    }

    function __Admin_init_unchained(address initialOwner) internal onlyInitializing {
        _transferAdmin(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyAdmin() {
        _checkAdmin();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function admin() public view virtual returns (address) {
        return _admin;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkAdmin() internal view virtual {
        if (admin() != _msgSender()) {
            revert AdminUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceAdmin() public virtual onlyOwner {
        _transferAdmin(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferAdmin(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert AdminInvalidOwner(address(0));
        }
        _transferAdmin(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferAdmin(address newOwner) internal virtual {
        address oldOwner = _admin;
        _admin = newOwner;
        emit AdminTransferred(oldOwner, newOwner);
    }
}
