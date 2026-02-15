import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils/render';
import { DayPopover } from './DayPopover';
import { mockCalendarEvents } from '@/test/mocks/data/calendar/events';
import type { CalendarEvent } from '../../types';

const testDate = new Date('2025-07-22');
const testEvents = mockCalendarEvents.slice(0, 4);

describe('DayPopover', () => {
  it('renders as a dialog', () => {
    render(<DayPopover date={testDate} events={testEvents} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows the date in the header', () => {
    render(<DayPopover date={testDate} events={testEvents} />);
    expect(screen.getByText('Tuesday, July 22')).toBeInTheDocument();
  });

  it('has an accessible label', () => {
    render(<DayPopover date={testDate} events={testEvents} />);
    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('July 22, 2025')
    );
  });

  it('renders all events', () => {
    render(<DayPopover date={testDate} events={testEvents} />);
    testEvents.forEach(event => {
      expect(screen.getByText(event.title)).toBeInTheDocument();
    });
  });

  it('shows empty state when no events', () => {
    render(<DayPopover date={testDate} events={[]} />);
    expect(screen.getByText('No events')).toBeInTheDocument();
  });

  it('shows event count', () => {
    render(<DayPopover date={testDate} events={testEvents} />);
    expect(screen.getByText(`${testEvents.length} events`)).toBeInTheDocument();
  });

  it('shows singular "event" for one event', () => {
    render(<DayPopover date={testDate} events={[testEvents[0]]} />);
    expect(screen.getByText('1 event')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn();
    const { user } = render(<DayPopover date={testDate} events={testEvents} onClose={onClose} />);
    await user.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onEventClick when event clicked', async () => {
    const onEventClick = vi.fn();
    const { user } = render(
      <DayPopover date={testDate} events={testEvents} onEventClick={onEventClick} />
    );
    await user.click(screen.getByText(testEvents[0].title));
    expect(onEventClick).toHaveBeenCalledWith(testEvents[0]);
  });

  it('shows source label for each event', () => {
    const taskEvent = testEvents.find(e => e.source === 'task')!;
    render(<DayPopover date={testDate} events={[taskEvent]} />);
    expect(screen.getByText('Task')).toBeInTheDocument();
  });

  it('shows time info for timed events', () => {
    const timedEvent = testEvents.find(e => !e.isAllDay)!;
    render(<DayPopover date={testDate} events={[timedEvent]} />);
    // Should show formatted time
    expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument();
  });

  it('marks overdue events with destructive text', () => {
    const overdueEvent: CalendarEvent = {
      ...testEvents[0],
      id: 'overdue-1',
      isOverdue: true,
    };
    render(<DayPopover date={testDate} events={[overdueEvent]} />);
    const titleEl = screen.getByText(overdueEvent.title);
    expect(titleEl.className).toContain('text-destructive');
  });

  it('marks completed events with line-through', () => {
    const completedEvent: CalendarEvent = {
      ...testEvents[0],
      id: 'completed-1',
      isCompleted: true,
    };
    render(<DayPopover date={testDate} events={[completedEvent]} />);
    const titleEl = screen.getByText(completedEvent.title);
    expect(titleEl.className).toContain('line-through');
  });

  it('shows running status for running events', () => {
    const runningEvent: CalendarEvent = {
      ...testEvents[0],
      id: 'running-1',
      isRunning: true,
      isAllDay: false,
      source: 'time_entry',
    };
    render(<DayPopover date={testDate} events={[runningEvent]} />);
    expect(screen.getByText(/Running/)).toBeInTheDocument();
  });
});
