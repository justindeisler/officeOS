import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@/test/utils/render';
import { AgendaList } from './AgendaList';
import type { CalendarEvent } from '../../types';

const startDate = new Date('2025-07-22');

const todayEvent: CalendarEvent = {
  id: 'task-1',
  sourceId: 't-1',
  source: 'task',
  type: 'deadline',
  title: 'Today Task',
  startDate: '2025-07-22T00:00:00Z',
  isAllDay: true,
  color: 'bg-blue-500',
};

const tomorrowEvent: CalendarEvent = {
  id: 'task-2',
  sourceId: 't-2',
  source: 'task',
  type: 'deadline',
  title: 'Tomorrow Task',
  startDate: '2025-07-23T00:00:00Z',
  isAllDay: true,
  color: 'bg-blue-500',
};

const futureEvent: CalendarEvent = {
  id: 'time-1',
  sourceId: 'te-1',
  source: 'time_entry',
  type: 'time_block',
  title: 'Future Meeting',
  startDate: '2025-07-30T14:00:00Z',
  endDate: '2025-07-30T15:00:00Z',
  isAllDay: false,
  durationMinutes: 60,
  color: 'bg-emerald-500',
};

const allEvents = [todayEvent, tomorrowEvent, futureEvent];

describe('AgendaList', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-07-22T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders as a list', () => {
    render(<AgendaList startDate={startDate} events={allEvents} />);
    expect(screen.getByRole('list')).toBeInTheDocument();
  });

  it('has accessible label', () => {
    render(<AgendaList startDate={startDate} events={allEvents} />);
    expect(screen.getByRole('list')).toHaveAttribute('aria-label', 'Agenda view');
  });

  describe('range selector', () => {
    it('shows range options', () => {
      render(<AgendaList startDate={startDate} events={[]} />);
      expect(screen.getByText('7 days')).toBeInTheDocument();
      expect(screen.getByText('14 days')).toBeInTheDocument();
      expect(screen.getByText('30 days')).toBeInTheDocument();
    });

    it('defaults to 14 days', () => {
      render(<AgendaList startDate={startDate} events={[]} />);
      const btn14 = screen.getByText('14 days');
      expect(btn14.className).toContain('bg-primary');
    });

    it('allows custom initial range', () => {
      render(<AgendaList startDate={startDate} events={[]} initialRange={7} />);
      const btn7 = screen.getByText('7 days');
      expect(btn7.className).toContain('bg-primary');
    });

    it('changes range when clicked', async () => {
      const { user } = render(
        <AgendaList startDate={startDate} events={[]} />
      );
      await user.click(screen.getByText('30 days'));
      const btn30 = screen.getByText('30 days');
      expect(btn30.className).toContain('bg-primary');
    });

    it('shows total event count', () => {
      render(<AgendaList startDate={startDate} events={allEvents} />);
      // Today + Tomorrow events are within 14 day range
      expect(screen.getByText(/\d+ events?/)).toBeInTheDocument();
    });
  });

  describe('day groups', () => {
    it('groups events by day', () => {
      render(<AgendaList startDate={startDate} events={allEvents} />);
      expect(screen.getByText('Today Task')).toBeInTheDocument();
      expect(screen.getByText('Tomorrow Task')).toBeInTheDocument();
    });

    it('shows "Today" label for current day', () => {
      render(<AgendaList startDate={startDate} events={allEvents} />);
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('shows "Tomorrow" label for next day', () => {
      render(<AgendaList startDate={startDate} events={allEvents} />);
      expect(screen.getByText('Tomorrow')).toBeInTheDocument();
    });

    it('shows weekday name for each group', () => {
      render(<AgendaList startDate={startDate} events={allEvents} />);
      expect(screen.getByText('Tuesday')).toBeInTheDocument(); // July 22
      expect(screen.getByText('Wednesday')).toBeInTheDocument(); // July 23
    });

    it('shows event count per day', () => {
      render(<AgendaList startDate={startDate} events={allEvents} />);
      expect(screen.getByText('1 event')).toBeInTheDocument();
    });

    it('hides empty days', () => {
      render(<AgendaList startDate={startDate} events={[todayEvent]} />);
      // Only today group should show, not empty days
      expect(screen.getByText('Today Task')).toBeInTheDocument();
      // July 24 (Thursday) should NOT have a header since no events
      expect(screen.queryByText('Thursday')).not.toBeInTheDocument();
    });
  });

  describe('events', () => {
    it('renders event rows', () => {
      render(<AgendaList startDate={startDate} events={allEvents} />);
      expect(screen.getByText('Today Task')).toBeInTheDocument();
    });

    it('calls onEventClick when event clicked', async () => {
      const onClick = vi.fn();
      const { user } = render(
        <AgendaList startDate={startDate} events={[todayEvent]} onEventClick={onClick} />
      );
      await user.click(screen.getByText('Today Task'));
      expect(onClick).toHaveBeenCalledWith(todayEvent);
    });
  });

  describe('empty state', () => {
    it('shows empty state when no events', () => {
      render(<AgendaList startDate={startDate} events={[]} />);
      expect(screen.getByText(/No events in the next 14 days/)).toBeInTheDocument();
    });

    it('updates empty state text with range', async () => {
      const { user } = render(
        <AgendaList startDate={startDate} events={[]} />
      );
      await user.click(screen.getByText('30 days'));
      expect(screen.getByText(/No events in the next 30 days/)).toBeInTheDocument();
    });
  });

  it('excludes events outside the range', () => {
    // With 7-day range, future event on July 30 should be excluded
    render(<AgendaList startDate={startDate} events={allEvents} initialRange={7} />);
    expect(screen.getByText('Today Task')).toBeInTheDocument();
    expect(screen.queryByText('Future Meeting')).not.toBeInTheDocument();
  });

  it('includes events within range', () => {
    // With 14-day range, future event on July 30 should be included
    render(<AgendaList startDate={startDate} events={allEvents} initialRange={14} />);
    expect(screen.getByText('Future Meeting')).toBeInTheDocument();
  });
});
