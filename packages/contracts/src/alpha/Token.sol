// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

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
    mapping(address => bool) public transferToWhitelist;
    mapping(address => bool) public transferFromWhitelist;

    modifier onlySafe() {
        require(msg.sender == SAFE_ADDRESS);
        _;
    }

    modifier onlyWhitelistedTo(address _to) {
        require(
            transferToWhitelist[_to],
            "User is not whitelisted to receive tokens"
        );
        _;
    }

    modifier onlyWhitelistedFrom(address _from) {
        require(
            transferFromWhitelist[_from],
            "User is not whitelisted to transfer tokens"
        );
        _;
    }

    /// @dev required by the OZ UUPS module
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function initialize(
        address _safeAddress,
        address[] memory initialWhitelist
    ) public initializer {
        __Ownable_init();
        __ERC20_init("Log Store Alpha Network Token", "LSAN");
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        // go through the initial whitelist and whitelist appropriately
        uint256 whitelistLength = initialWhitelist.length;
        for (uint256 i = 0; i < whitelistLength; i++) {
            whitelistTransferTo(initialWhitelist[i]);
            whitelistTransferFrom(initialWhitelist[i]);
        }

        SAFE_ADDRESS = payable(_safeAddress);
        DEPLOYED_TIME = block.timestamp;
        multiplier = 1;
        minimumDeposit = 0;
    }

    function balance() public view returns (uint256) {
        return address(this).balance;
    }

    // ---------- Admin functions
    function mintTokens(address account, uint256 amount) public onlyOwner {
        whitelistTransferFrom(account);
        whitelistTransferTo(account);
        _mint(account, amount);
    }

    function mintManyTokens(address[] memory _addresses, uint256 amount) public onlyOwner {
        for (uint256 i = 0; i < _addresses.length; i++) {
            whitelistTransferFrom(_addresses[i]);
            whitelistTransferTo(_addresses[i]);
            _mint(_addresses[i], amount);
        }
    }

    function burn(address account, uint256 amount) public onlyOwner {
        _burn(account, amount);
    }

    // Whitelist and unwhitelist an address who can transfer this token to the node manager contract
    function whitelistTransferTo(address account) public onlyOwner {
        require(!transferToWhitelist[account], "Address already whitelisted as sender");
        transferToWhitelist[account] = true;
    }

    function unWhitelistTransferTo(address account) public onlyOwner {
        require(transferToWhitelist[account], "Address not whitelisted as sender");
        transferToWhitelist[account] = false;
    }

    // whitelist and unwhitelist  address who can transfer this token to the node manager contract
    function whitelistTransferFrom(address account) public onlyOwner {
        require(!transferFromWhitelist[account], "Account already whitelisted as recipient");
        transferFromWhitelist[account] = true;
    }

    function unWhitelistTransferFrom(address account) public onlyOwner {
        require(transferFromWhitelist[account], "Account not whitelisted as recipient");
        transferFromWhitelist[account] = false;
    }

		/**
		 * Mass add or remove addresses from whitelists
		 *
		 * @param accounts - list of addresses to conduct whitelist with
		 * @param option -
		 * 	1 = add all both whitelists
		 * 	2 = remove all from whitelists
		 * 	3 = add all to transferTo whitelist
		 * 	4 = add all to transferFrom whitelist
		 * 	5 = remove all from transferTo whitelist
		 * 	6 = remove all from transferFrom whitelist
		 */
		function massWhitelistUpdate(address[] calldata accounts, uint256 option) public onlyOwner {
			require(option >= 1 && option <= 6, "Invalid option");
			if(option == 1){
				for(uint256 i = 0; i < accounts.length; i ++){
					whitelistTransferTo(accounts[i]);
					whitelistTransferFrom(accounts[i]);
				}
			}
			if(option == 2){
				for(uint256 i = 0; i < accounts.length; i ++){
					unWhitelistTransferTo(accounts[i]);
					unWhitelistTransferFrom(accounts[i]);
				}
			}
			if(option == 3){
				for(uint256 i = 0; i < accounts.length; i ++){
					whitelistTransferTo(accounts[i]);
				}
			}
			if(option == 4){
				for(uint256 i = 0; i < accounts.length; i ++){
					whitelistTransferFrom(accounts[i]);
				}
			}
			if(option == 5){
				for(uint256 i = 0; i < accounts.length; i ++){
					unWhitelistTransferTo(accounts[i]);
				}
			}
			if(option == 6){
				for(uint256 i = 0; i < accounts.length; i ++){
					unWhitelistTransferFrom(accounts[i]);
				}
			}
		}

    function withdraw(uint256 amount) public onlyOwner {
        require(address(this).balance >= amount, "Insufficient contract balance");
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

    // ---------- Admin functions

    // ---------- Safe functions
    function destroy() public onlySafe {
        // selfdestruct(SAFE_ADDRESS);
    }

    // ---------- Safe functions

    // ---------- Public methods
    function getTokenPrice() public view returns (uint256 lsanPrice) {
        uint totalExpense = maticPerByte * totalBytesStored;
        uint timeSinceStart = block.timestamp - DEPLOYED_TIME;
        uint totalExpensePerDay = (totalExpense / (timeSinceStart * 24 * 60 * 60 * 1000));
        lsanPrice = totalExpensePerDay * multiplier;
    }

    function mint() public payable nonReentrant {
        require(msg.value > minimumDeposit, "sent amount less than minimum amount");
        require(maticPerByte > 0, "maticPerByte <= 0");
        require(totalBytesStored > 0, "totalBytesStored <= 0");

        uint lsanPrice = getTokenPrice();

        uint mintAmount = msg.value / lsanPrice;

        _mint(_msgSender(), mintAmount);
    }

    // ---------- Public methods

    // ---------- Override methods
    function transfer(address _to, uint256 _amount) public override onlyWhitelistedFrom(_msgSender()) onlyWhitelistedTo(_to) returns (bool) {
        address owner = _msgSender();
        _transfer(owner, _to, _amount);
        return true;
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 amount
    ) public override onlyWhitelistedFrom(_from) onlyWhitelistedTo(_to) returns (bool) {
        address spender = _msgSender();
        _spendAllowance(_from, spender, amount);
        _transfer(_from, _to, amount);
        return true;
    }

    // ---------- Override methods
}
