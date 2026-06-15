import { expect } from "chai";
import { ethers } from "hardhat";

describe("BodhiArbitrageRouter", function () {
  let router: any;
  let tokenIn: any;
  let tokenOut: any;
  let mockV2Router: any;
  let mockV3Router: any;
  let mockGenericTarget: any;
  let owner: any;
  let other: any;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();

    // Deploy Mocks
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    tokenIn = await MockERC20.deploy("Token In", "TIN");
    await tokenIn.waitForDeployment();

    tokenOut = await MockERC20.deploy("Token Out", "TOUT");
    await tokenOut.waitForDeployment();

    // Deploy V2 Router Mock
    const MockUniswapV2Router = await ethers.getContractFactory("MockUniswapV2Router");
    mockV2Router = await MockUniswapV2Router.deploy(await tokenOut.getAddress(), 1000); // 1:1 rate (1000 / 1000)
    await mockV2Router.waitForDeployment();

    // Deploy V3 Router Mock
    const MockUniswapV3Router = await ethers.getContractFactory("MockUniswapV3Router");
    mockV3Router = await MockUniswapV3Router.deploy(await tokenIn.getAddress(), await tokenOut.getAddress(), 1000); // 1:1 rate
    await mockV3Router.waitForDeployment();

    // Deploy Generic Target Mock
    const MockGenericTarget = await ethers.getContractFactory("MockGenericTarget");
    mockGenericTarget = await MockGenericTarget.deploy(await tokenIn.getAddress(), await tokenOut.getAddress(), 1000);
    await mockGenericTarget.waitForDeployment();

    // Deploy BodhiArbitrageRouter
    const BodhiArbitrageRouter = await ethers.getContractFactory("BodhiArbitrageRouter");
    router = await BodhiArbitrageRouter.deploy(owner.address);
    await router.waitForDeployment();

    // Fund the Mock Routers with tokenOut for swapping
    const fundAmount = ethers.parseEther("10000");
    await tokenOut.mint(await mockV2Router.getAddress(), fundAmount);
    await tokenOut.mint(await mockV3Router.getAddress(), fundAmount);
    await tokenOut.mint(await mockGenericTarget.getAddress(), fundAmount);
  });

  it("should deploy with the correct owner", async function () {
    expect(await router.owner()).to.equal(owner.address);
  });

  it("should successfully execute Uniswap V2 arbitrage", async function () {
    const amountIn = ethers.parseEther("100");
    const minAmountOut = ethers.parseEther("100"); // 1:1 rate

    // Approve the ArbitrageRouter to spend owner's tokenIn (simulating proxy approval)
    await tokenIn.approve(await router.getAddress(), amountIn);

    // Encode path
    const path = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address[]"],
      [[await tokenIn.getAddress(), await tokenOut.getAddress()]]
    );

    // Execute (owner is both the caller and the recipient of the swap/funds)
    await router.executeArbitrage({
      router: await mockV2Router.getAddress(),
      routerType: 0, // V2
      tokenIn: await tokenIn.getAddress(),
      tokenOut: await tokenOut.getAddress(),
      amountIn: amountIn,
      minAmountOut: minAmountOut,
      path: path,
      recipient: owner.address,
    });

    // Check balances
    const ownerTokenOutBalance = await tokenOut.balanceOf(owner.address);
    expect(ownerTokenOutBalance).to.be.greaterThanOrEqual(minAmountOut);
  });

  it("should revert Uniswap V2 arbitrage if slippage/price is too high", async function () {
    const amountIn = ethers.parseEther("100");
    const minAmountOut = ethers.parseEther("110"); // We expect 10% more but rate is 1:1

    await tokenIn.approve(await router.getAddress(), amountIn);

    const path = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address[]"],
      [[await tokenIn.getAddress(), await tokenOut.getAddress()]]
    );

    await expect(
      router.executeArbitrage({
        router: await mockV2Router.getAddress(),
        routerType: 0,
        tokenIn: await tokenIn.getAddress(),
        tokenOut: await tokenOut.getAddress(),
        amountIn: amountIn,
        minAmountOut: minAmountOut,
        path: path,
        recipient: owner.address,
      })
    ).to.be.revertedWithCustomError(router, "InsufficientOutput");
  });

  it("should successfully execute Uniswap V3 arbitrage", async function () {
    const amountIn = ethers.parseEther("100");
    const minAmountOut = ethers.parseEther("100");

    await tokenIn.approve(await router.getAddress(), amountIn);

    const path = "0x"; // Simple placeholder bytes

    await router.executeArbitrage({
      router: await mockV3Router.getAddress(),
      routerType: 1, // V3
      tokenIn: await tokenIn.getAddress(),
      tokenOut: await tokenOut.getAddress(),
      amountIn: amountIn,
      minAmountOut: minAmountOut,
      path: path,
      recipient: owner.address,
    });

    const ownerTokenOutBalance = await tokenOut.balanceOf(owner.address);
    expect(ownerTokenOutBalance).to.be.greaterThanOrEqual(minAmountOut);
  });

  it("should successfully execute generic arbitrage call", async function () {
    const amountIn = ethers.parseEther("100");
    const minAmountOut = ethers.parseEther("100");

    await tokenIn.approve(await router.getAddress(), amountIn);

    // Encode call to MockGenericTarget.swapGeneric(amountIn)
    const mockGenericInterface = new ethers.Interface([
      "function swapGeneric(uint256 amountIn)"
    ]);
    const payload = mockGenericInterface.encodeFunctionData("swapGeneric", [amountIn]);

    await router.executeArbitrage({
      router: await mockGenericTarget.getAddress(),
      routerType: 2, // Generic
      tokenIn: await tokenIn.getAddress(),
      tokenOut: await tokenOut.getAddress(),
      amountIn: amountIn,
      minAmountOut: minAmountOut,
      path: payload,
      recipient: owner.address,
    });

    const ownerTokenOutBalance = await tokenOut.balanceOf(owner.address);
    expect(ownerTokenOutBalance).to.be.greaterThanOrEqual(minAmountOut);
  });

  it("should restrict execution to the owner", async function () {
    const amountIn = ethers.parseEther("100");
    const path = "0x";

    await expect(
      router.connect(other).executeArbitrage({
        router: await mockV2Router.getAddress(),
        routerType: 0,
        tokenIn: await tokenIn.getAddress(),
        tokenOut: await tokenOut.getAddress(),
        amountIn: amountIn,
        minAmountOut: amountIn,
        path: path,
        recipient: owner.address,
      })
    ).to.be.revertedWithCustomError(router, "OwnableUnauthorizedAccount");
  });
});
