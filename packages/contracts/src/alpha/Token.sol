// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.17;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

contract LSAN is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable, ERC20Upgradeable {
	uint256 public weiPerByte; // In 18 decimal format -- ie. Wei
	uint256 public multiplier;
	uint256 public minimumDeposit;
	address payable public SAFE_ADDRESS;
	uint256 public DEPLOYED_TIME;
	mapping(address => bool) blacklist;
	mapping(address => mapping(address => bool)) whitelist;

	modifier onlyPermitted(address _from, address _to) {
		require(
			isPermitted(_from, _to),
			"LSAN: Transfer between addresses is not permitted"
		);
		_;
	}

	/// @dev required by the OZ UUPS module
	function _authorizeUpgrade(address) internal override onlyOwner {}

	function initialize(
			address _safeAddress,
			uint256 _weiPerByte,
			address[] memory _blacklist,
			address[][] memory _whitelist
	) public initializer {
		require(_blacklist.length == _whitelist.length, "LSAN: Initial whitelist configuration invalid");

		__Ownable_init();
		__ERC20_init("Log Store Alpha Network Token", "LSAN");
		__UUPSUpgradeable_init();
		__ReentrancyGuard_init();

		// initiate the blacklist/whitelist
		for (uint256 i = 0; i < _blacklist.length; i++) {
			addBlacklist(_blacklist[i]);
			for (uint256 j = 0; j < _whitelist[i].length; j++) {
				addWhitelist(_whitelist[i][j], _blacklist[i]);
			}
		}

		SAFE_ADDRESS = payable(_safeAddress);
		DEPLOYED_TIME = block.timestamp;
		multiplier = 1;
		minimumDeposit = 0;
		weiPerByte = _weiPerByte;
	}

	// ---------- Admin functions
	function mintTokens(address account, uint256 amount) public onlyOwner {
		_mint(account, amount);
	}

	function mintManyTokens(address[] memory _addresses, uint256 amount) public onlyOwner {
		for (uint256 i = 0; i < _addresses.length; i++) {
			_mint(_addresses[i], amount);
		}
	}

	function burn(address account, uint256 amount) public onlyOwner {
		_burn(account, amount);
	}

	function addBlacklist(address _address) public onlyOwner {
		blacklist[_address] = true;
	}

	function removeBlacklist(address _address) public onlyOwner {
		blacklist[_address] = false;
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

	function setWeiPerByte(uint256 _weiPerByte) public onlyOwner {
		weiPerByte = _weiPerByte;
	}

	function setMultipler(uint256 _multiplier) public onlyOwner {
		multiplier = _multiplier;
	}

	function setMinimumDeposit(uint _minimumDeposit) public onlyOwner {
		minimumDeposit = _minimumDeposit;
	}

	// ---------- Public methods
	function price() public view returns (uint256) {
		return weiPerByte * multiplier;
	}

	function mint() public payable nonReentrant {
		require(msg.value >= weiPerByte, "LSAN: Amount less than a single byte");
		require(msg.value >= minimumDeposit, "LSAN: Amount less than minimum deposit amount");

		uint lsanPrice = price();

		uint mintAmount = msg.value / lsanPrice;

		_mint(_msgSender(), mintAmount);
	}

	function balance() public view returns (uint256) {
		return address(this).balance;
	}

	function isPermitted(address _from, address _to) public view returns (bool) {
		if(blacklist[_to]){
			return whitelist[_from][_to];
		}
		return true;
	}

	// ---------- Override methods
	function transfer(address _to, uint256 _amount) public override onlyPermitted(_msgSender(), _to) returns (bool) {
		address owner = _msgSender();
		_transfer(owner, _to, _amount);
		return true;
	}

	function transferFrom(
		address _from,
		address _to,
		uint256 amount
	) public override onlyPermitted(_from, _to) returns (bool) {
		address spender = _msgSender();
		_spendAllowance(_from, spender, amount);
		_transfer(_from, _to, amount);
		return true;
	}
}
