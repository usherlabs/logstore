// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.17;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

contract LSAN is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable, ERC20Upgradeable {
    uint256 public maticPerByte;
    uint256 public totalBytesStored;
    uint256 public multiplier;
    uint256 public minimumDeposit;
    address payable public SAFE_ADDRESS;
    uint256 public DEPLOYED_TIME;
		address[] public defaultWhitelistedRecipients;
		mapping(address => mapping(address => bool)) whitelist;

    modifier onlyWhitelisted(address _from, address _to) {
        require(
            whitelist[_from][_to],
            "LSAN: Transfer between addresses is not permitted"
        );
        _;
    }

    /// @dev required by the OZ UUPS module
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function initialize(
        address _safeAddress,
        address[] memory _whitelistFrom,
        address[] memory _whitelistTo,
        address[] memory _defaultWhitelistedRecipients
    ) public initializer {
				require(_whitelistFrom.length == _whitelistTo.length, "LSAN: Initial whitelist configuration invalid");

        __Ownable_init();
        __ERC20_init("Log Store Alpha Network Token", "LSAN");
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        // go through the initial whitelist and whitelist appropriately
        for (uint256 i = 0; i < _whitelistFrom.length; i++) {
					addWhitelist(_whitelistFrom[i], _whitelistTo[i]);
        }

        SAFE_ADDRESS = payable(_safeAddress);
        DEPLOYED_TIME = block.timestamp;
        multiplier = 1;
        minimumDeposit = 0;
				defaultWhitelistedRecipients = _defaultWhitelistedRecipients;
    }

    // ---------- Internal functions
		function _mintTokens(address account, uint256 amount) internal {
			for(uint256 i = 0; i < defaultWhitelistedRecipients.length; i ++){
				addWhitelist(account, defaultWhitelistedRecipients[i]);
			}
			_mint(account, amount);
		}

    // ---------- Admin functions
    function mintTokens(address account, uint256 amount) public onlyOwner {
        _mintTokens(account, amount);
    }

    function mintManyTokens(address[] memory _addresses, uint256 amount) public onlyOwner {
        for (uint256 i = 0; i < _addresses.length; i++) {
            _mintTokens(_addresses[i], amount);
        }
    }

    function burn(address account, uint256 amount) public onlyOwner {
        _burn(account, amount);
    }

		function addWhitelist(address _from, address _to) public onlyOwner {
			whitelist[_from][_to] = true;
		}

		function removeWhitelist(address _from, address _to) public onlyOwner {
			whitelist[_from][_to] = false;
		}

		function massAddWhitelist(address[] memory _fromAddresses, address[] memory _toAddresses) public onlyOwner {
			require(_fromAddresses.length == _toAddresses.length, "LSAN: Invalid parameters for mass update");
			for(uint256 i = 0; i < _fromAddresses.length; i ++){
				addWhitelist(_fromAddresses[i], _toAddresses[i]);
			}
		}

		function massRemoveWhitelist(address[] memory _fromAddresses, address[] memory _toAddresses) public onlyOwner {
			require(_fromAddresses.length == _toAddresses.length, "LSAN: Invalid parameters for mass update");
			for(uint256 i = 0; i < _fromAddresses.length; i ++){
				removeWhitelist(_fromAddresses[i], _toAddresses[i]);
			}
		}

    function withdraw(uint256 amount) public onlyOwner {
        require(address(this).balance >= amount, "LSAN: Insufficient contract balance");
        SAFE_ADDRESS.transfer(amount);
    }

    function setMaticPerByte(uint256 _maticPerByte) public onlyOwner {
        maticPerByte = _maticPerByte;
    }

    function setTotalBytesStored(uint256 _totalBytesStored) public onlyOwner {
        totalBytesStored = _totalBytesStored;
    }

    function setMultipler(uint256 _multiplier) public onlyOwner {
        multiplier = _multiplier;
    }

    function setMinimumDeposit(uint _minimumDeposit) public onlyOwner {
        minimumDeposit = _minimumDeposit;
    }

		function setDefaultWhitelistedRecipients(address[] memory _defaultRecipients) public onlyOwner {
        defaultWhitelistedRecipients = _defaultRecipients;
    }

    // ---------- Public methods
    function getTokenPrice() public view returns (uint256 lsanPrice) {
        uint totalExpense = maticPerByte * totalBytesStored;
        uint timeSinceStart = block.timestamp - DEPLOYED_TIME;
        uint totalExpensePerDay = (totalExpense / (timeSinceStart * 24 * 60 * 60 * 1000));
        lsanPrice = totalExpensePerDay * multiplier;
    }

    function mint() public payable nonReentrant {
        require(msg.value >= minimumDeposit, "LSAN: Amount less than minimum deposit amount");

        uint lsanPrice = getTokenPrice();

        uint mintAmount = msg.value / lsanPrice;

        _mintTokens(_msgSender(), mintAmount);
    }

    function balance() public view returns (uint256) {
        return address(this).balance;
    }

		function isWhitelisted(address _from, address _to) public view returns (bool) {
			return whitelist[_from][_to];
		}

    // ---------- Override methods
    function transfer(address _to, uint256 _amount) public override onlyWhitelisted(_msgSender(), _to) returns (bool) {
        address owner = _msgSender();
        _transfer(owner, _to, _amount);
        return true;
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 amount
    ) public override onlyWhitelisted(_from, _to) returns (bool) {
        address spender = _msgSender();
        _spendAllowance(_from, spender, amount);
        _transfer(_from, _to, amount);
        return true;
    }
}
