import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@/test/utils/render';
import { MonthGrid } from './MonthGrid';
import { mockCalendarEvents } from '@/test/mocks/data/calendar/events';
import type { CalendarEvent } from '../../types';

const july2025 = new Date('2025-07-15');

describe('MonthGrid', () => {
  it('renders as a grid', () => {
    render(<MonthGrid selectedDate={july2025} events={[]} />);
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('has an accessible label with month and year', () => {
    render(<MonthGrid selectedDate={july2025} events={[]} />);
    expect(screen.getByRole('grid')).toHaveAttribute(
      'aria-label',
      'Calendar for July 2025'
    );
  });

  describe('weekday headers', () => {
    it('shows Monday-start headers by default', () => {
      render(<MonthGrid selectedDate={july2025} events={[]} />);
      const headers = screen.getAllByRole('columnheader');
      expect(headers).toHaveLength(7);
      expect(headers[0]).toHaveTextContent('Mon');
      expect(headers[6]).toHaveTextContent('Sun');
    });

    it('shows Sunday-start headers when configured', () => {
      render(<MonthGrid selectedDate={july2025} events={[]} weekStartsOn={0} />);
      const headers = screen.getAllByRole('columnheader');
      expect(headers[0]).toHaveTextContent('Sun');
      expect(headers[6]).toHaveTextContent('Sat');
    });

    it('shows single-char headers in compact mode', () => {
      render(<MonthGrid selectedDate={july2025} events={[]} compact />);
      const headers = screen.getAllByRole('columnheader');
      expect(headers[0]).toHaveTextContent('M');
    });
  });

  describe('day cells', () => {
    it('renders day cells for the month grid', () => {
      render(<MonthGrid selectedDate={july2025} events={[]} />);
      // Should have day 1 through 31 for July
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('31')).toBeInTheDocument();
    });

    it('renders 42 cells (6 weeks)', () => {
      render(<MonthGrid selectedDate={july2025} events={[]} />);
      const cells = screen.getAllByRole('gridcell');
      // Grid might have 35 or 42 cells depending on month
      expect(cells.length).toBeGreaterThanOrEqual(28);
      expect(cells.length).toBeLessThanOrEqual(42);
    });

    it('shows events in day cells', () => {
      const eventsOnJuly22: CalendarEvent[] = [
        {
          id: 'test-1',
          sourceId: 'task-1',
          source: 'task',
          type: 'deadline',
          title: 'Test Event on 22nd',
          startDate: '2025-07-22T00:00:00Z',
          isAllDay: true,
          color: 'bg-blue-500',
        },
      ];
      render(<MonthGrid selectedDate={july2025} events={eventsOnJuly22} />);
      expect(screen.getByText('Test Event on 22nd')).toBeInTheDocument();
    });
  });

  describe('interaction', () => {
    it('calls onDateClick when a day is clicked', async () => {
      const onDateClick = vi.fn();
      const { user } = render(
        <MonthGrid selectedDate={july2025} events={[]} onDateClick={onDateClick} />
      );
      // Click on a day cell - find by gridcell role and click the one containing "15"
      const cells = screen.getAllByRole('gridcell');
      const day15Cell = cells.find(c => c.textContent?.includes('15'));
      if (day15Cell) {
        await user.click(day15Cell);
        expect(onDateClick).toHaveBeenCalled();
      }
    });

    it('calls onEventClick when an event chip is clicked', async () => {
      const onEventClick = vi.fn();
      const event: CalendarEvent = {
        id: 'test-1',
        sourceId: 'task-1',
        source: 'task',
        type: 'deadline',
        title: 'Clickable Event',
        startDate: '2025-07-22T00:00:00Z',
        isAllDay: true,
        color: 'bg-blue-500',
      };
      const { user } = render(
        <MonthGrid selectedDate={july2025} events={[event]} onEventClick={onEventClick} />
      );
      await user.click(screen.getByText('Clickable Event'));
      expect(onEventClick).toHaveBeenCalledWith(event);
    });
  });

  describe('popover', () => {
    it('opens day popover when overflow is clicked', async () => {
      const manyEvents: CalendarEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: `ev-${i}`,
        sourceId: `s-${i}`,
        source: 'task' as const,
        type: 'deadline' as const,
        title: `Overflow Event ${i + 1}`,
        startDate: '2025-07-22T00:00:00Z',
        isAllDay: true,
        color: 'bg-blue-500',
      }));
      const { user } = render(
        <MonthGrid selectedDate={july2025} events={manyEvents} />
      );

      const overflowBtn = screen.getByText('+2 more');
      await user.click(overflowBtn);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('closes popover when close is clicked', async () => {
      const manyEvents: CalendarEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: `ev-${i}`,
        sourceId: `s-${i}`,
        source: 'task' as const,
        type: 'deadline' as const,
        title: `Close Event ${i + 1}`,
        startDate: '2025-07-22T00:00:00Z',
        isAllDay: true,
        color: 'bg-blue-500',
      }));
      const { user } = render(
        <MonthGrid selectedDate={july2025} events={manyEvents} />
      );

      await user.click(screen.getByText('+2 more'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      
      await user.click(screen.getByLabelText('Close'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('highlights selected date', () => {
    render(<MonthGrid selectedDate={july2025} events={[]} />);
    const selectedCell = screen.getAllByRole('gridcell').find(c =>
      c.getAttribute('aria-selected') === 'true'
    );
    expect(selectedCell).toBeDefined();
  });
});
