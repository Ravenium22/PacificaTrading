'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { checkApproval, requestApproval } from '@/lib/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ApprovalCheckProps {
  children: (approved: boolean) => ReactNode;
}

export function ApprovalCheck({ children }: ApprovalCheckProps) {
  const { publicKey } = useWallet();
  const [approved, setApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setLoading(false);
      return;
    }

    const checkStatus = async () => {
      try {
        const status = await checkApproval(publicKey.toBase58());
        setApproved(status.approved);
        setShowDialog(!status.approved);
      } catch (err) {
        console.error('Failed to check approval status:', err);
        setApproved(false);
        setShowDialog(true);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, [publicKey]);

  const handleRequestAccess = async () => {
    if (!publicKey) return;

    setRequesting(true);
    setError(null);

    try {
      await requestApproval(publicKey.toBase58());
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request access');
    } finally {
      setRequesting(false);
    }
  };

  // Build referral link flexibly:
  // - If NEXT_PUBLIC_PACIFICA_URL already contains ?ref= or ?referral=, use it as-is
  // - Else if NEXT_PUBLIC_REFERRAL_CODE exists, append using NEXT_PUBLIC_REFERRAL_PARAM (default: 'referral')
  // - Else, use NEXT_PUBLIC_PACIFICA_URL as-is
  const pacificaUrl = process.env.NEXT_PUBLIC_PACIFICA_URL;
  const referralCode = process.env.NEXT_PUBLIC_REFERRAL_CODE;
  const referralParam = process.env.NEXT_PUBLIC_REFERRAL_PARAM || 'referral';
  const referralUrl = (() => {
    if (!pacificaUrl) return null;
    const hasReferralAlready = /[?&](ref|referral)=/i.test(pacificaUrl);
    if (hasReferralAlready) return pacificaUrl;
    if (referralCode) {
      const joiner = pacificaUrl.includes('?') ? '&' : '?';
      return `${pacificaUrl}${joiner}${referralParam}=${encodeURIComponent(referralCode)}`;
    }
    return pacificaUrl;
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <>
      {children(approved)}

      <Dialog open={showDialog && !approved} onOpenChange={setShowDialog}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle>Get Approved in 2 Steps</DialogTitle>
            <DialogDescription className="text-slate-400">
              To use copy trading, you need to be approved and have a Pacifica account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-500 flex items-center justify-center text-sm font-semibold">
                  1
                </div>
                <h3 className="font-semibold">Sign up on Pacifica</h3>
              </div>
              <p className="text-sm text-slate-400 ml-8">
                Create your account using our referral link to ensure eligibility.
              </p>
              {referralUrl ? (
                <a
                  href={referralUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-8 inline-block"
                >
                  <Button variant="outline" className="border-slate-700 hover:border-slate-600">
                    Sign Up on Pacifica
                  </Button>
                </a>
              ) : (
                <div className="ml-8 text-xs text-slate-500">
                  Referral link not configured. Please set NEXT_PUBLIC_PACIFICA_URL (and optionally NEXT_PUBLIC_REFERRAL_CODE).
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-sm font-semibold">
                  2
                </div>
                <h3 className="font-semibold">Request Access</h3>
              </div>
              <p className="text-sm text-slate-400 ml-8">
                Once you have a Pacifica account, request access to copy trading.
              </p>
              <div className="ml-8">
                <Button
                  onClick={handleRequestAccess}
                  disabled={requesting || success}
                  className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                >
                  {requesting ? 'Requesting...' : success ? 'Request Sent!' : 'Request Access'}
                </Button>
              </div>
            </div>

            {success && (
              <Alert className="bg-green-500/10 border-green-500/50">
                <AlertDescription className="text-green-400">
                  Access request submitted! We&apos;ll review your application and approve you shortly.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert className="bg-red-500/10 border-red-500/50">
                <AlertDescription className="text-red-400">{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
