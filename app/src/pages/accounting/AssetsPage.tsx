import { useState } from "react";
import { AssetList } from "@/features/accounting/components/Assets";
import { AssetDialog } from "@/features/accounting/components/Assets/AssetDialog";
import { AssetDisposalDialog } from "@/features/accounting/components/Assets/AssetDisposalDialog";
import { useAssets } from "@/features/accounting/hooks/useAssets";
import type { Asset } from "@/features/accounting/types";

export function AssetsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [disposalDialogOpen, setDisposalDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [disposingAsset, setDisposingAsset] = useState<Asset | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isDisposing, setIsDisposing] = useState(false);
  const { disposeAsset } = useAssets({ autoFetch: false });

  const handleAddAsset = () => {
    setEditingAsset(null);
    setDialogOpen(true);
  };

  const handleEditAsset = (asset: Asset) => {
    setEditingAsset(asset);
    setDialogOpen(true);
  };

  const handleDisposeAsset = (asset: Asset) => {
    setDisposingAsset(asset);
    setDisposalDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAsset(null);
  };

  const handleSuccess = () => {
    setRefreshTrigger((n) => n + 1);
  };

  const handleDisposalConfirm = async (data: {
    disposalDate: Date;
    disposalPrice: number;
    disposalReason: string;
    status: 'disposed' | 'sold';
  }) => {
    if (!disposingAsset) return;
    setIsDisposing(true);
    try {
      await disposeAsset(
        disposingAsset.id,
        data.disposalDate,
        data.status,
        data.disposalPrice
      );
      setDisposalDialogOpen(false);
      setDisposingAsset(null);
      setRefreshTrigger((n) => n + 1);
    } finally {
      setIsDisposing(false);
    }
  };

  return (
    <>
      <div className="space-y-6 animate-in fade-in">
        <AssetList
          onAddAsset={handleAddAsset}
          onEditAsset={handleEditAsset}
          onDisposeAsset={handleDisposeAsset}
          refreshTrigger={refreshTrigger}
        />
      </div>
      <AssetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        asset={editingAsset}
        onClose={handleCloseDialog}
        onSuccess={handleSuccess}
      />
      <AssetDisposalDialog
        open={disposalDialogOpen}
        onOpenChange={setDisposalDialogOpen}
        asset={disposingAsset}
        onConfirm={handleDisposalConfirm}
        isLoading={isDisposing}
      />
    </>
  );
}
