import { ethers, Wallet } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

// ABI fragment for the BodhiArbitrageRouter (focusing on the executeArbitrage function)
const ROUTER_ABI = [
  "function executeArbitrage((address router, uint8 routerType, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, bytes path, address recipient) params) external returns (uint256 amountOut)",
  "function owner() external view returns (address)",
  "event ArbitrageExecuted(address indexed router, uint8 indexed routerType, address indexed tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, address recipient)",
  "error InsufficientOutput(uint256 received, uint256 expected)",
  "error TransferFailed()"
];

// ABI fragment for standard ERC20 token interactions (e.g., checking approval/allowance)
const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)"
];

async function main() {
  // 1. Environment & RPC Setup
  const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-bor-rpc.publicnode.com';
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const botPrivateKey = process.env.WALLET_PRIVATE_KEY;
  if (!botPrivateKey) {
    console.error("Error: WALLET_PRIVATE_KEY is missing from .env");
    process.exit(1);
  }

  // The bot EOA wallet that is authorized to call executeArbitrage (must be the contract owner)
  const botWallet = new Wallet(botPrivateKey, provider);
  console.log(`Bot Wallet (EOA Caller): ${botWallet.address}`);

  // The deployed BodhiArbitrageRouter contract address
  const routerAddress = process.env.BODHI_ARBITRAGE_ROUTER_ADDRESS;
  if (!routerAddress) {
    console.warn("Warning: BODHI_ARBITRAGE_ROUTER_ADDRESS not set in .env. Using mock address for demonstration.");
  }
  const activeRouterAddress = routerAddress || "0x0000000000000000000000000000000000000000";

  // The Gnosis Safe Proxy wallet address which holds your collateral/funds
  const proxyAddress = process.env.POLY_PROXY_ADDRESS;
  if (!proxyAddress) {
    console.error("Error: POLY_PROXY_ADDRESS is missing from .env");
    process.exit(1);
  }
  console.log(`Gnosis Safe Proxy (Funds Owner): ${proxyAddress}`);

  // Create contract instances
  const arbitrageRouter = new ethers.Contract(activeRouterAddress, ROUTER_ABI, botWallet);

  // 2. Define Arbitrage Parameters
  // Example: Arbitrage swapping USDC.e -> wrapped outcome token on Quickswap (Uniswap V2)
  const USDC_E = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
  const OUTCOME_TOKEN = "0x1234567890123456789012345678901234567890"; // Mock outcome wrapped ERC20 token
  const QUICKSWAP_ROUTER = "0xa5E0829CaCEd8fFDD4De3c43696c57F7d7A678ff"; // Quickswap V2 Router on Polygon

  const tradeAmount = ethers.parseUnits("50.0", 6); // 50 USDC.e (6 decimals)
  const minExpectedProfit = ethers.parseUnits("50.5", 6); // We want at least 50.5 USDC.e back (representing a profit)
  
  // Note: For Quickswap (Uniswap V2), we encode the address path array [tokenIn, tokenOut] into bytes
  const pathArray = [USDC_E, OUTCOME_TOKEN, USDC_E]; // Standard circular arbitrage path
  const encodedPath = ethers.AbiCoder.defaultAbiCoder().encode(["address[]"], [pathArray]);

  // 3. Pre-flight Checks (Approvals)
  // CRITICAL: The Gnosis Safe proxy must have approved the BodhiArbitrageRouter contract to spend its USDC.e.
  // This approval must be executed ONCE by the Gnosis Safe (using safe multisig execution or your daemon's safe-tx signer).
  const tokenContract = new ethers.Contract(USDC_E, ERC20_ABI, provider);
  const allowance = await tokenContract.allowance(proxyAddress, activeRouterAddress);
  
  console.log(`USDC.e allowance from Gnosis Safe proxy to Router: ${ethers.formatUnits(allowance, 6)} USDC.e`);
  if (allowance < tradeAmount) {
    console.log("\n==========================================================================");
    console.log("CRITICAL REQUIRED STEP:");
    console.log("Your Gnosis Safe proxy must approve the router contract to spend its USDC.");
    console.log(`Target Spender: ${activeRouterAddress}`);
    console.log(`Required Amount: ${ethers.formatUnits(tradeAmount, 6)} USDC (or max uint256 for a one-off setup)`);
    console.log("Please trigger an approval tx from your Gnosis Safe proxy before running the daemon.");
    console.log("==========================================================================\n");
    
    // We exit in this example, but in your daemon you would check this before submitting trades
    return;
  }

  // 4. Assemble the Arbitrage Transaction Payload
  const swapParams = {
    router: QUICKSWAP_ROUTER,
    routerType: 0, // RouterType.UNISWAP_V2
    tokenIn: USDC_E,
    tokenOut: USDC_E, // Swapping back to USDC.e to complete the loop
    amountIn: tradeAmount,
    minAmountOut: minExpectedProfit, // Enforce slippage / profit threshold
    path: encodedPath,
    recipient: proxyAddress // Funds will be pulled from and returned back to your Gnosis Safe
  };

  console.log("Sending Arbitrage Transaction...");
  console.log(JSON.stringify(swapParams, (key, val) => typeof val === 'bigint' ? val.toString() : val, 2));

  if (!routerAddress) {
    console.log("Skipping actual transaction send: BODHI_ARBITRAGE_ROUTER_ADDRESS is not set.");
    return;
  }

  try {
    // 5. Send Transaction
    // The EOA botWallet signs and sends the tx. It pays gas, but does not need to hold any USDC.
    // The router contract pulls the USDC from the proxyAddress, swaps, and returns output back to proxyAddress.
    const tx = await arbitrageRouter.executeArbitrage(swapParams, {
      gasLimit: 500000 // Set a safe gas limit. If it reverts, gas is saved because execution stops early.
    });

    console.log(`Transaction submitted! Hash: ${tx.hash}`);
    console.log("Waiting for confirmation...");
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt.blockNumber}! Status: ${receipt.status}`);

    // Parse events
    for (const log of receipt.logs) {
      try {
        const parsedLog = arbitrageRouter.interface.parseLog(log);
        if (parsedLog && parsedLog.name === 'ArbitrageExecuted') {
          console.log(`\n🎉 Arbitrage Success!`);
          console.log(`Target Router: ${parsedLog.args.router}`);
          console.log(`Input Token: ${parsedLog.args.tokenIn}`);
          console.log(`Amount In: ${ethers.formatUnits(parsedLog.args.amountIn, 6)}`);
          console.log(`Amount Out: ${ethers.formatUnits(parsedLog.args.amountOut, 6)}`);
          console.log(`Recipient (Safe Proxy): ${parsedLog.args.recipient}`);
        }
      } catch (e) {
        // Skip log parsing errors for other non-router events (like ERC20 Transfer events)
      }
    }
  } catch (err: any) {
    console.error("\n❌ Transaction Reverted or Failed:");
    if (err.data) {
      try {
        // Try decoding custom error if reverted
        const decodedError = arbitrageRouter.interface.parseError(err.data);
        console.error(`Revert Reason: ${decodedError?.name} (${decodedError?.args})`);
      } catch {
        console.error(err.message);
      }
    } else {
      console.error(err.message);
    }
  }
}

main().catch(console.error);
