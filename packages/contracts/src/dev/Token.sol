// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DevToken is ERC20 {
    uint256 private MINT_AMOUNT = 1000000 * 10 ** 18;

    constructor() ERC20("DevToken", "DVT") {
        _mint(0xa3d1F77ACfF0060F7213D7BF3c7fEC78df847De1, MINT_AMOUNT);
        _mint(0x4178baBE9E5148c6D5fd431cD72884B07Ad855a0, MINT_AMOUNT);
        _mint(0xdC353aA3d81fC3d67Eb49F443df258029B01D8aB, MINT_AMOUNT);
        _mint(0x7986b71C27B6eAAB3120a984F26511B2dcfe3Fb4, MINT_AMOUNT);
        _mint(0xa6743286b55F36AFA5F4e7e35B6a80039C452dBD, MINT_AMOUNT);
        _mint(0x7B556228B0D887CfC8d895cCe27CbC79d3e55b3C, MINT_AMOUNT);
        _mint(0x795063367EbFEB994445d810b94461274E4f109A, MINT_AMOUNT);
        _mint(0xcA9b39e7A7063cDb845483426D4f12F1f4A44A19, MINT_AMOUNT);
        _mint(0x505D48552Ac17FfD0845FFA3783C2799fd4aaD78, MINT_AMOUNT);
        _mint(0x65416CBeF822290d9A2FC319Eb6c7f6D9Cd4a541, MINT_AMOUNT);
    }

    function mintMany(address[] memory _addresses) public {
        for (uint256 i = 0; i < _addresses.length; i++) {
            _mint(_addresses[i], MINT_AMOUNT);
        }
    }
}
