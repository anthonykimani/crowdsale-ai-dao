const { ethers } = require('ethers');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();


// Load environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const DAO_WALLET = process.env.DAO_WALLET.toLowerCase();
const AI_CONTRACT_ADDRESS = '0xc00E7716ceeCE9A2b76a845c3b587c373a4856f9';
const FIL_RPC = process.env.FIL_NETWORK_RPC;
const ETH_RPC = "wss://eth-sepolia.g.alchemy.com/v2/AvrIkafWEUKzbxPxkPQJh55e99WFgqO-";
const BASE_RPC = "wss://base-mainnet.g.alchemy.com/v2/AvrIkafWEUKzbxPxkPQJh55e99WFgqO-";
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
const ethProvider = new ethers.WebSocketProvider(ETH_RPC);
const baseProvider = new ethers.WebSocketProvider(BASE_RPC);
const filProvider = new ethers.JsonRpcProvider(FIL_RPC);

// Initialize Filecoin wallet and contract
const filWallet = new ethers.Wallet(PRIVATE_KEY, filProvider);
const aiTokenAbi = [
    {
        "inputs": [
          {
            "internalType": "address",
            "name": "_address",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "_amount",
            "type": "uint256"
          }
        ],
        "name": "updateAllocation",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
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
    console.log('Transaction Successfully saved to DB!');
  }
}

// Call `updateAmountOwed` on Filecoin contract
async function updateAmountOwed(buyer, tokensOwed) {
  try {
    console.log(`Allocating ${tokensOwed.toString()} tokens to ${buyer}`);
    const tx = await aiTokenContract.updateAllocation(buyer, tokensOwed);
    console.log(`Tokens allocated. Transaction hash: ${tx.hash}`);
  } catch (error) {
    console.error('Error updating amount owed:', error);
  }
}

// Start monitoring
async function startMonitoring() {
  console.log('Starting transfer monitoring...');
  await monitorTransfers(ethProvider, 'ethereum', [USDC_ETH, USDT_ETH]);
  await monitorTransfers(baseProvider, 'base', [USDC_BASE, USDT_BASE]);
}

startMonitoring().catch((error) => {
  console.error('Error starting monitoring:', error);
  process.exit(1);
});
