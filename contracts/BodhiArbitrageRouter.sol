// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

interface ISwapRouter {
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }
    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}

contract BodhiArbitrageRouter is Ownable {
    // Custom errors for gas efficiency
    error ArbitrageFailed(string reason);
    error InsufficientOutput(uint256 received, uint256 expected);
    error InvalidRouterType();
    error TransferFailed();

    enum RouterType {
        UNISWAP_V2,
        UNISWAP_V3,
        GENERIC
    }

    struct ArbitrageParams {
        address router;        // The address of the swap router/exchange/target
        RouterType routerType; // RouterType enum (UNISWAP_V2, UNISWAP_V3, GENERIC)
        address tokenIn;       // The token we are starting with/selling
        address tokenOut;      // The token we expect to receive/buy
        uint256 amountIn;      // Amount of tokenIn to trade
        uint256 minAmountOut;  // Minimum expected amount of tokenOut (slippage check)
        bytes path;            // V3 path bytes, decoded V2 address array, or generic calldata payload
        address recipient;     // Destination for output tokens and source for pulling input tokens (e.g. Gnosis Safe proxy)
    }

    // Events
    event ArbitrageExecuted(
        address indexed router,
        RouterType indexed routerType,
        address indexed tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address recipient
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Executes an atomic arbitrage trade across Uniswap V2, V3, or generic custom contract.
     * @dev Only callable by the owner (bot address). Reverts the entire transaction if minAmountOut is not met.
     * @param params The ArbitrageParams struct containing all trade details.
     */
    function executeArbitrage(ArbitrageParams calldata params) external onlyOwner returns (uint256 amountOut) {
        uint256 balanceBefore = IERC20(params.tokenOut).balanceOf(address(this));

        // Pull tokens from the recipient if contract does not have sufficient balance
        uint256 currentBalance = IERC20(params.tokenIn).balanceOf(address(this));
        if (currentBalance < params.amountIn) {
            uint256 needed = params.amountIn - currentBalance;
            bool success = IERC20(params.tokenIn).transferFrom(params.recipient, address(this), needed);
            if (!success) revert TransferFailed();
        }

        // Approve router/exchange to spend tokenIn
        IERC20(params.tokenIn).approve(params.router, params.amountIn);

        if (params.routerType == RouterType.UNISWAP_V2) {
            // Decode Uniswap V2 path
            address[] memory pathArray = abi.decode(params.path, (address[]));
            IUniswapV2Router(params.router).swapExactTokensForTokens(
                params.amountIn,
                params.minAmountOut,
                pathArray,
                address(this),
                block.timestamp
            );
        } else if (params.routerType == RouterType.UNISWAP_V3) {
            // Set up Uniswap V3 exact input params
            ISwapRouter.ExactInputParams memory swapParams = ISwapRouter.ExactInputParams({
                path: params.path,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: params.amountIn,
                amountOutMinimum: params.minAmountOut
            });
            ISwapRouter(params.router).exactInput(swapParams);
        } else if (params.routerType == RouterType.GENERIC) {
            // Execute generic payload call to target address
            (bool success, ) = params.router.call(params.path);
            if (!success) revert ArbitrageFailed("Generic call reverted");
        } else {
            revert InvalidRouterType();
        }

        // Verify output amount
        uint256 balanceAfter = IERC20(params.tokenOut).balanceOf(address(this));
        amountOut = balanceAfter - balanceBefore;

        if (amountOut < params.minAmountOut) {
            revert InsufficientOutput(amountOut, params.minAmountOut);
        }

        // Transfer output tokens back to the designated recipient (e.g. Gnosis Safe proxy)
        bool transferSuccess = IERC20(params.tokenOut).transfer(params.recipient, amountOut);
        if (!transferSuccess) revert TransferFailed();

        emit ArbitrageExecuted(
            params.router,
            params.routerType,
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            amountOut,
            params.recipient
        );
    }

    /**
     * @notice Recovers any stuck ERC20 tokens in the contract.
     * @param token Address of the ERC20 token.
     * @param amount Amount to recover.
     */
    function recoverERC20(address token, uint256 amount) external onlyOwner {
        bool success = IERC20(token).transfer(owner(), amount);
        if (!success) revert TransferFailed();
    }

    /**
     * @notice Recovers any stuck native gas token (ETH/POL).
     */
    function recoverNative() external onlyOwner {
        (bool success, ) = owner().call{value: address(this).balance}("");
        if (!success) revert TransferFailed();
    }

    // Accept native gas tokens if needed
    receive() external payable {}
}
