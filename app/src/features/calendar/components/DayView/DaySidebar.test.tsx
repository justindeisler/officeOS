import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils/render';
import { DaySidebar } from './DaySidebar';
import type { CalendarEvent } from '../../types';

const testDate = new Date('2025-07-22');

const taskEvent: CalendarEvent = {
  id: 'task-1',
  sourceId: 't-1',
  source: 'task',
  type: 'deadline',
  title: 'Build Feature',
  startDate: '2025-07-22T00:00:00Z',
  isAllDay: true,
  color: 'bg-blue-500',
  priority: 1,
  isCompleted: false,
  isOverdue: false,
};

const completedTask: CalendarEvent = {
  ...taskEvent,
  id: 'task-2',
  title: 'Done Task',
  isCompleted: true,
  status: 'done',
};

const overdueTask: CalendarEvent = {
  ...taskEvent,
  id: 'task-3',
  title: 'Overdue Task',
  isOverdue: true,
};

const timeEntry: CalendarEvent = {
  id: 'time-1',
  sourceId: 'te-1',
  source: 'time_entry',
  type: 'time_block',
  title: 'Coding',
  startDate: '2025-07-22T09:00:00Z',
  endDate: '2025-07-22T11:00:00Z',
  isAllDay: false,
  durationMinutes: 120,
  color: 'bg-emerald-500',
  isRunning: false,
  status: 'completed',
};

const runningEntry: CalendarEvent = {
  id: 'time-2',
  sourceId: 'te-2',
  source: 'time_entry',
  type: 'time_block',
  title: 'Active Session',
  startDate: '2025-07-22T14:00:00Z',
  isAllDay: false,
  durationMinutes: 45,
  color: 'bg-emerald-500',
  isRunning: true,
  status: 'running',
};

const allEvents = [taskEvent, completedTask, overdueTask, timeEntry, runningEntry];

describe('DaySidebar', () => {
  it('renders as a sidebar', () => {
    render(<DaySidebar date={testDate} events={allEvents} />);
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });

  it('has accessible label', () => {
    render(<DaySidebar date={testDate} events={allEvents} />);
    expect(screen.getByLabelText('Day details sidebar')).toBeInTheDocument();
  });

  it('shows the day name', () => {
    render(<DaySidebar date={testDate} events={[]} />);
    expect(screen.getByText('Tuesday')).toBeInTheDocument();
  });

  it('shows the full date', () => {
    render(<DaySidebar date={testDate} events={[]} />);
    expect(screen.getByText('July 22, 2025')).toBeInTheDocument();
  });

  describe('daily stats', () => {
    it('shows time tracked', () => {
      render(<DaySidebar date={testDate} events={allEvents} />);
      expect(screen.getByText('Time tracked')).toBeInTheDocument();
      expect(screen.getByText('2h')).toBeInTheDocument(); // 120 min
    });

    it('shows tasks due count', () => {
      render(<DaySidebar date={testDate} events={allEvents} />);
      expect(screen.getByText('Tasks due')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // 3 task events
    });

    it('shows completed count', () => {
      render(<DaySidebar date={testDate} events={allEvents} />);
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('shows overdue count when applicable', () => {
      render(<DaySidebar date={testDate} events={allEvents} />);
      expect(screen.getByText('Overdue')).toBeInTheDocument();
    });

    it('does not show overdue when no overdue tasks', () => {
      render(<DaySidebar date={testDate} events={[taskEvent, timeEntry]} />);
      expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
    });
  });

  describe('active timer', () => {
    it('shows running timer section', () => {
      render(<DaySidebar date={testDate} events={[runningEntry]} />);
      expect(screen.getByText('Active Timer')).toBeInTheDocument();
      expect(screen.getByText('Active Session')).toBeInTheDocument();
    });

    it('does not show active timer when none running', () => {
      render(<DaySidebar date={testDate} events={[timeEntry]} />);
      expect(screen.queryByText('Active Timer')).not.toBeInTheDocument();
    });

    it('calls onEventClick when timer clicked', async () => {
      const onClick = vi.fn();
      const { user } = render(
        <DaySidebar date={testDate} events={[runningEntry]} onEventClick={onClick} />
      );
      await user.click(screen.getByText('Active Session'));
      expect(onClick).toHaveBeenCalledWith(runningEntry);
    });
  });

  describe('tasks due section', () => {
    it('shows task titles', () => {
      render(<DaySidebar date={testDate} events={allEvents} />);
      expect(screen.getByText('Build Feature')).toBeInTheDocument();
      expect(screen.getByText('Done Task')).toBeInTheDocument();
    });

    it('marks completed tasks with visual indicator', () => {
      render(<DaySidebar date={testDate} events={[completedTask]} />);
      // Find the task text and check for line-through
      const taskText = screen.getByText('Done Task');
      expect(taskText.className).toContain('line-through');
    });

    it('marks overdue tasks with destructive styling', () => {
      render(<DaySidebar date={testDate} events={[overdueTask]} />);
      const taskText = screen.getByText('Overdue Task');
      expect(taskText.className).toContain('text-destructive');
    });
  });

  describe('all events section', () => {
    it('shows total event count', () => {
      render(<DaySidebar date={testDate} events={allEvents} />);
      expect(screen.getByText(`All Events (${allEvents.length})`)).toBeInTheDocument();
    });

    it('shows empty message when no events', () => {
      render(<DaySidebar date={testDate} events={[]} />);
      expect(screen.getByText('No events today')).toBeInTheDocument();
    });

    it('calls onEventClick on event summary click', async () => {
      const onClick = vi.fn();
      const { user } = render(
        <DaySidebar date={testDate} events={[taskEvent]} onEventClick={onClick} />
      );
      // Click in the all events section
      const allEventsSection = screen.getByText(`All Events (1)`);
      // The event appears in both tasks and all events sections
      const buttons = screen.getAllByText('Build Feature');
      await user.click(buttons[buttons.length - 1]); // Click the last one (all events section)
      expect(onClick).toHaveBeenCalled();
    });
  });
});
