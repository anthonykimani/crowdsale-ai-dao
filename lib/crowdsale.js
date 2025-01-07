const { ethers } = require('ethers');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const { Squid } =require("@0xsquid/sdk");


  // instantiate the SDK
  const squid = new Squid({
     baseUrl: "https://apiplus.squidrouter.com", // for mainnet use "https://api.0xsquid.com"
    integratorId: "dao-ai-a0c6bb2c-ab39-4c59-aa71-a7b52550206f"
  });
   





// Load environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const DAO_WALLET = process.env.DAO_WALLET.toLowerCase();
const AI_CONTRACT_ADDRESS = '0x0D9B3D8c05a997B8F6a4e559D8f06E2d0C4bb9c4';
const FIL_RPC = process.env.FIL_NETWORK_RPC;
const ETH_RPC = "https://eth-sepolia.g.alchemy.com/v2/AvrIkafWEUKzbxPxkPQJh55e99WFgqO-";
const BASE_RPC = "https://base-mainnet.g.alchemy.com/v2/AvrIkafWEUKzbxPxkPQJh55e99WFgqO-";
const TOKEN_PRICE = parseFloat(process.env.TOKEN_PRICE); // $0.01 = 1 token

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const USDC_ETH = process.env.USDC_ADDRESS_ETH.toLowerCase();
const USDT_ETH = process.env.USDT_ADDRESS_ETH.toLowerCase();
const USDC_BASE = process.env.USDC_ADDRESS_BASE.toLowerCase();
const USDT_BASE = process.env.USDT_ADDRESS_BASE.toLowerCase();

const supportedTokens = [USDC_ETH, USDT_ETH, USDC_BASE, USDT_BASE];

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Set up providers
const ethProvider = new ethers.JsonRpcProvider(ETH_RPC);
const baseProvider = new ethers.JsonRpcProvider(BASE_RPC);
const filProvider = new ethers.JsonRpcProvider(FIL_RPC);

// Initialize Filecoin wallet and contract
const filWallet = new ethers.Wallet(PRIVATE_KEY, filProvider);
const aiTokenAbi = [
  {
    name: 'updateAmountOwed',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_buyer', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
  },
];
const erc20Abi = [
  "event Transfer(address indexed from, address indexed to, uint amount)"
];
const aiTokenContract = new ethers.Contract(AI_CONTRACT_ADDRESS, aiTokenAbi, filWallet);

async function monitorTransfers(provider, network, tokenAddresses) {
  console.log(`Monitoring transfers on ${network}...`);

  tokenAddresses.forEach(async (tokenAddress) => {
    const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);

    contract.on('Transfer', async (from, to, amount, event) => {
      try {
        if (to.toLowerCase() !== DAO_WALLET) return;

        const decimals = 6; // USDC/USDT decimals
        const usdValue = parseFloat(ethers.formatUnits(amount, decimals));
        const tokensOwed = ethers.parseUnits((usdValue / TOKEN_PRICE).toFixed(18), 18);
        console.log(`Detected transfer on ${network}: Buyer: ${from}, Amount: $${usdValue}, Tokens Owed: ${tokensOwed}`);

        // Save to database
        await saveTransactionToDB({
          buyer: from,
          usdValue,
          tokensOwed: tokensOwed.toString(),
          network,
          txHash: event.log.transactionHash,
        });

        // Call `updateAmountOwed` on Filecoin
        await updateAmountOwed(from, tokensOwed);
         //Send Liquidity to filecoin
        await sendLiquidityToFilecoin({
            fromChain: 8453, //Network Chain
            fromToken: tokenAddress, // WETH on Goerli
            fromAmount: usdValue, // 0.05 WETH
            toChain: 314, // Avalanche Fuji Testnet
            toToken: "0x60E1773636CF5E4A227d9AC24F20fEca034ee25A", // aUSDC on Avalanche Fuji Testnet
            fromAddress: filWallet.address, // transaction sender address
            toAddress: filWallet.address, // the recipient of the trade
            slippage: 3.00, // 3.00 = 3% max slippage across the entire route, acceptable value range is 1-99
            enableForecall: true, // instant execution service, defaults to true
            quoteOnly: false // optional, defaults to false
        })
      } catch (error) {
        console.error(`Error processing transfer event on ${network}:`, error);
      }
    
    
    });
  });
}

// Save transaction to Supabase
async function saveTransactionToDB(transaction) {
  const { data, error } = await supabase
    .from('transactions')
    .insert([transaction]);

  if (error) {
    console.error('Error saving transaction to DB:', error);
  } else {
    console.log('Transaction saved to DB:', data);
  }
}

// Call `updateAmountOwed` on Filecoin contract
async function updateAmountOwed(buyer, tokensOwed) {
  try {
    console.log(`Allocating ${tokensOwed.toString()} tokens to ${buyer}`);
    const tx = await aiTokenContract.updateAmountOwed(buyer, tokensOwed);
    console.log(`Tokens allocated. Transaction hash: ${tx.hash}`);
  } catch (error) {
    console.error('Error updating amount owed:', error);
  }
}

async function sendLiquidityToFilecoin(params) {
const route = await squid.getRoute(params)
console.log("Route: ", route);
}

// Start monitoring
async function startMonitoring() {
await squid.init()
  console.log('Starting transfer monitoring...');
  await monitorTransfers(ethProvider, 'ethereum', [USDC_ETH, USDT_ETH]);
  await monitorTransfers(baseProvider, 'base', [USDC_BASE, USDT_BASE]);
}

startMonitoring().catch((error) => {
  console.error('Error starting monitoring:', error);
  process.exit(1);
});
