"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Info } from "lucide-react";
import Image from "next/image";
import {
  useAccount,
  useBalance,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { formatEther, parseUnits } from "viem";
import { toast } from "sonner";
import ERC20 from "@openzeppelin/contracts/build/contracts/ERC20.json"


// USDT and USDC contract addresses on Ethereum mainnet
const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

// ABI for ERC20 transfer function
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
] as const;

export function Web3Form() {
  const [amount, setAmount] = useState("");
  const [price] = useState("$0.003500");
  const [totalCost, setTotalCost] = useState("$0.000000");
  const [selectedToken, setSelectedToken] = useState<"USDT" | "USDC" | null>(
    null
  );

  const { address, isConnected } = useAccount();

  // Get token balances
  const { data: usdtBalance } = useReadContract({
    abi: ERC20.abi,
    address: USDT_ADDRESS,
    functionName: 'balanceOf',
    args: [address],
  }) as { data: bigint }

  console.log("usdtbalance", usdtBalance);

  const { data: usdcBalance } = useReadContract({
    abi: ERC20.abi,
    address: USDC_ADDRESS,
    functionName: 'balanceOf',
    args: [address],
  }) as { data: bigint }


  // Contract write hook
  const { writeContractAsync, data: txHash } = useWriteContract();

  // Transaction receipt hook
  const { isLoading: isTransactionLoading, isSuccess: isTransactionSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount(value);
    const total = parseFloat(value) * 0.0035;
    setTotalCost(`$${total.toFixed(6)}`);
  };

  const handleSendToken = async (token: "USDC" | "USDT") => {
    try {
      setSelectedToken(token);
      const recipientAddress = "0x8cb1174ed0bDFF74cd99CcBD690eEaa7288993cB"; // Replace with actual recipient address
      const amountToSend = parseFloat(totalCost.replace("$", ""));
      console.log("Sending", amountToSend, token, "to", recipientAddress);
      if (isNaN(amountToSend) || amountToSend <= 0) {
        toast.error("Please enter a valid amount");
        return;
      }
      console.log("Checking balance for", token);
      
      // Check balance
      const balance = token === "USDT" ? usdtBalance : usdcBalance;
      console.log("Balance check passed", balance);
      if (!formatEther(balance || BigInt(0)) || formatEther(balance || BigInt(0)) < amountToSend.toString()) {
        toast.error(`Insufficient ${token} balance`);
        return;
      }

      console.log("Balance check passed");
      // Convert amount to token decimals
      const decimals = token === "USDT" ? 6 : 6; // USDT and USDC both use 6 decimals
      const amountInWei = parseUnits(amountToSend.toString(), decimals);

      // Send transaction
      console.log(
        "SendingWei",
        amountInWei,
        token,
        "toAddress",
        recipientAddress
      );

      await writeContractAsync({
        address: token === "USDT" ? USDT_ADDRESS : USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [recipientAddress, amountInWei],
      });
    } catch (error) {
      toast.error("Transaction failed. Please try again.");
      console.error("Transaction error:", error);
    }
  };

  // Show success message
  if (isTransactionSuccess) {
    toast.success(`Successfully sent ${totalCost} ${selectedToken}!`);
  }

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

        {!isConnected ? (
          <appkit-account-button />
        ) : amount ? (
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

            <div className="space-y-4 pt-4 border-t border-gray-800">
              <p className="text-sm text-gray-400">
                This project{" "}
                <span className="font-semibold">does not accept</span> BTC, ETH,
                or TON as payment. Please send {totalCost} USDT or USDC to the
                following address:
              </p>
              <div className="flex justify-center">
                <div className="bg-white p-2 rounded-lg">
                  <Image
                    src="/placeholder.svg?height=200&width=200"
                    alt="Payment QR Code"
                    width={200}
                    height={200}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}