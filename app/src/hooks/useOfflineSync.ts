import { useEffect, useState, useCallback } from 'react';

export interface QueuedAction {
  id: string;
  type: 'CREATE_TASK' | 'UPDATE_TASK' | 'DELETE_TASK' | 'CREATE_PROJECT' | 'UPDATE_PROJECT';
  payload: any;
  timestamp: number;
  retries: number;
}

const QUEUE_KEY = 'offline-sync-queue';
const MAX_RETRIES = 3;

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load queue from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(QUEUE_KEY);
    if (stored) {
      try {
        setQueue(JSON.parse(stored));
      } catch (error) {
        console.error('Failed to parse sync queue:', error);
        localStorage.removeItem(QUEUE_KEY);
      }
    }
  }, []);

  // Save queue to localStorage
  useEffect(() => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }, [queue]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync queue when coming back online
  useEffect(() => {
    if (isOnline && queue.length > 0 && !isSyncing) {
      syncQueue();
    }
  }, [isOnline, queue.length]);

  const addToQueue = useCallback((action: Omit<QueuedAction, 'id' | 'timestamp' | 'retries'>) => {
    const queuedAction: QueuedAction = {
      ...action,
      id: `${action.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retries: 0,
    };

    setQueue(prev => [...prev, queuedAction]);
    return queuedAction.id;
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => prev.filter(action => action.id !== id));
  }, []);

  const syncQueue = useCallback(async () => {
    if (isSyncing || queue.length === 0 || !isOnline) return;

    setIsSyncing(true);
    const failedActions: QueuedAction[] = [];

    for (const action of queue) {
      try {
        await processAction(action);
        // Action succeeded, remove from queue
      } catch (error) {
        console.error('Failed to sync action:', action, error);
        
        if (action.retries < MAX_RETRIES) {
          failedActions.push({
            ...action,
            retries: action.retries + 1,
          });
        } else {
          console.error('Max retries exceeded for action:', action);
          // Could show notification to user here
        }
      }
    }

    setQueue(failedActions);
    setIsSyncing(false);
  }, [queue, isOnline, isSyncing]);

  return {
    isOnline,
    queue,
    isSyncing,
    queueLength: queue.length,
    addToQueue,
    removeFromQueue,
    syncQueue,
  };
}

// Process individual queued actions
async function processAction(action: QueuedAction): Promise<void> {
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  
  switch (action.type) {
    case 'CREATE_TASK': {
      const response = await fetch(`${apiBase}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.payload),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create task: ${response.statusText}`);
      }
      break;
    }

    case 'UPDATE_TASK': {
      const response = await fetch(`${apiBase}/api/tasks/${action.payload.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.payload),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update task: ${response.statusText}`);
      }
      break;
    }

    case 'DELETE_TASK': {
      const response = await fetch(`${apiBase}/api/tasks/${action.payload.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete task: ${response.statusText}`);
      }
      break;
    }

    case 'CREATE_PROJECT': {
      const response = await fetch(`${apiBase}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.payload),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create project: ${response.statusText}`);
      }
      break;
    }

    case 'UPDATE_PROJECT': {
      const response = await fetch(`${apiBase}/api/projects/${action.payload.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.payload),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update project: ${response.statusText}`);
      }
      break;
    }

    default:
      console.warn('Unknown action type:', action.type);
  }
}
