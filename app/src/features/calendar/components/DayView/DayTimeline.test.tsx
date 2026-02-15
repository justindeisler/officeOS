import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@/test/utils/render';
import { DayTimeline } from './DayTimeline';
import type { CalendarEvent } from '../../types';

const testDate = new Date('2025-07-22');

const timedEvent: CalendarEvent = {
  id: 'time-1',
  sourceId: 'te-1',
  source: 'time_entry',
  type: 'time_block',
  title: 'Morning Coding',
  startDate: '2025-07-22T09:00:00Z',
  endDate: '2025-07-22T11:30:00Z',
  isAllDay: false,
  durationMinutes: 150,
  color: 'bg-emerald-500',
};

const allDayEvent: CalendarEvent = {
  id: 'task-1',
  sourceId: 't-1',
  source: 'task',
  type: 'deadline',
  title: 'All Day Task',
  startDate: '2025-07-22T00:00:00Z',
  isAllDay: true,
  color: 'bg-blue-500',
};

const otherDayEvent: CalendarEvent = {
  id: 'time-2',
  sourceId: 'te-2',
  source: 'time_entry',
  type: 'time_block',
  title: 'Tomorrow Event',
  startDate: '2025-07-23T09:00:00Z',
  endDate: '2025-07-23T10:00:00Z',
  isAllDay: false,
  durationMinutes: 60,
  color: 'bg-emerald-500',
};

describe('DayTimeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-07-22T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with region role', () => {
    render(<DayTimeline date={testDate} events={[]} />);
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('has accessible label', () => {
    render(<DayTimeline date={testDate} events={[]} />);
    expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Day timeline');
  });

  it('has a scrollable container', () => {
    render(<DayTimeline date={testDate} events={[]} />);
    expect(screen.getByTestId('day-timeline')).toBeInTheDocument();
  });

  it('shows hour labels', () => {
    render(<DayTimeline date={testDate} events={[]} workingHoursStart={8} workingHoursEnd={18} />);
    expect(screen.getByText('08:00')).toBeInTheDocument();
    expect(screen.getByText('17:00')).toBeInTheDocument();
  });

  it('renders timed events', () => {
    render(<DayTimeline date={testDate} events={[timedEvent]} />);
    expect(screen.getByText('Morning Coding')).toBeInTheDocument();
  });

  it('does not render all-day events', () => {
    render(<DayTimeline date={testDate} events={[allDayEvent]} />);
    expect(screen.queryByText('All Day Task')).not.toBeInTheDocument();
  });

  it('only shows events for the specified date', () => {
    render(<DayTimeline date={testDate} events={[timedEvent, otherDayEvent]} />);
    expect(screen.getByText('Morning Coding')).toBeInTheDocument();
    expect(screen.queryByText('Tomorrow Event')).not.toBeInTheDocument();
  });

  it('calls onEventClick when event clicked', async () => {
    const onClick = vi.fn();
    const { user } = render(
      <DayTimeline date={testDate} events={[timedEvent]} onEventClick={onClick} />
    );
    await user.click(screen.getByText('Morning Coding'));
    expect(onClick).toHaveBeenCalledWith(timedEvent);
  });

  it('shows current time indicator for today', () => {
    render(<DayTimeline date={testDate} events={[]} workingHoursStart={0} workingHoursEnd={24} />);
    expect(screen.getByTestId('current-time-indicator')).toBeInTheDocument();
  });

  it('uses custom working hours range', () => {
    render(<DayTimeline date={testDate} events={[]} workingHoursStart={6} workingHoursEnd={22} />);
    expect(screen.getByText('06:00')).toBeInTheDocument();
    expect(screen.getByText('21:00')).toBeInTheDocument();
  });
});
