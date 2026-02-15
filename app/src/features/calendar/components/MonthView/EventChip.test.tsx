import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils/render';
import { EventChip, OverflowIndicator } from './EventChip';
import { mockCalendarEvents } from '@/test/mocks/data/calendar/events';
import type { CalendarEvent } from '../../types';

const taskEvent = mockCalendarEvents.find(e => e.source === 'task' && !e.isCompleted)!;
const completedTask: CalendarEvent = {
  ...taskEvent,
  id: 'completed-task',
  isCompleted: true,
  status: 'done',
};
const overdueTask: CalendarEvent = {
  ...taskEvent,
  id: 'overdue-task',
  isOverdue: true,
};
const runningEntry: CalendarEvent = {
  ...mockCalendarEvents.find(e => e.isRunning)!,
};

describe('EventChip', () => {
  describe('standard chip', () => {
    it('renders event title', () => {
      render(<EventChip event={taskEvent} />);
      expect(screen.getByText(taskEvent.title)).toBeInTheDocument();
    });

    it('is a button element', () => {
      render(<EventChip event={taskEvent} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('calls onClick when clicked', async () => {
      const onClick = vi.fn();
      const { user } = render(<EventChip event={taskEvent} onClick={onClick} />);
      await user.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledWith(taskEvent);
    });

    it('has title attribute', () => {
      render(<EventChip event={taskEvent} />);
      expect(screen.getByRole('button')).toHaveAttribute('title', taskEvent.title);
    });

    it('applies line-through for completed events', () => {
      render(<EventChip event={completedTask} />);
      const btn = screen.getByRole('button');
      expect(btn.className).toContain('line-through');
      expect(btn.className).toContain('opacity-50');
    });

    it('applies ring for overdue events', () => {
      render(<EventChip event={overdueTask} />);
      const btn = screen.getByRole('button');
      expect(btn.className).toContain('ring-destructive');
    });

    it('applies pulse animation for running events', () => {
      render(<EventChip event={runningEntry} />);
      const btn = screen.getByRole('button');
      expect(btn.className).toContain('animate-pulse');
    });

    it('applies source-specific background color', () => {
      render(<EventChip event={taskEvent} />);
      const btn = screen.getByRole('button');
      expect(btn.className).toContain('bg-blue-500/10');
    });
  });

  describe('compact chip (dot)', () => {
    it('renders as a small dot', () => {
      render(<EventChip event={taskEvent} compact />);
      const btn = screen.getByRole('button');
      expect(btn.className).toContain('w-2');
      expect(btn.className).toContain('h-2');
      expect(btn.className).toContain('rounded-full');
    });

    it('has aria-label with event title', () => {
      render(<EventChip event={taskEvent} compact />);
      expect(screen.getByLabelText(taskEvent.title)).toBeInTheDocument();
    });

    it('calls onClick when clicked', async () => {
      const onClick = vi.fn();
      const { user } = render(<EventChip event={taskEvent} compact onClick={onClick} />);
      await user.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledWith(taskEvent);
    });

    it('applies opacity for completed events', () => {
      render(<EventChip event={completedTask} compact />);
      const btn = screen.getByRole('button');
      expect(btn.className).toContain('opacity-50');
    });
  });
});

describe('OverflowIndicator', () => {
  it('renders count when positive', () => {
    render(<OverflowIndicator count={3} />);
    expect(screen.getByText('+3 more')).toBeInTheDocument();
  });

  it('does not render when count is 0', () => {
    const { container } = render(<OverflowIndicator count={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render when count is negative', () => {
    const { container } = render(<OverflowIndicator count={-1} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const { user } = render(<OverflowIndicator count={5} onClick={onClick} />);
    await user.click(screen.getByText('+5 more'));
    expect(onClick).toHaveBeenCalled();
  });

  it('is a button element', () => {
    render(<OverflowIndicator count={2} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
