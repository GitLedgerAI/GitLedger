// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IEAS {
    function attest(bytes calldata data) external returns (bytes32);
    function revoke(bytes32 uid) external;
}
