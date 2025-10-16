'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { Navbar } from '@/components/navbar';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp, Loader2, RefreshCw, Search, Copy } from 'lucide-react';
import Link from 'next/link';

type LeaderboardEntry = {
  address: string;
  username: string | null;
  pnl_1d: string;
  pnl_7d: string;
  pnl_30d: string;
  pnl_all_time: string;
  equity_current: string;
  oi_current: string;
  volume_1d: string;
  volume_7d: string;
  volume_30d: string;
  volume_all_time: string;
};

type SortKey = keyof LeaderboardEntry;
type SortDir = 'asc' | 'desc';

const ENDPOINT = 'https://api.pacifica.fi/api/v1/leaderboard';

function num(v: string | number | null | undefined) {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n as number) ? (n as number) : 0;
}

function formatNumber(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<'4000' | '10000'>('4000');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState<'20' | '50'>('20');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sortKey, setSortKey] = useState<SortKey>('pnl_30d');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${ENDPOINT}?limit=${limit}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load leaderboard (${res.status})`);
      const json: { success: boolean; data: LeaderboardEntry[] } = await res.json();
      if (!json?.success || !Array.isArray(json?.data)) throw new Error('Unexpected response');
      // Cap to 10k just in case
      const list: LeaderboardEntry[] = json.data.slice(0, 10000);
      setData(list);
      setPage(1);
      setExpanded({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((d) =>
      d.address.toLowerCase().includes(q) || (d.username?.toLowerCase() || '').includes(q)
    );
  }, [data, search]);

  const sorted = useMemo(() => {
    const s = [...filtered];
    s.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      // For username/address, sort lexicographically; others numeric
      if (sortKey === 'address' || sortKey === 'username') {
        const aa = (va || '').toString().toLowerCase();
        const bb = (vb || '').toString().toLowerCase();
        return sortDir === 'asc' ? aa.localeCompare(bb) : bb.localeCompare(aa);
      } else {
        // Numeric columns in API are strings; safe to parse
        const na = num(va as string | number | null | undefined);
        const nb = num(vb as string | number | null | undefined);
        return sortDir === 'asc' ? na - nb : nb - na;
      }
    });
    return s;
  }, [filtered, sortKey, sortDir]);

  const total = sorted.length;
  const size = parseInt(pageSize, 10);
  const totalPages = Math.max(1, Math.ceil(total / size));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const pageData = useMemo(() => {
    const start = (pageSafe - 1) * size;
    return sorted.slice(start, start + size);
  }, [sorted, pageSafe, size]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function toggleExpand(addr: string) {
    setExpanded((prev) => ({ ...prev, [addr]: !prev[addr] }));
  }

  async function copy(addr: string) {
    try {
      await navigator.clipboard.writeText(addr);
    } catch {}
  }

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="inline-flex items-center">
      {sortKey === col ? (
        sortDir === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />
      ) : (
        <span className="w-4 h-4 ml-1 opacity-30"> </span>
      )}
    </span>
  );

  return (
    <main className="min-h-screen bg-slate-950">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-slate-100">Leaderboard</h1>
          <p className="text-slate-400 mt-1">Browse top traders and copy their address easily.</p>
        </div>

        <Card className="bg-slate-900/50 backdrop-blur border-slate-800 p-4 rounded-xl mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search by address or username"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-8 bg-slate-950 border-slate-800 text-slate-100 w-72"
              />
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-slate-400">Show</span>
              <Select
                value={pageSize}
                onValueChange={(v: '20' | '50') => {
                  setPageSize(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="20">20 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                </SelectContent>
              </Select>

              <span className="text-xs text-slate-400 ml-2">Max</span>
              <Select
                value={limit}
                onValueChange={(v: '4000' | '10000') => setLimit(v)}
              >
                <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="4000">4,000</SelectItem>
                  <SelectItem value="10000">10,000</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={fetchData}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Refreshing
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" /> Refresh
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="bg-slate-900/50 backdrop-blur border-slate-800 rounded-xl">
          <div className="p-2 overflow-x-auto">
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead onClick={() => toggleSort('address')} className="cursor-pointer select-none">
                    Address <SortIcon col="address" />
                  </TableHead>
                  <TableHead onClick={() => toggleSort('username')} className="cursor-pointer select-none">
                    Username <SortIcon col="username" />
                  </TableHead>
                  <TableHead onClick={() => toggleSort('pnl_1d')} className="cursor-pointer select-none">
                    PnL 1d <SortIcon col="pnl_1d" />
                  </TableHead>
                  <TableHead onClick={() => toggleSort('pnl_7d')} className="cursor-pointer select-none">
                    PnL 7d <SortIcon col="pnl_7d" />
                  </TableHead>
                  <TableHead onClick={() => toggleSort('pnl_30d')} className="cursor-pointer select-none">
                    PnL 30d <SortIcon col="pnl_30d" />
                  </TableHead>
                  <TableHead onClick={() => toggleSort('pnl_all_time')} className="cursor-pointer select-none">
                    PnL All <SortIcon col="pnl_all_time" />
                  </TableHead>
                  <TableHead onClick={() => toggleSort('equity_current')} className="cursor-pointer select-none">
                    Equity <SortIcon col="equity_current" />
                  </TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                      <div className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading leaderboard...
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && error && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-red-400">
                      {error}
                    </TableCell>
                  </TableRow>
                )}
                {!loading && !error && pageData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                      No results.
                    </TableCell>
                  </TableRow>
                )}

                {!loading && !error &&
                  pageData.map((row, idx) => {
                    const rank = (pageSafe - 1) * size + idx + 1;
                    const isOpen = !!expanded[row.address];
                    return (
                      <Fragment key={row.address}>
                        <TableRow className="hover:bg-slate-800/40">
                          <TableCell className="text-slate-400">{rank}</TableCell>
                          <TableCell className="font-mono text-slate-100">
                            <div className="flex items-center gap-2">
                              <span className="break-all">{row.address}</span>
                              <Button
                                size="icon-sm"
                                variant="outline"
                                aria-label="Copy address"
                                className="border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800"
                                onClick={() => copy(row.address)}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Link
                                href={{ pathname: '/copy-trading', query: { tab: 'configure', master: row.address } }}
                                className="ml-2"
                              >
                                <Button
                                  variant="outline"
                                  className="border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800"
                                >
                                  Copy this trader
                                </Button>
                              </Link>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-300">{row.username ?? '—'}</TableCell>
                          <TableCell className={num(row.pnl_1d) >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {formatNumber(num(row.pnl_1d))}
                          </TableCell>
                          <TableCell className={num(row.pnl_7d) >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {formatNumber(num(row.pnl_7d))}
                          </TableCell>
                          <TableCell className={num(row.pnl_30d) >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {formatNumber(num(row.pnl_30d))}
                          </TableCell>
                          <TableCell className={num(row.pnl_all_time) >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {formatNumber(num(row.pnl_all_time))}
                          </TableCell>
                          <TableCell className="text-slate-200">{formatNumber(num(row.equity_current))}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              className="border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800"
                              onClick={() => toggleExpand(row.address)}
                            >
                              {isOpen ? 'Hide' : 'Details'}
                            </Button>
                          </TableCell>
                        </TableRow>

                        {isOpen && (
                          <TableRow className="bg-slate-950/60">
                            <TableCell colSpan={9}>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 text-sm">
                                <div>
                                  <div className="text-slate-400">Open Interest</div>
                                  <div className="text-slate-200">{formatNumber(num(row.oi_current))}</div>
                                </div>
                                <div>
                                  <div className="text-slate-400">Vol 1d</div>
                                  <div className="text-slate-200">{formatNumber(num(row.volume_1d))}</div>
                                </div>
                                <div>
                                  <div className="text-slate-400">Vol 7d</div>
                                  <div className="text-slate-200">{formatNumber(num(row.volume_7d))}</div>
                                </div>
                                <div>
                                  <div className="text-slate-400">Vol 30d</div>
                                  <div className="text-slate-200">{formatNumber(num(row.volume_30d))}</div>
                                </div>
                                <div>
                                  <div className="text-slate-400">Vol All</div>
                                  <div className="text-slate-200">{formatNumber(num(row.volume_all_time))}</div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 text-slate-300">
            <div className="text-sm">
              Showing{' '}
              <span className="text-slate-100">
                {Math.min((pageSafe - 1) * size + 1, total)}-{Math.min(pageSafe * size, total)}
              </span>{' '}
              of <span className="text-slate-100">{formatNumber(total)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pageSafe <= 1}
                className="border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800"
              >
                Prev
              </Button>
              <span className="text-sm text-slate-400">
                Page <span className="text-slate-100">{pageSafe}</span> / {formatNumber(totalPages)}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={pageSafe >= totalPages}
                className="border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800"
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
