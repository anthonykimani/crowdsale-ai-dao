import { Navbar } from "@/components/navbar"
import { Web3Form } from "@/components/web3-form"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-black via-green-950/20 to-black">
      <div className="container mx-auto px-4 py-16">
      <Navbar />
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4 glow">
            Crowdsale AI DAO
          </h1>
          <p className="text-lg text-muted-foreground">
            Experience the future of decentralized finance
          </p>
        </div>
        <div className="flex justify-center">
          <Web3Form />
        </div>
      </div>
    </main>
  )
}

