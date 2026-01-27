/**
 * AttachmentPreview Component
 *
 * Displays information about an attached file with actions to view or remove it.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, ExternalLink, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { attachmentService, type AttachmentInfo } from '@/services/attachmentService';

export interface AttachmentPreviewProps {
  /** Path to the attached file */
  filePath: string;
  /** Optional override for the display name */
  fileName?: string;
  /** Callback when the attachment is removed */
  onRemove: () => void;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AttachmentPreview displays an attached file with view and remove actions
 */
export function AttachmentPreview({
  filePath,
  fileName,
  onRemove,
  disabled = false,
  className,
}: AttachmentPreviewProps) {
  const [attachmentInfo, setAttachmentInfo] = useState<AttachmentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load attachment info on mount
  useEffect(() => {
    async function loadInfo() {
      setIsLoading(true);
      setError(null);
      try {
        const info = await attachmentService.getAttachmentInfo(filePath);
        setAttachmentInfo(info);
        if (info && !info.exists) {
          setError('File not found');
        }
      } catch {
        setError('Failed to load file info');
      } finally {
        setIsLoading(false);
      }
    }
    loadInfo();
  }, [filePath]);

  const handleOpen = async () => {
    if (disabled || isOpening) return;

    setIsOpening(true);
    setError(null);
    try {
      await attachmentService.openAttachment(filePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open file');
    } finally {
      setIsOpening(false);
    }
  };

  const displayName = fileName || attachmentInfo?.name || 'Attached file';

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-3 rounded-lg border p-3', className)}>
        <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
        <div className="flex-1">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-1 h-3 w-20 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3',
        error && 'border-destructive/50 bg-destructive/5',
        className
      )}
    >
      {/* File icon */}
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded',
          error ? 'bg-destructive/10' : 'bg-primary/10'
        )}
      >
        <FileText
          className={cn(
            'h-5 w-5',
            error ? 'text-destructive' : 'text-primary'
          )}
        />
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{displayName}</p>
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : (
          <p className="text-xs text-muted-foreground">PDF Document</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* View button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleOpen}
          disabled={disabled || isOpening || !!error}
          title="Open in PDF viewer"
        >
          {isOpening ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="h-4 w-4" />
          )}
        </Button>

        {/* Remove button with confirmation */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              title="Remove attachment"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove attachment?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the attached bill from this asset. The file will be deleted when you save.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onRemove}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </motion.div>
  );
}

export default AttachmentPreview;
