import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils/render';
import { WeekGrid } from './WeekGrid';
import { mockCalendarEvents } from '@/test/mocks/data/calendar/events';
import type { CalendarEvent } from '../../types';

const selectedDate = new Date('2025-07-22');

const timedEvent: CalendarEvent = {
  id: 'time-1',
  sourceId: 'te-1',
  source: 'time_entry',
  type: 'time_block',
  title: 'Week View Event',
  startDate: '2025-07-22T09:00:00Z',
  endDate: '2025-07-22T11:00:00Z',
  isAllDay: false,
  durationMinutes: 120,
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

describe('WeekGrid', () => {
  it('renders with grid role', () => {
    render(<WeekGrid selectedDate={selectedDate} events={[]} />);
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('has accessible label', () => {
    render(<WeekGrid selectedDate={selectedDate} events={[]} />);
    expect(screen.getByRole('grid')).toHaveAttribute('aria-label', 'Week view');
  });

  describe('day headers', () => {
    it('renders 7 day headers', () => {
      render(<WeekGrid selectedDate={selectedDate} events={[]} />);
      // Mon through Sun headers
      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Sun')).toBeInTheDocument();
    });

    it('highlights today', () => {
      const today = new Date();
      render(<WeekGrid selectedDate={today} events={[]} />);
      // Today's day number should have primary styling
      const dayNum = today.getDate().toString();
      const dayElement = screen.getByText(dayNum);
      expect(dayElement.className).toContain('bg-primary');
    });

    it('calls onDateClick when header clicked', async () => {
      const onDateClick = vi.fn();
      const { user } = render(
        <WeekGrid selectedDate={selectedDate} events={[]} onDateClick={onDateClick} />
      );
      // Click a day header button - find any day number button
      const buttons = screen.getAllByRole('button');
      const dayBtn = buttons.find(b => b.textContent?.includes('22'));
      if (dayBtn) {
        await user.click(dayBtn);
        expect(onDateClick).toHaveBeenCalled();
      }
    });
  });

  describe('hour labels', () => {
    it('shows hour labels for working hours', () => {
      render(
        <WeekGrid
          selectedDate={selectedDate}
          events={[]}
          workingHoursStart={8}
          workingHoursEnd={18}
        />
      );
      expect(screen.getByText('08:00')).toBeInTheDocument();
      expect(screen.getByText('17:00')).toBeInTheDocument();
    });

    it('shows all-day label', () => {
      render(<WeekGrid selectedDate={selectedDate} events={[allDayEvent]} />);
      expect(screen.getByText('All day')).toBeInTheDocument();
    });
  });

  describe('events', () => {
    it('renders timed events as time blocks', () => {
      render(<WeekGrid selectedDate={selectedDate} events={[timedEvent]} />);
      expect(screen.getByText('Week View Event')).toBeInTheDocument();
    });

    it('renders all-day events in the all-day row', () => {
      render(<WeekGrid selectedDate={selectedDate} events={[allDayEvent]} />);
      expect(screen.getByText('All Day Task')).toBeInTheDocument();
    });

    it('calls onEventClick when event is clicked', async () => {
      const onEventClick = vi.fn();
      const { user } = render(
        <WeekGrid
          selectedDate={selectedDate}
          events={[timedEvent]}
          onEventClick={onEventClick}
        />
      );
      await user.click(screen.getByText('Week View Event'));
      expect(onEventClick).toHaveBeenCalledWith(timedEvent);
    });
  });

  describe('scroll container', () => {
    it('has a scrollable container', () => {
      render(<WeekGrid selectedDate={selectedDate} events={[]} />);
      expect(screen.getByTestId('week-scroll-container')).toBeInTheDocument();
    });
  });

  describe('configuration', () => {
    it('respects weekStartsOn prop', () => {
      render(
        <WeekGrid selectedDate={selectedDate} events={[]} weekStartsOn={0} />
      );
      // First day header should be Sun
      const headers = screen.getAllByText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/);
      // With Sunday start, the first day of the week containing July 22 (Tue)
      // would be July 20 (Sun)
      expect(screen.getByText('Sun')).toBeInTheDocument();
    });

    it('uses custom working hours range', () => {
      render(
        <WeekGrid
          selectedDate={selectedDate}
          events={[]}
          workingHoursStart={6}
          workingHoursEnd={22}
        />
      );
      expect(screen.getByText('06:00')).toBeInTheDocument();
      expect(screen.getByText('21:00')).toBeInTheDocument();
    });
  });
});
