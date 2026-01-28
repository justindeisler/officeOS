import { useState } from "react";
import { AssetList } from "@/features/accounting/components/Assets";
import { AssetDialog } from "@/features/accounting/components/Assets/AssetDialog";
import type { Asset } from "@/features/accounting/types";

export function AssetsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleAddAsset = () => {
    setEditingAsset(null);
    setDialogOpen(true);
  };

  const handleEditAsset = (asset: Asset) => {
    setEditingAsset(asset);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAsset(null);
  };

  const handleSuccess = () => {
    setRefreshTrigger((n) => n + 1);
  };

  return (
    <>
      <div className="space-y-6 animate-in fade-in">
        <AssetList
          onAddAsset={handleAddAsset}
          onEditAsset={handleEditAsset}
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
    </>
  );
}
