// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 1000000 * 10**decimals());
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockUniswapV2Router {
    address public tokenOut;
    uint256 public swapRate;

    constructor(address _tokenOut, uint256 _swapRate) {
        tokenOut = _tokenOut;
        swapRate = _swapRate;
    }

    function setSwapRate(uint256 _swapRate) external {
        swapRate = _swapRate;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        address tokenIn = path[0];
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        
        uint256 amountOut = (amountIn * swapRate) / 1000;
        IERC20(tokenOut).transfer(to, amountOut);

        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        amounts[path.length - 1] = amountOut;
    }
}

contract MockUniswapV3Router {
    address public tokenIn;
    address public tokenOut;
    uint256 public swapRate;

    constructor(address _tokenIn, address _tokenOut, uint256 _swapRate) {
        tokenIn = _tokenIn;
        tokenOut = _tokenOut;
        swapRate = _swapRate;
    }

    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    function setSwapRate(uint256 _swapRate) external {
        swapRate = _swapRate;
    }

    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut) {
        IERC20(tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
        amountOut = (params.amountIn * swapRate) / 1000;
        IERC20(tokenOut).transfer(params.recipient, amountOut);
    }
}

contract MockGenericTarget {
    address public tokenIn;
    address public tokenOut;
    uint256 public swapRate;

    constructor(address _tokenIn, address _tokenOut, uint256 _swapRate) {
        tokenIn = _tokenIn;
        tokenOut = _tokenOut;
        swapRate = _swapRate;
    }

    function setSwapRate(uint256 _swapRate) external {
        swapRate = _swapRate;
    }

    function swapGeneric(uint256 amountIn) external {
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        uint256 amountOut = (amountIn * swapRate) / 1000;
        IERC20(tokenOut).transfer(msg.sender, amountOut);
    }
}
