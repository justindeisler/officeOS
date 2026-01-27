/**
 * FileDropzone Component
 *
 * A drop zone for file uploads with drag-and-drop support.
 * Uses Tauri's native file dialog for file selection.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { attachmentService, type PickedFile } from '@/services/attachmentService';

export interface FileDropzoneProps {
  /** Accepted file types description (for display) */
  accept?: string;
  /** Maximum file size in bytes (default: 10MB) */
  maxSize?: number;
  /** Callback when a file is selected */
  onFileSelect: (file: PickedFile) => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * FileDropzone component for selecting PDF files
 */
export function FileDropzone({
  accept = 'PDF',
  maxSize = 10 * 1024 * 1024,
  onFileSelect,
  onError,
  disabled = false,
  className,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const file = await attachmentService.pickBillFile();
      if (file) {
        // Validate the file
        const validation = attachmentService.validateFile(file.name);
        if (!validation.valid) {
          const errorMsg = validation.error || 'Invalid file';
          setError(errorMsg);
          onError?.(errorMsg);
          return;
        }

        onFileSelect(file);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to select file';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [disabled, isLoading, onFileSelect, onError]);

  // Handle drag events (visual feedback only - native dialog for actual selection)
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    // In Tauri, we can't access dropped files directly due to security
    // Show a message and trigger the native file picker instead
    if (!disabled) {
      handleClick();
    }
  }, [disabled, handleClick]);

  return (
    <div className={cn('relative', className)}>
      <motion.button
        type="button"
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        disabled={disabled || isLoading}
        className={cn(
          'w-full rounded-lg border-2 border-dashed p-6',
          'flex flex-col items-center justify-center gap-2',
          'transition-all duration-200 ease-out',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50',
          disabled && 'cursor-not-allowed opacity-50',
          error && 'border-destructive/50'
        )}
        animate={{
          scale: isDragging ? 1.02 : 1,
        }}
        transition={{
          duration: 0.2,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
              <span className="text-sm text-muted-foreground">Opening file picker...</span>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2"
            >
              <motion.div
                animate={{
                  y: isDragging ? -4 : 0,
                }}
                transition={{
                  duration: 0.2,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                {isDragging ? (
                  <FileText className="h-10 w-10 text-primary" />
                ) : (
                  <Upload className="h-10 w-10 text-muted-foreground" />
                )}
              </motion.div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  {isDragging ? 'Drop to upload' : 'Click to attach bill'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {accept} files only (max {Math.round(maxSize / 1024 / 1024)}MB)
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-2 flex items-center gap-1.5 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FileDropzone;
