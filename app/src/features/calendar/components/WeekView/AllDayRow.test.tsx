import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils/render';
import { AllDayRow } from './AllDayRow';
import type { CalendarEvent } from '../../types';

const weekDates = Array.from({ length: 7 }, (_, i) => new Date(2025, 6, 21 + i)); // Jul 21-27

const allDayEvent: CalendarEvent = {
  id: 'task-1',
  sourceId: 't-1',
  source: 'task',
  type: 'deadline',
  title: 'Task Due',
  startDate: '2025-07-22T00:00:00Z',
  isAllDay: true,
  color: 'bg-blue-500',
};

const timedEvent: CalendarEvent = {
  id: 'time-1',
  sourceId: 'te-1',
  source: 'time_entry',
  type: 'time_block',
  title: 'Meeting',
  startDate: '2025-07-22T09:00:00Z',
  endDate: '2025-07-22T10:00:00Z',
  isAllDay: false,
  durationMinutes: 60,
  color: 'bg-emerald-500',
};

const rangeEvent: CalendarEvent = {
  id: 'proj-1',
  sourceId: 'p-1',
  source: 'project',
  type: 'range',
  title: 'Project Sprint',
  startDate: '2025-07-21T00:00:00Z',
  endDate: '2025-07-25T00:00:00Z',
  isAllDay: true,
  color: 'bg-violet-500',
};

describe('AllDayRow', () => {
  it('renders with row role', () => {
    render(<AllDayRow dates={weekDates} events={[allDayEvent]} />);
    expect(screen.getByRole('row')).toBeInTheDocument();
  });

  it('returns null when no all-day events', () => {
    const { container } = render(<AllDayRow dates={weekDates} events={[timedEvent]} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows all-day event chip', () => {
    render(<AllDayRow dates={weekDates} events={[allDayEvent]} />);
    expect(screen.getByText('Task Due')).toBeInTheDocument();
  });

  it('does not show timed events', () => {
    render(<AllDayRow dates={weekDates} events={[allDayEvent, timedEvent]} />);
    expect(screen.getByText('Task Due')).toBeInTheDocument();
    expect(screen.queryByText('Meeting')).not.toBeInTheDocument();
  });

  it('shows range events across multiple days', () => {
    render(<AllDayRow dates={weekDates} events={[rangeEvent]} />);
    // Range event should appear in multiple day columns
    const chips = screen.getAllByText('Project Sprint');
    expect(chips.length).toBeGreaterThan(1);
  });

  it('calls onEventClick when chip clicked', async () => {
    const onClick = vi.fn();
    const { user } = render(
      <AllDayRow dates={weekDates} events={[allDayEvent]} onEventClick={onClick} />
    );
    await user.click(screen.getByText('Task Due'));
    expect(onClick).toHaveBeenCalledWith(allDayEvent);
  });

  it('applies completed styling', () => {
    const completed: CalendarEvent = {
      ...allDayEvent,
      id: 'completed-1',
      isCompleted: true,
    };
    render(<AllDayRow dates={weekDates} events={[completed]} />);
    const chip = screen.getByText('Task Due');
    expect(chip.className).toContain('line-through');
    expect(chip.className).toContain('opacity-50');
  });

  it('applies overdue styling', () => {
    const overdue: CalendarEvent = {
      ...allDayEvent,
      id: 'overdue-1',
      isOverdue: true,
    };
    render(<AllDayRow dates={weekDates} events={[overdue]} />);
    const chip = screen.getByText('Task Due');
    expect(chip.className).toContain('ring-destructive');
  });
});
