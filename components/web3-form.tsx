"use client";

import { useState } from "react";
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

//import {abi a} from "@openzeppelin/contracts/build/contracts/ERC20.json"

// USDT and USDC contract addresses on Ethereum mainnet
const USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_ADDRESS_ETH as `0x${string}`;
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS_ETH as `0x${string}`;

console.log(USDC_ADDRESS);

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
  const [selectedToken, setSelectedToken] = useState<"USDT" | "USDC" | null>(
    null
  );
  const { address: _address, isConnected } = useAccount();
  console.log("address: ", _address);

  if(_address === undefined ) return

  // Get token balances
  const { data: usdtBalance } = useReadContract({
    abi: ERC20_ABI,
    address: USDT_ADDRESS,
    functionName: "balanceOf",
    args: [_address as `0x${string}`],
  }) as { data: bigint };

  console.log("usdtbalance", typeof usdtBalance);

  const { data: usdcBalance } = useReadContract({
    abi: ERC20_ABI,
    address: USDC_ADDRESS,
    functionName: "balanceOf",
    args: [_address  as `0x${string}`],
  }) as { data: bigint };

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
      const currentBalanceString = formatUnits(balance, 6);
      const currentBalance = parseFloat(currentBalanceString);

      if (Number.isNaN(currentBalance) || currentBalance < amountToSend) {
        toast.error(`Insufficient ${token} balance`);
        return;
      }

      console.log("Balance check passed");
      // Convert amount to token decimals
      const decimals = token === "USDT" ? 6 : 6; // USDT and USDC both use 6 decimals
      const amountInWei = parseUnits(
        amountToSend.toString(),
        decimals
      );

      // Send transaction
      console.log(
        "SendingWei",
        amountInWei,
        token,
        "toAddress",
        recipientAddress
      );

      // await writeContractAsync({
      //   address: token === "USDT" ? USDT_ADDRESS : USDC_ADDRESS,
      //   abi: ERC20_ABI,
      //   functionName: "approve",
      //   args: [recipientAddress, amountInWei],
      // });

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
          <div>
            {/* @ts-expect-error */}
            <appkit-account-button />
          </div>
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
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
