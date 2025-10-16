'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';

export function Navbar() {
  const { publicKey } = useWallet();

  return (
    <nav className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500" />
            <span className="text-xl font-bold text-slate-100">
              Pacifica Copy Trading
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/leaderboard"
              className="text-slate-300 hover:text-slate-100 transition-colors"
            >
              Leaderboard
            </Link>
            {publicKey && (
              <>
                <Link
                  href="/copy-trading"
                  className="text-slate-300 hover:text-slate-100 transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/strategies"
                  className="text-slate-300 hover:text-slate-100 transition-colors flex items-center gap-1"
                >
                  <span>Strategies</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    New
                  </span>
                </Link>
              </>
            )}
            <WalletMultiButton className="!bg-gradient-to-r !from-purple-500 !to-blue-500 hover:!from-purple-600 hover:!to-blue-600 !transition-all" />
          </div>
        </div>
      </div>
    </nav>
  );
}
