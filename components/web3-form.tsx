"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Info } from "lucide-react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { toast } from "sonner";

// Validate contract addresses
const USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_ADDRESS_ETH as `0x${string}`;
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS_ETH as `0x${string}`;

if (!USDT_ADDRESS || !USDC_ADDRESS) {
  console.error("Contract addresses not properly configured");
}

const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    constant: false,
    inputs: [
      {
        name: "_spender",
        type: "address",
      },
      {
        name: "_value",
        type: "uint256",
      },
    ],
    name: "approve",
    outputs: [
      {
        name: "",
        type: "bool",
      },
    ],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export function Web3Form() {
  const [amount, setAmount] = useState("");
  const [price] = useState("$0.003500");
  const [totalCost, setTotalCost] = useState("$0.000000");
  const [selectedToken, setSelectedToken] = useState<"USDT" | "USDC" | null>(null);
  const { address: _address, isConnected } = useAccount();
  
  // Initialize all hooks first
  const { writeContractAsync, data: txHash, error: writeError } = useWriteContract();
  
  const { 
    isLoading: isTransactionLoading, 
    isSuccess: isTransactionSuccess,
    isError: isTransactionError
  } = useWaitForTransactionReceipt({ 
    hash: txHash
  });

  // Get token balances with error handling
  const { data: usdtBalance, isError: usdtError } = useReadContract({
    abi: ERC20_ABI,
    address: USDT_ADDRESS,
    functionName: "balanceOf",
    args: [_address as `0x${string}`]
  }) as { data: bigint; isError: boolean };

  const { data: usdcBalance, isError: usdcError } = useReadContract({
    abi: ERC20_ABI,
    address: USDC_ADDRESS,
    functionName: "balanceOf",
    args: [_address as `0x${string}`]
  }) as { data: bigint; isError: boolean };

  // Show welcome toast on initial connection
  useEffect(() => {
    if (isConnected && _address) {
      toast.success("Wallet connected successfully!", {
        description: `Connected address: ${_address.slice(0, 6)}...${_address.slice(-4)}`,
      });
    }
  }, [isConnected, _address]);

  // Show error if balance fetch fails
  useEffect(() => {
    if (usdtError || usdcError) {
      toast.error("Failed to fetch token balances", {
        description: "Please check your network connection and try again.",
      });
    }
  }, [usdtError, usdcError]);

  // Handle transaction states
  useEffect(() => {
    if (writeError) {
      if (writeError.message.includes("rejected")) {
        toast.error("Transaction rejected", {
          description: "You declined the transaction in your wallet.",
        });
      } else {
        toast.error("Transaction failed", {
          description: writeError.message,
        });
      }
    }
  }, [writeError]);

  useEffect(() => {
    if (isTransactionError) {
      toast.error("Transaction failed", {
        description: "The transaction failed to execute. Please try again.",
      });
    }
  }, [isTransactionError]);

  useEffect(() => {
    if (isTransactionSuccess && selectedToken) {
      toast.success("Transaction successful!", {
        description: `Successfully sent ${totalCost} ${selectedToken}. Transaction hash: ${txHash?.slice(0, 6)}...${txHash?.slice(-4)}`,
      });
    }
  }, [isTransactionSuccess, selectedToken, totalCost, txHash]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || isNaN(parseFloat(value))) {
      setAmount("");
      setTotalCost("$0.000000");
      return;
    }
    setAmount(value);
    const total = parseFloat(value) * 0.0035;
    setTotalCost(`$${total.toFixed(6)}`);
  };

  const handleSendToken = async (token: "USDC" | "USDT") => {
    try {
      if (!_address) {
        toast.error("Wallet not connected", {
          description: "Please connect your wallet to continue.",
        });
        return;
      }

      // Validate contract addresses
      if (!USDT_ADDRESS || !USDC_ADDRESS) {
        toast.error("Configuration error", {
          description: "Contract addresses are not properly configured.",
        });
        return;
      }

      setSelectedToken(token);
      const recipientAddress = "0x8cb1174ed0bDFF74cd99CcBD690eEaa7288993cB";
      
      // Validate recipient address
      if (!recipientAddress || !recipientAddress.startsWith('0x')) {
        toast.error("Invalid recipient", {
          description: "The recipient address is not valid.",
        });
        return;
      }

      const amountToSend = parseFloat(totalCost.replace("$", ""));
      if (isNaN(amountToSend) || amountToSend <= 0) {
        toast.error("Invalid amount", {
          description: "Please enter a valid amount greater than 0.",
        });
        return;
      }

      // Balance validation
      const balance = token === "USDT" ? usdtBalance : usdcBalance;
      if (!balance) {
        toast.error("Balance error", {
          description: `Failed to fetch ${token} balance. Please try again.`,
        });
        return;
      }

      const currentBalanceString = formatUnits(balance, 6);
      const currentBalance = parseFloat(currentBalanceString);

      if (!currentBalance || Number.isNaN(currentBalance)) {
        toast.error("Balance error", {
          description: `Invalid ${token} balance format.`,
        });
        return;
      }

      if (currentBalance < amountToSend) {
        toast.error("Insufficient balance", {
          description: `You don't have enough ${token} to complete this transaction.`,
        });
        return;
      }

      // Convert amount to token decimals with validation
      const decimals = 6;
      let amountInWei: bigint;
      try {
        amountInWei = parseUnits(amountToSend.toString(), decimals);
      } catch (error) {
        toast.error("Conversion error", {
          description: "Failed to convert the amount to the correct format.",
        });
        return;
      }

      // Show pending toast
      toast.promise(
        writeContractAsync({
          address: token === "USDT" ? USDT_ADDRESS : USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [recipientAddress, amountInWei],
        }),
        {
          loading: "Transaction in progress...",
          success: "Transaction submitted successfully!",
          error: "Failed to submit transaction",
        }
      );
      
    } catch (error) {
      console.error("Transaction error:", error);
      toast.error("Transaction failed", {
        description: error instanceof Error ? error.message : "An unexpected error occurred. Please try again.",
      });
    }
  };

  const content = !isConnected ? (
    <CardContent>
      <p className="text-sm text-gray-400 mb-4">
        Please connect your wallet to continue.
      </p>
      {/* @ts-expect-error */}
      <appkit-account-button />
    </CardContent>
  ) : (
    <CardContent className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="amount" className="text-gray-300">
          Amount $DAOAI
        </Label>
        <Input
          id="amount"
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={handleAmountChange}
          className="bg-black/40 border-green-900/20 text-gray-100"
          min="0"
          step="0.000001"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-gray-300">Current $DAOAI price</Label>
        <Input
          value={price}
          readOnly
          className="bg-black/40 border-green-900/20 text-gray-100"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-gray-300">Total Cost</Label>
        <Input
          value={totalCost}
          readOnly
          className="bg-black/40 border-green-900/20 text-gray-100"
        />
      </div>

      {amount ? (
        <>
          <div className="bg-gray-900/50 rounded-lg p-4 text-sm text-gray-300 flex gap-2">
            <Info className="h-5 w-5 flex-shrink-0 text-blue-400" />
            <p>
              The amount of tokens, cost, and price displayed are estimates
              and may vary if another unconfirmed transaction is confirmed
              prior to the one you are about to send. Final values for the
              token amount and cost will be determined at the time your funds
              transfer is confirmed on-chain.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => handleSendToken("USDC")}
              disabled={isTransactionLoading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
            >
              {isTransactionLoading ? "Sending..." : `Send ${totalCost} USDC`}
            </Button>
            <Button
              onClick={() => handleSendToken("USDT")}
              disabled={isTransactionLoading}
              className="w-full bg-green-500 hover:bg-green-600 text-white disabled:opacity-50"
            >
              {isTransactionLoading ? "Sending..." : `Send ${totalCost} USDT`}
            </Button>
          </div>

          {isTransactionLoading && (
            <p className="text-sm text-center text-gray-400">
              Transaction in progress... Please wait for confirmation.
            </p>
          )}
        </>
      ) : null}
    </CardContent>
  );

  return (
    <Card className="w-full max-w-md border-green-900/20 bg-black/40 backdrop-blur-sm glow-border">
      <CardHeader>
        <CardTitle className="text-2xl font-bold tracking-tight glow text-green-400">
          $DAOAI
        </CardTitle>
        <p className="text-sm text-gray-400">
          An all-in-one platform bridging traditional finance with Web3.
        </p>
      </CardHeader>
      {content}
    </Card>
  );
}