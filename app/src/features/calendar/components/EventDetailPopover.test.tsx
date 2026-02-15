import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils/render';
import { EventDetailPopover } from './EventDetailPopover';
import type { CalendarEvent } from '../types';

const taskEvent: CalendarEvent = {
  id: 'task-1',
  sourceId: 't-1',
  source: 'task',
  type: 'deadline',
  title: 'Build Smart Calendar',
  description: 'Implement the unified calendar view',
  startDate: '2025-07-22T00:00:00Z',
  isAllDay: true,
  color: 'bg-blue-500',
  area: 'wellfy',
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
  isOverdue: true,
};

const completedEvent: CalendarEvent = {
  ...taskEvent,
  id: 'completed-1',
  isCompleted: true,
};

const runningEvent: CalendarEvent = {
  ...timedEvent,
  id: 'running-1',
  isRunning: true,
};

const agentEvent: CalendarEvent = {
  id: 'agent-1',
  sourceId: 'session-1',
  source: 'agent_activity',
  type: 'agent_work',
  title: 'Spec Update',
  startDate: '2025-07-22T08:00:00Z',
  endDate: '2025-07-22T08:30:00Z',
  isAllDay: false,
  durationMinutes: 30,
  color: 'bg-cyan-500',
  agentName: 'Markus',
};

const cronEvent: CalendarEvent = {
  id: 'cron-1',
  sourceId: 'c-1',
  source: 'cron_job',
  type: 'recurring',
  title: 'Newsletter Scan',
  startDate: '2025-07-22T08:00:00Z',
  isAllDay: false,
  durationMinutes: 10,
  color: 'bg-orange-500',
  cronFrequency: 'daily at 08:00',
};

describe('EventDetailPopover', () => {
  it('renders as a dialog', () => {
    render(<EventDetailPopover event={taskEvent} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('has accessible label', () => {
    render(<EventDetailPopover event={taskEvent} />);
    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-label',
      `Event details: ${taskEvent.title}`
    );
  });

  it('shows event title', () => {
    render(<EventDetailPopover event={taskEvent} />);
    expect(screen.getByText('Build Smart Calendar')).toBeInTheDocument();
  });

  it('shows source label', () => {
    render(<EventDetailPopover event={taskEvent} />);
    expect(screen.getByText('Task')).toBeInTheDocument();
  });

  it('shows description', () => {
    render(<EventDetailPopover event={taskEvent} />);
    expect(screen.getByText('Implement the unified calendar view')).toBeInTheDocument();
  });

  it('shows area badge', () => {
    render(<EventDetailPopover event={taskEvent} />);
    expect(screen.getByText('wellfy')).toBeInTheDocument();
  });

  it('shows priority badge', () => {
    render(<EventDetailPopover event={taskEvent} />);
    expect(screen.getByText('P1')).toBeInTheDocument();
  });

  describe('time display', () => {
    it('shows "All day" for all-day events', () => {
      render(<EventDetailPopover event={taskEvent} />);
      expect(screen.getByText(/All day/)).toBeInTheDocument();
    });

    it('shows time for timed events', () => {
      render(<EventDetailPopover event={timedEvent} />);
      expect(screen.getByText(/09:00/)).toBeInTheDocument();
    });

    it('shows duration', () => {
      render(<EventDetailPopover event={timedEvent} />);
      expect(screen.getByText(/2h 30m/)).toBeInTheDocument();
    });
  });

  describe('status indicators', () => {
    it('shows overdue badge', () => {
      render(<EventDetailPopover event={overdueEvent} />);
      expect(screen.getByText('Overdue')).toBeInTheDocument();
    });

    it('shows running badge', () => {
      render(<EventDetailPopover event={runningEvent} />);
      expect(screen.getByText(/Running/)).toBeInTheDocument();
    });

    it('applies completed styling', () => {
      render(<EventDetailPopover event={completedEvent} />);
      const title = screen.getByText(completedEvent.title);
      expect(title.className).toContain('line-through');
    });
  });

  describe('agent events', () => {
    it('shows agent name', () => {
      render(<EventDetailPopover event={agentEvent} />);
      expect(screen.getByText(/Markus/)).toBeInTheDocument();
    });
  });

  describe('cron events', () => {
    it('shows cron frequency', () => {
      render(<EventDetailPopover event={cronEvent} />);
      expect(screen.getByText(/daily at 08:00/)).toBeInTheDocument();
    });
  });

  describe('actions', () => {
    it('has close button', () => {
      render(<EventDetailPopover event={taskEvent} />);
      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    it('calls onClose when close clicked', async () => {
      const onClose = vi.fn();
      const { user } = render(<EventDetailPopover event={taskEvent} onClose={onClose} />);
      await user.click(screen.getByLabelText('Close'));
      expect(onClose).toHaveBeenCalled();
    });

    it('has navigate to source button', () => {
      render(<EventDetailPopover event={taskEvent} />);
      expect(screen.getByText('Open Task')).toBeInTheDocument();
    });

    it('calls onNavigateToSource when source button clicked', async () => {
      const onNav = vi.fn();
      const { user } = render(
        <EventDetailPopover event={taskEvent} onNavigateToSource={onNav} />
      );
      await user.click(screen.getByText('Open Task'));
      expect(onNav).toHaveBeenCalledWith(taskEvent);
    });

    it('shows correct source label for different sources', () => {
      render(<EventDetailPopover event={timedEvent} />);
      expect(screen.getByText('Open Time Entry')).toBeInTheDocument();
    });
  });
});
