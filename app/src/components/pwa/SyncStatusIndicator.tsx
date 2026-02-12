import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function SyncStatusIndicator() {
  const { isOnline, queueLength, isSyncing, syncQueue } = useOfflineSync();

  // Don't show if online and queue is empty
  if (isOnline && queueLength === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-sm backdrop-blur-sm',
          isOnline
            ? 'bg-blue-500/90 text-white'
            : 'bg-orange-500/90 text-white'
        )}
      >
        {isSyncing ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Syncing {queueLength} items...</span>
          </>
        ) : queueLength > 0 ? (
          <>
            <CloudOff className="w-4 h-4" />
            <span>{queueLength} pending</span>
            {isOnline && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-white hover:bg-white/20"
                onClick={syncQueue}
              >
                Sync now
              </Button>
            )}
          </>
        ) : (
          <>
            <Cloud className="w-4 h-4" />
            <span>Synced</span>
          </>
        )}
      </div>
    </div>
  );
}
