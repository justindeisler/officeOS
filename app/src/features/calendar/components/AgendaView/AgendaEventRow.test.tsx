import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils/render';
import { AgendaEventRow } from './AgendaEventRow';
import type { CalendarEvent } from '../../types';

const taskEvent: CalendarEvent = {
  id: 'task-1',
  sourceId: 't-1',
  source: 'task',
  type: 'deadline',
  title: 'Build Calendar',
  description: 'Implement the smart calendar feature',
  startDate: '2025-07-22T00:00:00Z',
  isAllDay: true,
  color: 'bg-blue-500',
  priority: 1,
  isCompleted: false,
  isOverdue: false,
};

const timedEvent: CalendarEvent = {
  id: 'time-1',
  sourceId: 'te-1',
  source: 'time_entry',
  type: 'time_block',
  title: 'Coding Session',
  startDate: '2025-07-22T09:00:00Z',
  endDate: '2025-07-22T11:30:00Z',
  isAllDay: false,
  durationMinutes: 150,
  color: 'bg-emerald-500',
};

const overdueEvent: CalendarEvent = {
  ...taskEvent,
  id: 'overdue-1',
  title: 'Overdue Item',
  isOverdue: true,
};

const completedEvent: CalendarEvent = {
  ...taskEvent,
  id: 'completed-1',
  title: 'Done Item',
  isCompleted: true,
};

const runningEvent: CalendarEvent = {
  ...timedEvent,
  id: 'running-1',
  title: 'Active Timer',
  isRunning: true,
};

describe('AgendaEventRow', () => {
  it('renders as a button', () => {
    render(<AgendaEventRow event={taskEvent} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows event title', () => {
    render(<AgendaEventRow event={taskEvent} />);
    expect(screen.getByText('Build Calendar')).toBeInTheDocument();
  });

  it('shows event description', () => {
    render(<AgendaEventRow event={taskEvent} />);
    expect(screen.getByText('Implement the smart calendar feature')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const { user } = render(<AgendaEventRow event={taskEvent} onClick={onClick} />);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(taskEvent);
  });

  it('has minimum touch target height', () => {
    render(<AgendaEventRow event={taskEvent} />);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('min-h-[44px]');
  });

  describe('time display', () => {
    it('shows "All day" for all-day events', () => {
      render(<AgendaEventRow event={taskEvent} />);
      expect(screen.getByText('All day')).toBeInTheDocument();
    });

    it('shows start time for timed events', () => {
      render(<AgendaEventRow event={timedEvent} />);
      expect(screen.getByText('09:00')).toBeInTheDocument();
    });

    it('shows end time for timed events', () => {
      render(<AgendaEventRow event={timedEvent} />);
      expect(screen.getByText('11:30')).toBeInTheDocument();
    });
  });

  describe('source badge', () => {
    it('shows source label', () => {
      render(<AgendaEventRow event={taskEvent} />);
      expect(screen.getByText('Task')).toBeInTheDocument();
    });

    it('shows Time for time entries', () => {
      render(<AgendaEventRow event={timedEvent} />);
      expect(screen.getByText('Time')).toBeInTheDocument();
    });
  });

  describe('duration', () => {
    it('shows duration for timed events', () => {
      render(<AgendaEventRow event={timedEvent} />);
      expect(screen.getByText('2h 30m')).toBeInTheDocument();
    });
  });

  describe('priority badge', () => {
    it('shows High for priority 1', () => {
      render(<AgendaEventRow event={taskEvent} />);
      expect(screen.getByText('High')).toBeInTheDocument();
    });

    it('shows Medium for priority 2', () => {
      const medEvent = { ...taskEvent, id: 'med', priority: 2 as const };
      render(<AgendaEventRow event={medEvent} />);
      expect(screen.getByText('Medium')).toBeInTheDocument();
    });

    it('shows Low for priority 3', () => {
      const lowEvent = { ...taskEvent, id: 'low', priority: 3 as const };
      render(<AgendaEventRow event={lowEvent} />);
      expect(screen.getByText('Low')).toBeInTheDocument();
    });
  });

  describe('status indicators', () => {
    it('shows overdue indicator', () => {
      render(<AgendaEventRow event={overdueEvent} />);
      expect(screen.getByText('Overdue')).toBeInTheDocument();
      const title = screen.getByText('Overdue Item');
      expect(title.className).toContain('text-destructive');
    });

    it('shows completed styling', () => {
      render(<AgendaEventRow event={completedEvent} />);
      const btn = screen.getByRole('button');
      expect(btn.className).toContain('opacity-50');
      const title = screen.getByText('Done Item');
      expect(title.className).toContain('line-through');
    });

    it('shows running indicator', () => {
      render(<AgendaEventRow event={runningEvent} />);
      expect(screen.getByText('● Running')).toBeInTheDocument();
    });
  });

  it('has color bar from source', () => {
    render(<AgendaEventRow event={taskEvent} />);
    // Should have the source color applied to the bar
    const btn = screen.getByRole('button');
    const colorBar = btn.querySelector('.bg-blue-500');
    expect(colorBar).toBeTruthy();
  });
});
