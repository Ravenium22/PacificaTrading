'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { getRelationships, updateRelationship, deleteRelationship, CopyRelationship } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface RelationshipsListProps {
  refreshTrigger?: number;
}

export function RelationshipsList({ refreshTrigger }: RelationshipsListProps) {
  const { publicKey } = useWallet();
  const [relationships, setRelationships] = useState<CopyRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRelationships = async () => {
    if (!publicKey) return;

    try {
      setError(null);
      const data = await getRelationships(publicKey.toBase58());
      setRelationships(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch relationships');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRelationships();
  }, [publicKey, refreshTrigger]);

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await updateRelationship(id, { active: !currentActive });
      await fetchRelationships();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update relationship');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    setDeleting(true);
    try {
      await deleteRelationship(deleteId);
      await fetchRelationships();
      setDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete relationship');
    } finally {
      setDeleting(false);
    }
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="text-center text-slate-400 py-8">
        Loading relationships...
      </div>
    );
  }

  if (!publicKey) {
    return (
      <Alert className="bg-slate-900/50 border-slate-800">
        <AlertDescription className="text-slate-400">
          Please connect your wallet to view relationships.
        </AlertDescription>
      </Alert>
    );
  }

  if (relationships.length === 0) {
    return (
      <Alert className="bg-slate-900/50 border-slate-800">
        <AlertDescription className="text-slate-400">
          No copy relationships yet. Create one above to get started!
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert className="bg-red-500/10 border-red-500/50">
          <AlertDescription className="text-red-400">{error}</AlertDescription>
        </Alert>
      )}

      {relationships.map((rel) => (
        <Card key={rel.id} className="bg-slate-900/50 backdrop-blur border-slate-800 p-6 rounded-xl">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h4 className="text-lg font-semibold text-slate-100">
                  Master: {truncateAddress(rel.masterWallet)}
                </h4>
                <Badge
                  variant={rel.active ? 'default' : 'secondary'}
                  className={
                    rel.active
                      ? 'bg-green-500/20 text-green-400 border-green-500/50'
                      : 'bg-slate-700 text-slate-400'
                  }
                >
                  {rel.active ? 'Active' : 'Inactive'}
                </Badge>

                {/* Advanced Settings Badges */}
                {rel.customLeverage && (
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50 text-xs">
                    🎚️ {rel.customLeverage}x
                  </Badge>
                )}
                {rel.maxTotalExposure && (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/50 text-xs">
                    🛡️ ${(rel.maxTotalExposure / 1000).toFixed(1)}k
                  </Badge>
                )}
                {rel.symbolMultipliers && Object.keys(rel.symbolMultipliers).length > 0 && (
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50 text-xs">
                    ⚙️ {Object.keys(rel.symbolMultipliers).length} symbols
                  </Badge>
                )}
              </div>

              <div className="space-y-1 text-sm text-slate-400">
                <p>
                  <span className="font-medium text-slate-300">Sizing:</span>{' '}
                  {rel.sizingMethod === 'multiplier' && `${rel.sizingValue.toFixed(2)}x multiplier`}
                  {rel.sizingMethod === 'fixed_usd' && `$${rel.sizingValue.toFixed(0)} fixed`}
                  {rel.sizingMethod === 'balance_percent' && `${rel.sizingValue.toFixed(1)}% of balance`}
                  {rel.maxPositionCap && (
                    <span className="text-amber-400/80"> (cap: ${rel.maxPositionCap.toFixed(0)})</span>
                  )}
                </p>
                {rel.symbolFilter && rel.symbolFilter.length > 0 && (
                  <p>
                    <span className="font-medium text-slate-300">Symbols:</span> {rel.symbolFilter.join(', ')}
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  Created: {new Date(rel.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">Active</span>
                <Switch
                  checked={rel.active}
                  onCheckedChange={() => handleToggleActive(rel.id, rel.active)}
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteId(rel.id)}
                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                Delete
              </Button>
            </div>
          </div>
        </Card>
      ))}

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle>Delete Relationship</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete this copy relationship? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              disabled={deleting}
              className="border-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
