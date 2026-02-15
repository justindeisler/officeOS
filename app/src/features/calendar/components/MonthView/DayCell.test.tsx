import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@/test/utils/render';
import { DayCell } from './DayCell';
import { mockCalendarEvents } from '@/test/mocks/data/calendar/events';
import type { CalendarEvent } from '../../types';

const today = new Date('2025-07-22');
const currentMonth = new Date('2025-07-01');
const otherMonthDate = new Date('2025-06-30');

const sampleEvents: CalendarEvent[] = mockCalendarEvents.filter(e => e.source === 'task').slice(0, 2);

const manyEvents: CalendarEvent[] = Array.from({ length: 5 }, (_, i) => ({
  ...sampleEvents[0],
  id: `event-${i}`,
  title: `Event ${i + 1}`,
}));

describe('DayCell', () => {
  it('renders the day number', () => {
    render(<DayCell date={today} currentMonth={currentMonth} events={[]} />);
    expect(screen.getByText('22')).toBeInTheDocument();
  });

  it('has gridcell role', () => {
    render(<DayCell date={today} currentMonth={currentMonth} events={[]} />);
    expect(screen.getByRole('gridcell')).toBeInTheDocument();
  });

  it('highlights today with primary styling', () => {
    // Mock isToday - use the actual today check through component
    const realToday = new Date();
    realToday.setHours(0, 0, 0, 0);
    render(<DayCell date={realToday} currentMonth={realToday} events={[]} />);
    const cell = screen.getByRole('gridcell');
    expect(cell.className).toContain('bg-primary');
  });

  it('dims dates outside current month', () => {
    render(<DayCell date={otherMonthDate} currentMonth={currentMonth} events={[]} />);
    const cell = screen.getByRole('gridcell');
    expect(cell.className).toContain('bg-muted/20');
  });

  it('shows selected state', () => {
    render(<DayCell date={today} currentMonth={currentMonth} events={[]} isSelected />);
    const cell = screen.getByRole('gridcell');
    expect(cell.className).toContain('ring-primary');
    expect(cell).toHaveAttribute('aria-selected', 'true');
  });

  it('calls onDateClick when clicked', async () => {
    const onClick = vi.fn();
    const { user } = render(
      <DayCell date={today} currentMonth={currentMonth} events={[]} onDateClick={onClick} />
    );
    await user.click(screen.getByRole('gridcell'));
    expect(onClick).toHaveBeenCalledWith(today);
  });

  it('handles Enter key press', async () => {
    const onClick = vi.fn();
    render(
      <DayCell date={today} currentMonth={currentMonth} events={[]} onDateClick={onClick} />
    );
    const cell = screen.getByRole('gridcell');
    cell.focus();
    await new Promise(r => setTimeout(r, 0));
    // Fire keyboard event
    cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onClick).toHaveBeenCalledWith(today);
  });

  describe('event rendering (standard mode)', () => {
    it('renders event chips', () => {
      render(<DayCell date={today} currentMonth={currentMonth} events={sampleEvents} />);
      expect(screen.getByText(sampleEvents[0].title)).toBeInTheDocument();
    });

    it('limits visible events to 3', () => {
      render(<DayCell date={today} currentMonth={currentMonth} events={manyEvents} />);
      expect(screen.getByText('Event 1')).toBeInTheDocument();
      expect(screen.getByText('Event 2')).toBeInTheDocument();
      expect(screen.getByText('Event 3')).toBeInTheDocument();
      expect(screen.queryByText('Event 4')).not.toBeInTheDocument();
    });

    it('shows overflow indicator', () => {
      render(<DayCell date={today} currentMonth={currentMonth} events={manyEvents} />);
      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('calls onEventClick when event chip clicked', async () => {
      const onEventClick = vi.fn();
      const { user } = render(
        <DayCell date={today} currentMonth={currentMonth} events={sampleEvents} onEventClick={onEventClick} />
      );
      await user.click(screen.getByText(sampleEvents[0].title));
      expect(onEventClick).toHaveBeenCalledWith(sampleEvents[0]);
    });

    it('calls onOverflowClick when overflow clicked', async () => {
      const onOverflowClick = vi.fn();
      const { user } = render(
        <DayCell date={today} currentMonth={currentMonth} events={manyEvents} onOverflowClick={onOverflowClick} />
      );
      await user.click(screen.getByText('+2 more'));
      expect(onOverflowClick).toHaveBeenCalledWith(today);
    });
  });

  describe('compact mode (mobile)', () => {
    it('renders dots instead of chips', () => {
      render(<DayCell date={today} currentMonth={currentMonth} events={sampleEvents} compact />);
      // Should not show full text
      expect(screen.queryByText(sampleEvents[0].title)).not.toBeInTheDocument();
      // But should have dot buttons with aria-label
      expect(screen.getByLabelText(sampleEvents[0].title)).toBeInTheDocument();
    });

    it('limits dots to 4 with overflow text', () => {
      render(<DayCell date={today} currentMonth={currentMonth} events={manyEvents} compact />);
      const dots = screen.getAllByRole('button');
      expect(dots.length).toBe(4); // 4 dots max
      expect(screen.getByText('+1')).toBeInTheDocument();
    });
  });

  it('includes event count in aria-label', () => {
    render(<DayCell date={today} currentMonth={currentMonth} events={sampleEvents} />);
    const cell = screen.getByRole('gridcell');
    expect(cell.getAttribute('aria-label')).toContain('2 events');
  });

  it('is focusable via tabIndex', () => {
    render(<DayCell date={today} currentMonth={currentMonth} events={[]} />);
    expect(screen.getByRole('gridcell')).toHaveAttribute('tabindex', '0');
  });
});
