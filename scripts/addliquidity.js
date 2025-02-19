const { ethers } = require('hardhat');
const helpers = require('@nomicfoundation/hardhat-toolbox/network-helpers');
const { abi: IUniswapV3PoolABI } = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json');
const { abi: INonfungiblePositionManagerABI } = require('@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json');
const { abi: IUniswapV3FactoryABI } = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json');

const main = async () => {
  
  const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  const DAI_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
  const NONFUNGIBLE_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
  const FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
  const IMPERSONATED_ACCOUNT = '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621';


  const FEE_TIER = 500;

  await helpers.impersonateAccount(IMPERSONATED_ACCOUNT);
  const impersonatedSigner = await ethers.getSigner(IMPERSONATED_ACCOUNT);


  const usdcContract = await ethers.getContractAt('IERC20', USDC_ADDRESS);
  const daiContract = await ethers.getContractAt('IERC20', DAI_ADDRESS);
  const positionManager = new ethers.Contract(
    NONFUNGIBLE_POSITION_MANAGER,
    INonfungiblePositionManagerABI,
    impersonatedSigner
  );
  const factory = new ethers.Contract(
    FACTORY_ADDRESS,
    IUniswapV3FactoryABI,
    impersonatedSigner
  );

  // Check initial balances
  const usdcBalanceBefore = await usdcContract.balanceOf(
    impersonatedSigner.address
  );
  const daiBalanceBefore = await daiContract.balanceOf(
    impersonatedSigner.address
  );

  console.log(
    '💰 Impersonated account USDC balance (before):',
    ethers.formatUnits(usdcBalanceBefore, 6)
  );
  console.log(
    '💰 Impersonated account DAI balance (before):',
    ethers.formatUnits(daiBalanceBefore, 18)
  );


  const amount0Desired = ethers.parseUnits('100000', 6); // USDC
  const amount1Desired = ethers.parseUnits('100000', 18); // DAI


  await usdcContract
    .connect(impersonatedSigner)
    .approve(NONFUNGIBLE_POSITION_MANAGER, amount0Desired);
  await daiContract
    .connect(impersonatedSigner)
    .approve(NONFUNGIBLE_POSITION_MANAGER, amount1Desired);

  const poolAddress = await factory.getPool(
    USDC_ADDRESS,
    DAI_ADDRESS,
    FEE_TIER
  );

  console.log('Pool address:', poolAddress);


  const pool = new ethers.Contract(
    poolAddress,
    IUniswapV3PoolABI,
    impersonatedSigner
  );

  const { tick } = await pool.slot0();
  

  const tickSpacing = 10;
  const currentTick = Number(tick);
  const tickLower = Math.floor(currentTick - 2000);
  const tickUpper = Math.floor(currentTick + 2000);


  const normalizedTickLower = Math.floor(tickLower / tickSpacing) * tickSpacing;
  const normalizedTickUpper = Math.floor(tickUpper / tickSpacing) * tickSpacing;

  console.log('Current tick:', currentTick);
  console.log('Tick range:', { 
    tickLower: normalizedTickLower, 
    tickUpper: normalizedTickUpper 
  });

  console.log(
    '🔄 -------------------------- Adding V3 liquidity --------------------------'
  );


  const [token0, token1] = USDC_ADDRESS.toLowerCase() < DAI_ADDRESS.toLowerCase()
    ? [USDC_ADDRESS, DAI_ADDRESS]
    : [DAI_ADDRESS, USDC_ADDRESS];

  const [amount0, amount1] = USDC_ADDRESS.toLowerCase() < DAI_ADDRESS.toLowerCase()
    ? [amount0Desired, amount1Desired]
    : [amount1Desired, amount0Desired];


  const params = {
    token0,
    token1,
    fee: FEE_TIER,
    tickLower: normalizedTickLower,
    tickUpper: normalizedTickUpper,
    amount0Desired: amount0,
    amount1Desired: amount1,
    amount0Min: 0,
    amount1Min: 0,
    recipient: impersonatedSigner.address,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 600)
  };

  console.log('Minting with params:', {
    ...params,
    amount0Desired: params.amount0Desired.toString(),
    amount1Desired: params.amount1Desired.toString(),
    deadline: params.deadline.toString()
  });


  const tx = await positionManager.mint(params);
  const receipt = await tx.wait();

  console.log('Transaction hash:', receipt.hash);
  console.log(
    '✅ -------------------------- V3 Liquidity added --------------------------'
  );


  const usdcBalanceAfter = await usdcContract.balanceOf(
    impersonatedSigner.address
  );
  const daiBalanceAfter = await daiContract.balanceOf(
    impersonatedSigner.address
  );

  console.log(
    '💰 Impersonated account USDC balance (after):',
    ethers.formatUnits(usdcBalanceAfter, 6)
  );
  console.log(
    '💰 Impersonated account DAI balance (after):',
    ethers.formatUnits(daiBalanceAfter, 18)
  );
};

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exitCode = 1;
});