// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./EIP3009/EIP3009.sol";

contract SampleToken is ERC20, EIP3009 {
    string public version;

    constructor() ERC20("SampleToken", "SMPL") {
        version = "1";
        DOMAIN_SEPARATOR = EIP712.makeDomainSeparator("SampleToken", version);

        _mint(msg.sender, 10000000 * 10**decimals());
    }
}
