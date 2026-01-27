/**
 * ConfirmDeleteDialog Component
 *
 * A reusable confirmation dialog for delete operations.
 * Properly handles the confirm-then-delete pattern required for Tauri apps.
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export interface ConfirmDeleteDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when the open state changes */
  onOpenChange: (open: boolean) => void;
  /** The title of the dialog */
  title: string;
  /** The description/message of the dialog */
  description?: string;
  /** Callback when the user confirms the deletion */
  onConfirm: () => void;
  /** Whether a delete operation is in progress */
  isLoading?: boolean;
  /** Custom confirm button text (defaults to "Delete") */
  confirmText?: string;
  /** Custom cancel button text (defaults to "Cancel") */
  cancelText?: string;
}

/**
 * ConfirmDeleteDialog - A controlled dialog for confirming delete actions.
 *
 * Usage:
 * ```tsx
 * const [showDialog, setShowDialog] = useState(false);
 * const [itemToDelete, setItemToDelete] = useState<string | null>(null);
 *
 * const handleDeleteClick = (id: string) => {
 *   setItemToDelete(id);
 *   setShowDialog(true);
 * };
 *
 * const handleConfirmDelete = () => {
 *   if (itemToDelete) {
 *     deleteItem(itemToDelete);
 *   }
 *   setShowDialog(false);
 *   setItemToDelete(null);
 * };
 *
 * <ConfirmDeleteDialog
 *   open={showDialog}
 *   onOpenChange={setShowDialog}
 *   title="Delete item?"
 *   description="This action cannot be undone."
 *   onConfirm={handleConfirmDelete}
 * />
 * ```
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description = 'This action cannot be undone.',
  onConfirm,
  isLoading = false,
  confirmText = 'Delete',
  cancelText = 'Cancel',
}: ConfirmDeleteDialogProps) {
  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className={cn(
              'bg-destructive text-destructive-foreground hover:bg-destructive/90',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isLoading ? 'Deleting...' : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ConfirmDeleteDialog;
