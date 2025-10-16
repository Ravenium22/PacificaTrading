'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Navbar } from '@/components/navbar';
import { ApprovalCheck } from '@/components/approval-check';
import { CreateRelationshipForm } from '@/components/create-relationship-form';
import { RelationshipsList } from '@/components/relationships-list';
import { PositionsTable } from '@/components/positions-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSearchParams } from 'next/navigation';

function CopyTradingInner() {
  const { publicKey } = useWallet();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const searchParams = useSearchParams();
  const allowedTabs = ['overview', 'configure', 'activity'] as const;
  type Tab = typeof allowedTabs[number];
  const tabFromUrl = (searchParams?.get('tab') || 'overview').toLowerCase();
  const initialTab: Tab = (allowedTabs as readonly string[]).includes(tabFromUrl)
    ? (tabFromUrl as Tab)
    : 'overview';
  const [tab, setTab] = useState<Tab>(initialTab);
  useEffect(() => {
    const t = (searchParams?.get('tab') || '').toLowerCase();
    if ((allowedTabs as readonly string[]).includes(t)) {
      setTab(t as Tab);
    }
  }, [searchParams]);
  const initialMaster = useMemo(() => searchParams?.get('master') || undefined, [searchParams]);

  const handleRelationshipCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  if (!publicKey) {
    return (
      <main className="min-h-screen bg-slate-950">
        <Navbar />
        <div className="container mx-auto px-4 py-20">
          <Alert className="bg-slate-900/50 border-slate-800 max-w-2xl mx-auto">
            <AlertDescription className="text-slate-400 text-center">
              Please connect your wallet to access copy trading.
            </AlertDescription>
          </Alert>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-100 mb-2">Copy Trading Dashboard</h1>
          <p className="text-slate-400">
            Manage your copy trading relationships and monitor your positions.
          </p>
        </div>

  <Tabs value={tab} onValueChange={(v: string) => setTab(v as Tab)} className="space-y-6">
          <TabsList className="bg-slate-900/50 border border-slate-800">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-blue-500"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="configure"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-blue-500"
            >
              Configure
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-blue-500"
            >
              Activity
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <PositionsTable />

            <Card className="bg-slate-900/50 backdrop-blur border-slate-800 p-6 rounded-xl">
              <h3 className="text-xl font-semibold text-slate-100 mb-4">
                Active Relationships
              </h3>
              <RelationshipsList refreshTrigger={refreshTrigger} />
            </Card>
          </TabsContent>

          {/* Configure Tab */}
          <TabsContent value="configure" className="space-y-6">
            <ApprovalCheck>
              {(approved) => (
                <>
                  {approved ? (
                    <>
                      <CreateRelationshipForm onSuccess={handleRelationshipCreated} initialMasterWallet={initialMaster} />

                      <Card className="bg-slate-900/50 backdrop-blur border-slate-800 p-6 rounded-xl">
                        <h3 className="text-xl font-semibold text-slate-100 mb-4">
                          Your Relationships
                        </h3>
                        <RelationshipsList refreshTrigger={refreshTrigger} />
                      </Card>
                    </>
                  ) : (
                    <Card className="bg-slate-900/50 backdrop-blur border-slate-800 p-6 rounded-xl">
                      <Alert className="bg-slate-800/50 border-slate-700">
                        <AlertDescription className="text-slate-400">
                          You need to be approved to create copy relationships. Please follow the
                          approval process.
                        </AlertDescription>
                      </Alert>
                    </Card>
                  )}
                </>
              )}
            </ApprovalCheck>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <Card className="bg-slate-900/50 backdrop-blur border-slate-800 p-6 rounded-xl">
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-slate-100 mb-2">Coming Soon</h3>
                <p className="text-slate-400">
                  Trade history and activity logs will be available here.
                </p>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

export default function CopyTradingPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-950">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center text-slate-400">Loading…</div>
      </main>
    }>
      <CopyTradingInner />
    </Suspense>
  );
}
