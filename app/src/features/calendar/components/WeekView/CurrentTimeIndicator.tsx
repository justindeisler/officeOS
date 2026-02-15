import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { getTimePosition, isToday, format } from '../../utils/date-helpers';

interface CurrentTimeIndicatorProps {
  date: Date;
  workingHoursStart?: number;
  workingHoursEnd?: number;
}

export function CurrentTimeIndicator({
  date,
  workingHoursStart = 0,
  workingHoursEnd = 24,
}: CurrentTimeIndicatorProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  if (!isToday(date)) return null;

  const position = getTimePosition(now, workingHoursStart, workingHoursEnd);

  if (position < 0 || position > 100) return null;

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: `${position}%` }}
      aria-label={`Current time: ${format(now, 'HH:mm')}`}
      data-testid="current-time-indicator"
    >
      <div className="flex items-center">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1" />
        <div className="flex-1 h-[2px] bg-red-500" />
      </div>
    </div>
  );
}
