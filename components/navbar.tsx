'use client';

import CrowdsaleAIDao from "@/public/img/ai-dao.png";
import Image from "next/image";

export function Navbar() {
  return (
    <nav className="border-b border-[#222222]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <Image
                src={CrowdsaleAIDao}
                alt="Lido"
                width={92}
                height={32}
                className="h-8 w-auto"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* @ts-expect-error */}
            <appkit-button />
          </div>
        </div>
      </div>
    </nav>
  );
}
