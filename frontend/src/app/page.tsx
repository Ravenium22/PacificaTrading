"use client";

import { Navbar } from '@/components/navbar';
import { ApprovalCheck } from '@/components/approval-check';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';

function AutoRedirect({ to }: { to: string }) {
  const router = useRouter();
  const did = useRef(false);
  useEffect(() => {
    if (!did.current) {
      did.current = true;
      router.replace(to);
    }
  }, [router, to]);
  return (
    <div className="mt-6 text-slate-400 text-center">Redirecting…</div>
  );
}

export default function HomePage() {
  const { publicKey } = useWallet();

  return (
    <main className="min-h-screen bg-slate-950">
      <Navbar />

      <div className="container mx-auto px-4 py-24 flex flex-col items-center text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-100 mb-4">Start Copy Trading</h1>
        <p className="text-slate-400 max-w-2xl mb-8">
          Connect your wallet to continue. We&apos;ll check your approval status automatically.
        </p>

        <WalletMultiButton className="!px-6 !py-3 !text-base !bg-gradient-to-r !from-purple-500 !to-blue-500 hover:!from-purple-600 hover:!to-blue-600 !transition-all">
          Connect now
        </WalletMultiButton>

        {publicKey && (
          <div className="w-full max-w-2xl">
            <ApprovalCheck>
              {(approved) =>
                approved ? (
                  <AutoRedirect to="/copy-trading" />
                ) : (
                  <Alert className="mt-8 bg-slate-900/50 border-slate-800">
                    <AlertDescription className="text-slate-400">
                      You&apos;re almost there. Please use the popup to sign up via our referral link and request access.
                    </AlertDescription>
                  </Alert>
                )
              }
            </ApprovalCheck>
          </div>
        )}
      </div>
    </main>
  );
}
